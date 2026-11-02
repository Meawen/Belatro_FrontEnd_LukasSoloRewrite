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
    afterEach(() => { jsdomStorage.clear(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.doUnmock('../i18n/catalog/loadEn.vitest') })

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

    test("an English account on a Croatian device: the English catalog arrives before the switch (it loads on demand)", async () => {
        jsdomStorage.setItem('stiglja:lang', 'hr')
        let arrive!: (catalog: unknown) => void
        const loadEn = vi.fn(() => new Promise((resolve) => { arrive = resolve }))
        // t.ts reaches the catalog through vitest.config.ts's stand-in for './catalog/loadEn'
        vi.doMock('../i18n/catalog/loadEn.vitest', () => ({ enNow: null, loadEn }))
        const { useAuth, authService, userService, lang } = await load()
        const { cat } = await import('../i18n/t')
        const { en } = await import('../i18n/catalog/en')
        vi.spyOn(authService, 'login').mockImplementation(signIn)
        vi.spyOn(userService, 'getMe').mockResolvedValue({ ...ME, language: 'en' })
        captureConsole()
        const { result } = renderHook(() => useAuth())
        let signedIn = false
        act(() => { void result.current.login({ username: 'ana', password: PASSWORD }).then(() => { signedIn = true }) })
        await vi.waitFor(() => expect(loadEn).toHaveBeenCalledTimes(1))
        expect(lang.getLang()).toBe('hr')
        await act(async () => arrive(en))
        await vi.waitFor(() => expect(signedIn).toBe(true))
        expect(lang.getLang()).toBe('en')
        expect(cat().titles.settings).toBe('Settings')
    })

    test("an English account's catalog that fails to arrive keeps the device's language, and the sign-in", async () => {
        jsdomStorage.setItem('stiglja:lang', 'hr')
        vi.doMock('../i18n/catalog/loadEn.vitest', () => ({ enNow: null, loadEn: vi.fn(async () => { throw new Error('Failed to fetch dynamically imported module') }) }))
        const { useAuth, authService, userService, lang } = await load()
        vi.spyOn(authService, 'login').mockImplementation(signIn)
        vi.spyOn(userService, 'getMe').mockResolvedValue({ ...ME, language: 'en' })
        captureConsole()
        const { result } = renderHook(() => useAuth())
        let response: unknown
        await act(async () => { response = await result.current.login({ username: 'ana', password: PASSWORD }) })
        expect(response).toBe(issued)
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

describe('useAuth and guests (spec §3)', () => {
    beforeEach(() => {
        vi.stubGlobal('localStorage', jsdomStorage)
        vi.spyOn(userService, 'getMe').mockResolvedValue(ME)
    })
    afterEach(() => { jsdomStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

    test('a stored guest is a guest; a member, and a member stored before guests existed, are not', () => {
        jsdomStorage.setItem('authToken', 'tok-1')
        for (const [user, guest] of [
            [{ id: 'g1', username: 'gost_4821', guest: true }, true],
            [{ id: 'u1', username: 'ana', guest: false }, false],
            [{ id: 'u1', username: 'ana' }, false],
            // Ruling 38: the flag decides, never the name
            [{ id: 'u2', username: 'gost_1234', guest: false }, false],
        ] as const) {
            jsdomStorage.setItem('user', JSON.stringify(user))
            const { result, unmount } = renderHook(() => useAuth())
            expect(result.current.isGuest, user.username).toBe(guest)
            unmount()
        }
    })

    test('a typed name goes out in NFC: a decomposed č (Matic + U+030C) is sent as Matič, at sign-in and at sign-up (Ruling 35)', async () => {
        vi.spyOn(authService, 'login').mockResolvedValue(issued)
        vi.spyOn(authService, 'signup').mockResolvedValue(issued)
        captureConsole()
        const { result } = renderHook(() => useAuth())
        await act(async () => { await result.current.login({ username: 'Matic\u030C', password: PASSWORD }) })
        expect(authService.login).toHaveBeenCalledWith({ username: 'Mati\u010D', password: PASSWORD })
        await act(async () => { await result.current.signup({ username: 'Matic\u030C', email: 'm@example.com', password: PASSWORD }) })
        expect(authService.signup).toHaveBeenCalledWith(expect.objectContaining({ username: 'Mati\u010D' }))
    })

    test("a stored session it can't read is forgotten whole, a guest's secret included (Ruling 44: one forgetSession)", () => {
        vi.spyOn(authService, 'logout').mockResolvedValue('Successfully logged out.')
        captureConsole()
        for (const user of [null, '{not json']) {
            jsdomStorage.setItem('authToken', 'tok-g')
            if (user !== null) jsdomStorage.setItem('user', user)
            jsdomStorage.setItem('stiglja:guestSecret', 'secret')
            const { result, unmount } = renderHook(() => useAuth())
            expect(result.current.isAuthenticated, String(user)).toBe(false)
            expect([jsdomStorage.getItem('authToken'), jsdomStorage.getItem('user'), jsdomStorage.getItem('stiglja:guestSecret')], String(user)).toEqual([null, null, null])
            unmount()
        }
    })

    // a real apiClient on a stubbed fetch (authService.test's helpers), so the request's own headers are checked
    function jsonResponse(status: number, body: unknown) {
        return {
            ok: status >= 200 && status < 300,
            status,
            statusText: `status-${status}`,
            headers: { get: () => null },
            json: () => Promise.resolve(body),
            text: () => Promise.resolve(JSON.stringify(body)),
        } as unknown as Response
    }
    const call = (fetch: ReturnType<typeof vi.fn>, n: number) => {
        const [url, init] = fetch.mock.calls[n] as [string, RequestInit]
        return { url, method: init.method, body: init.body, authorization: (init.headers as Record<string, string>).Authorization }
    }
    const GUEST = { id: 'g1', username: 'gost_4821', guest: true }

    function storeGuest() {
        jsdomStorage.setItem('authToken', 'g-tok')
        jsdomStorage.setItem('user', JSON.stringify(GUEST))
        jsdomStorage.setItem('stiglja:guestSecret', 'secret')
    }

    test("a guest's signup goes out on the guest's token, says wasGuest, and the guest ends with it (Rulings 5, 32)", async () => {
        storeGuest()
        const member = { id: 'u9', username: 'jura', guest: false }
        const fetch = vi.fn(async () => jsonResponse(200, { token: 'm-tok', user: member, message: null }))
        vi.stubGlobal('fetch', fetch)
        captureConsole()
        const { result } = renderHook(() => useAuth())
        expect(result.current.isGuest).toBe(true)
        await act(async () => { await result.current.signup({ username: 'jura', email: 'j@example.com', password: PASSWORD, wasGuest: true }) })
        expect(fetch).toHaveBeenCalledTimes(1)
        const sent = call(fetch, 0)
        expect(sent.url).toMatch(/\/api\/auth\/signup$/)
        expect(sent.method).toBe('POST')
        expect(sent.authorization).toBe('Bearer g-tok')
        expect(JSON.parse(String(sent.body))).toMatchObject({ username: 'jura', wasGuest: true, language: 'en' })
        expect(jsdomStorage.getItem('authToken')).toBe('m-tok')
        expect(JSON.parse(jsdomStorage.getItem('user') ?? 'null')).toEqual(member)
        expect(jsdomStorage.getItem('stiglja:guestSecret')).toBeNull()
        expect(result.current.isGuest).toBe(false)
    })

    test('a refused guest signup (409 SIGNUP_FULL) leaves the guest as it was', async () => {
        storeGuest()
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(409, { error: 'Signup is full', code: 'SIGNUP_FULL' })))
        captureConsole()
        const { result } = renderHook(() => useAuth())
        await act(async () => {
            await expect(result.current.signup({ username: 'jura', email: 'j@example.com', password: PASSWORD, wasGuest: true }))
                .rejects.toMatchObject({ status: 409, code: 'SIGNUP_FULL' })
        })
        expect(jsdomStorage.getItem('authToken')).toBe('g-tok')
        expect(JSON.parse(jsdomStorage.getItem('user') ?? 'null')).toEqual(GUEST)
        expect(jsdomStorage.getItem('stiglja:guestSecret')).toBe('secret')
        expect(result.current.isGuest).toBe(true)
    })

    test("logging out forgets the guest's secret with its token and user (Ruling 32)", async () => {
        jsdomStorage.setItem('authToken', 'tok-g')
        jsdomStorage.setItem('user', JSON.stringify({ id: 'g1', username: 'gost_4821', guest: true }))
        jsdomStorage.setItem('stiglja:guestSecret', 'secret')
        vi.spyOn(authService, 'logout').mockResolvedValue('Successfully logged out.')
        vi.stubGlobal('location', { ...window.location, assign: vi.fn() })
        captureConsole()
        const { result } = renderHook(() => useAuth())
        await act(async () => { await result.current.logout() })
        expect(jsdomStorage.getItem('stiglja:guestSecret')).toBeNull()
        expect(jsdomStorage.getItem('authToken')).toBeNull()
        expect(jsdomStorage.getItem('user')).toBeNull()
    })
})
