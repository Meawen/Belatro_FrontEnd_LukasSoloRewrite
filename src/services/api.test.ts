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
        text: () => Promise.resolve(body == null ? '' : JSON.stringify(body)),
    } as unknown as Response
}

// What the backend sends for a token it refuses (JwtAuthenticationFilter).
const SESSION_EXPIRED = { error: 'Session expired, please sign in again' }

function withHeader(response: Response, header: string, value: string) {
    return { ...response, headers: { get: (name: string) => (name === header ? value : null) } } as unknown as Response
}

// What the backend sends for POST /api/auth/logout (AuthController: ResponseEntity<String>).
function logoutResponse() {
    const headers: Record<string, string> = { 'content-type': 'text/plain;charset=UTF-8', 'content-length': '24' }
    return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
        text: () => Promise.resolve('Successfully logged out.'),
        json: () => Promise.reject(new SyntaxError('Unexpected token \'S\', "Successfully logged out." is not valid JSON')),
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
        // a 401 that ends the session reloads into the login page (gameSocket's signOutToLogin)
        vi.stubGlobal('location', { ...window.location, assign: vi.fn() })
        localStorage.setItem('authToken', 'tok-123')
    })
    afterEach(() => { jsdomStorage.clear(); vi.unstubAllGlobals() })

    test('surfaces the backend {"error"} body as the ApiError message', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(409, { error: 'Username is already taken' })))
        await expect(apiClient.get('/x')).rejects.toMatchObject({
            name: 'ApiError', status: 409, message: 'Username is already taken',
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
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(401, { error: 'Current password is incorrect' })))
        await expect(apiClient.post('/user/me/password', { a: 1 }, { keepTokenOn401: true }))
            .rejects.toMatchObject({ status: 401, message: 'Current password is incorrect' })
        expect(localStorage.getItem('authToken')).toBe('tok-123')
    })

    test('an empty 202 resolves to an empty object', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 202,
            statusText: 'Accepted',
            headers: { get: () => null },
            text: () => Promise.resolve(''),
            json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
        } as unknown as Response))
        await expect(apiClient.post('/api/auth/forgot-password', { email: 'ana@example.com' })).resolves.toEqual({})
    })

    test('a text/plain 2xx body (the logout answer) resolves as its text', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(logoutResponse()))
        await expect(apiClient.post('/api/auth/logout')).resolves.toBe('Successfully logged out.')
    })

    test('a 401 that names the token ends the session even when the caller keeps the token on 401', async () => {
        const response = withHeader(fakeResponse(401, SESSION_EXPIRED), 'WWW-Authenticate', 'Bearer error="invalid_token"')
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
        await expect(apiClient.post('/user/me/password', {}, { keepTokenOn401: true }))
            .rejects.toMatchObject({ status: 401, invalidToken: true, message: 'Session expired, please sign in again' })
        expect(localStorage.getItem('authToken')).toBeNull()
    })

    test('a dead session is recognised by its body when CORS hides WWW-Authenticate', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(401, SESSION_EXPIRED)))
        await expect(apiClient.post('/user/me/email', {}, { keepTokenOn401: true }))
            .rejects.toMatchObject({ status: 401, invalidToken: true })
        expect(localStorage.getItem('authToken')).toBeNull()
    })

    test('a wrong current password is a 401 but not a dead session: the token stays', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(401, { error: 'Current password is incorrect' })))
        await expect(apiClient.post('/user/me/password', {}, { keepTokenOn401: true }))
            .rejects.toMatchObject({ status: 401, invalidToken: false, message: 'Current password is incorrect' })
        expect(localStorage.getItem('authToken')).toBe('tok-123')
    })

    test('a 503 while the session store is unreachable keeps the token', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(503, { error: 'Service temporarily unavailable' })))
        await expect(apiClient.get('/user/me'))
            .rejects.toMatchObject({ status: 503, invalidToken: false, message: 'Service temporarily unavailable' })
        expect(localStorage.getItem('authToken')).toBe('tok-123')
    })

    test('development requests use the /backend proxy prefix, so /api/auth paths are not doubled', async () => {
        const fetchMock = vi.fn().mockResolvedValue(fakeResponse(401, { error: 'Bad credentials' }))
        vi.stubGlobal('fetch', fetchMock)
        await expect(apiClient.post('/api/auth/login', {})).rejects.toBeInstanceOf(ApiError)
        expect(fetchMock.mock.calls[0][0]).toBe('/backend/api/auth/login')
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

    test('a non-2xx response logs method, URL and status, but nothing from its body', async () => {
        const BODY_ONLY = 'java.lang.RuntimeException: body-only-7f3a9c'
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(500, { error: 'Internal Server Error', trace: BODY_ONLY })))
        const logs = captureConsole()
        await expect(apiClient.get('/lobbies/l1')).rejects.toMatchObject({ status: 500, message: 'Internal Server Error' })
        expect(logs.leaked(BODY_ONLY)).toEqual([])
        expect(logs.text()).toMatch(/API Request: GET \S*\/lobbies\/l1/)
        expect(logs.text()).toMatch(/API Response: 500/)
    })
})
