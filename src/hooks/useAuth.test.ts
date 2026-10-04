import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { JSDOM } from 'jsdom'
import { authService } from '../services/authService'
import { ApiError } from '../services/api'
import { useAuth } from './useAuth'
import { captureConsole } from '../test/captureConsole'

const PASSWORD = 'Sup3r-Secret-pw!'
const TOKEN = 'tok.en.value'
const issued = { token: TOKEN, user: { id: 'u1', username: 'ana' }, message: null }

// Node 26's own localStorage global is unusable here; borrow jsdom's (see api.test.ts)
const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

describe('useAuth logging', () => {
    beforeEach(() => vi.stubGlobal('localStorage', jsdomStorage))
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
})
