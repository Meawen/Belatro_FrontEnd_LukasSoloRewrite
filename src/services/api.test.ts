import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'
import { apiClient, ApiError } from './api'
import { captureConsole } from '../test/captureConsole'

function fakeResponse(status: number, body: unknown) {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: `status-${status}`,
        headers: { get: () => null },
        json: () => Promise.resolve(body),
    } as unknown as Response
}

// Node 26 defines a `localStorage` global that stays undefined without
// --localstorage-file, and it shadows jsdom's (vitest makes window === globalThis),
// so the bare global is unusable here. Borrow a real jsdom Storage instead of
// hand-rolling a double.
const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

describe('apiClient error handling', () => {
    beforeEach(() => {
        vi.stubGlobal('localStorage', jsdomStorage)
        localStorage.setItem('authToken', 'tok-123')
    })
    afterEach(() => { jsdomStorage.clear(); vi.unstubAllGlobals() })

    test('surfaces the backend {"error"} body as the ApiError message', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(409, { error: 'Username or email is already taken' })))
        await expect(apiClient.get('/x')).rejects.toMatchObject({
            name: 'ApiError', status: 409, message: 'Username or email is already taken',
        })
    })

    test('prefers "message" over "error" when both exist', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(400, { message: 'from-message', error: 'from-error' })))
        await expect(apiClient.get('/x')).rejects.toMatchObject({ message: 'from-message' })
    })

    test('a validation field map surfaces its first message', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(400, { password: 'Password must be at least 8 characters and at most 72 bytes' })))
        await expect(apiClient.post('/api/auth/signup', {})).rejects.toMatchObject({
            status: 400, message: 'Password must be at least 8 characters and at most 72 bytes',
        })
    })

    test('401 clears the token by default', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(401, { error: 'nope' })))
        await expect(apiClient.get('/x')).rejects.toBeInstanceOf(ApiError)
        expect(localStorage.getItem('authToken')).toBeNull()
    })

    test('401 keeps the token when keepTokenOn401 is set', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(401, { error: 'Invalid current password' })))
        await expect(apiClient.post('/user/me/password', { a: 1 }, { keepTokenOn401: true }))
            .rejects.toMatchObject({ status: 401, message: 'Invalid current password' })
        expect(localStorage.getItem('authToken')).toBe('tok-123')
    })
})

describe('apiClient logging', () => {
    const PASSWORD = 'Sup3r-Secret-pw!'
    const NEW_PASSWORD = 'N3w-Secret-pw!'
    const TOKEN = 'tok.en.value'

    beforeEach(() => vi.stubGlobal('localStorage', jsdomStorage))
    afterEach(() => { jsdomStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

    test('a password-bearing request logs method and URL, but neither the passwords nor the bearer token', async () => {
        localStorage.setItem('authToken', TOKEN)
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(204, null)))
        const logs = captureConsole()
        await apiClient.post('/user/me/password', { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }, { keepTokenOn401: true })
        expect(logs.leaked(PASSWORD, NEW_PASSWORD, TOKEN)).toEqual([])
        expect(logs.text()).toMatch(/API Request: POST \S*\/user\/me\/password/)
    })

    test('a login logs neither the password nor the token in the response, and still returns the token', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(200, { token: TOKEN, user: { id: 'u1', username: 'ana' }, message: null })))
        const logs = captureConsole()
        await expect(apiClient.post('/api/auth/login', { username: 'ana', password: PASSWORD })).resolves.toMatchObject({ token: TOKEN })
        expect(logs.leaked(PASSWORD, TOKEN)).toEqual([])
    })

    test('a refused password change logs neither the passwords nor the bearer token', async () => {
        localStorage.setItem('authToken', TOKEN)
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(401, { error: 'Current password is incorrect' })))
        const logs = captureConsole()
        await expect(apiClient.post('/user/me/password', { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }, { keepTokenOn401: true }))
            .rejects.toMatchObject({ status: 401, message: 'Current password is incorrect' })
        expect(logs.leaked(PASSWORD, NEW_PASSWORD, TOKEN)).toEqual([])
    })
})
