import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { JSDOM } from 'jsdom'
import { authService } from '../services/authService'
import { userService } from '../services/userService'
import { ApiError } from '../services/api'
import { useAuth } from './useAuth'
import { captureConsole } from '../test/captureConsole'
import type { UserDto } from '../types'

const PASSWORD = 'Sup3r-Secret-pw!'
const TOKEN = 'tok.en.value'
const issued = { token: TOKEN, user: { id: 'u1', username: 'ana' }, message: null }
// GET /user/me, which sign-in reads for the account's language
const ME: UserDto = { id: 'u1', username: 'ana', email: null, pendingEmail: null, emailVerified: true, roles: ['ROLE_USER'], deletionRequested: false }

// Node 26's own localStorage global is unusable here; borrow jsdom's (see api.test.ts)
const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

describe('useAuth logging', () => {
    beforeEach(() => {
        vi.stubGlobal('localStorage', jsdomStorage)
        vi.spyOn(userService, 'getMe').mockResolvedValue(ME)
    })
    afterEach(() => { jsdomStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

    test('login logs neither the password nor the issued token', async () => {
        vi.spyOn(authService, 'login').mockResolvedValue(issued)
        const logs = captureConsole()
        const { result } = renderHook(() => useAuth())
        await act(async () => { await result.current.login({ username: 'ana', password: PASSWORD }) })
        expect(logs.leaked(PASSWORD, TOKEN)).toEqual([])
    })

    test('a refused login logs no password', async () => {
        vi.spyOn(authService, 'login').mockRejectedValue(new ApiError({ message: 'Bad credentials', status: 401 }))
        const logs = captureConsole()
        const { result } = renderHook(() => useAuth())
        await act(async () => {
            await expect(result.current.login({ username: 'ana', password: PASSWORD })).rejects.toThrow('Bad credentials')
        })
        expect(logs.leaked(PASSWORD)).toEqual([])
    })

    test('signup logs neither the password nor the issued token', async () => {
        vi.spyOn(authService, 'signup').mockResolvedValue(issued)
        const logs = captureConsole()
        const { result } = renderHook(() => useAuth())
        await act(async () => { await result.current.signup({ username: 'ana', email: 'ana@example.com', password: PASSWORD }) })
        expect(logs.leaked(PASSWORD, TOKEN)).toEqual([])
    })

    test('reading the session, signing in, signing up and logging out write nothing to console.log (X-14)', async () => {
        jsdomStorage.setItem('authToken', 'tok-1')
        jsdomStorage.setItem('user', JSON.stringify({ id: 'u1', username: 'ana' }))
        vi.spyOn(authService, 'login').mockResolvedValue(issued)
        vi.spyOn(authService, 'signup').mockResolvedValue(issued)
        vi.spyOn(authService, 'logout').mockResolvedValue('Successfully logged out.')
        // logout ends in a full load to /
        vi.stubGlobal('location', { ...window.location, assign: vi.fn() })
        captureConsole()
        const { result } = renderHook(() => useAuth())
        await act(async () => { await result.current.login({ username: 'ana', password: PASSWORD }) })
        await act(async () => { await result.current.signup({ username: 'ana', email: 'ana@example.com', password: PASSWORD }) })
        await act(async () => { await result.current.logout() })
        expect(console.log).not.toHaveBeenCalled()
    })
})

describe('useAuth and the site language (spec §1.1)', () => {
    beforeEach(() => {
        vi.stubGlobal('localStorage', jsdomStorage)
        jsdomStorage.clear()
        vi.resetModules()
    })
    afterEach(() => { jsdomStorage.clear(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

    // as authService.login does: the token is stored before useAuth continues, so a setLang now would PUT
    const signIn = async () => {
        jsdomStorage.setItem('authToken', 'tok-1')
        return issued
    }

    // a fresh copy of the hook, the services and the language store, sharing one store
    const load = async () => ({
        useAuth: (await import('./useAuth')).useAuth,
        authService: (await import('../services/authService')).authService,
        userService: (await import('../services/userService')).userService,
        lang: await import('../i18n/lang'),
    })

    test("after sign-in the account's language wins, and adopting it sends nothing back", async () => {
        jsdomStorage.setItem('stiglja:lang', 'hr')
        const { useAuth, authService, userService, lang } = await load()
        vi.spyOn(authService, 'login').mockImplementation(signIn)
        vi.spyOn(userService, 'getMe').mockResolvedValue({ ...ME, language: 'en' })
        const put = vi.spyOn(userService, 'setLanguage')
        captureConsole()
        const { result } = renderHook(() => useAuth())
        await act(async () => { await result.current.login({ username: 'ana', password: PASSWORD }) })
        expect(lang.getLang()).toBe('en')
        expect(jsdomStorage.getItem('stiglja:lang')).toBe('en')
        expect(put).not.toHaveBeenCalled()
    })

    test("an account without a language (an older server) keeps the device's", async () => {
        jsdomStorage.setItem('stiglja:lang', 'hr')
        const { useAuth, authService, userService, lang } = await load()
        vi.spyOn(authService, 'login').mockImplementation(signIn)
        vi.spyOn(userService, 'getMe').mockResolvedValue(ME)
        captureConsole()
        const { result } = renderHook(() => useAuth())
        await act(async () => { await result.current.login({ username: 'ana', password: PASSWORD }) })
        expect(lang.getLang()).toBe('hr')
        expect(jsdomStorage.getItem('stiglja:lang')).toBe('hr')
    })

    test('a failed GET /user/me never fails the sign-in', async () => {
        jsdomStorage.setItem('stiglja:lang', 'hr')
        const { useAuth, authService, userService, lang } = await load()
        vi.spyOn(authService, 'login').mockImplementation(signIn)
        vi.spyOn(userService, 'getMe').mockRejectedValue(new ApiError({ message: 'Service unavailable', status: 503 }))
        captureConsole()
        const { result } = renderHook(() => useAuth())
        let response: unknown
        await act(async () => { response = await result.current.login({ username: 'ana', password: PASSWORD }) })
        expect(response).toBe(issued)
        expect(result.current.isAuthenticated).toBe(true)
        expect(lang.getLang()).toBe('hr')
    })

    test('signup sends the language the site is in', async () => {
        const { useAuth, authService, lang } = await load()
        lang.setLang('hr')
        vi.spyOn(authService, 'signup').mockResolvedValue(issued)
        captureConsole()
        const { result } = renderHook(() => useAuth())
        await act(async () => { await result.current.signup({ username: 'ana', email: 'ana@example.com', password: PASSWORD }) })
        expect(authService.signup).toHaveBeenCalledWith(expect.objectContaining({ language: 'hr' }))
    })
})
