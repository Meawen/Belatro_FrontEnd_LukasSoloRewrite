import { describe, test, expect, vi, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'
import type { StompClientHandlers } from './gameSocket'

// The real socket module (its default 1008 handling included), on fake STOMP clients
const sockets = vi.hoisted(() => ({ clients: [] as { token: string; handlers: StompClientHandlers }[] }))
vi.mock('./gameSocket', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./gameSocket')>()
    return {
        ...actual,
        gameSocket: actual.createGameSocket((token, handlers) => {
            sockets.clients.push({ token, handlers })
            return { activate() {}, deactivate() {}, publish() {}, subscribe: () => ({ id: 'sub', unsubscribe() {} }) }
        }),
    }
})

import { apiClient, ApiError } from './api'
import { authService } from './authService'
import { gameSocket } from './gameSocket'
import { userService } from './userService'
import { GUEST_SECRET_KEY } from './guestSecret'

const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    jsdomStorage.clear()
})

describe('authService email routes', () => {
    test('confirmEmail posts the token from the link', async () => {
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
        await authService.confirmEmail('tok-1')
        expect(post).toHaveBeenCalledWith('/api/auth/confirm-email', { token: 'tok-1' })
    })

    test('forgotPassword posts the address', async () => {
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
        await authService.forgotPassword('ana@example.com')
        expect(post).toHaveBeenCalledWith('/api/auth/forgot-password', { email: 'ana@example.com' })
    })

    test('resetPassword posts token and new password, then forgets the local session', async () => {
        vi.stubGlobal('localStorage', jsdomStorage)
        jsdomStorage.setItem('authToken', 'old-token')
        jsdomStorage.setItem('user', '{"id":"u1","username":"ana"}')
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
        await authService.resetPassword('tok-2', 'brand-new-pass')
        expect(post).toHaveBeenCalledWith('/api/auth/reset-password', { token: 'tok-2', newPassword: 'brand-new-pass' })
        expect(jsdomStorage.getItem('authToken')).toBeNull()
        expect(jsdomStorage.getItem('user')).toBeNull()
    })
})

describe('authService.logout', () => {
    test('the server closing this tab\'s socket (1008) during the logout does not show "session ended"', async () => {
        const assign = vi.fn()
        vi.stubGlobal('localStorage', jsdomStorage)
        vi.stubGlobal('location', { ...window.location, assign })
        jsdomStorage.setItem('authToken', 'tok-1')
        const release = gameSocket.acquire()
        const socket = sockets.clients[sockets.clients.length - 1]
        socket.handlers.onConnect()
        const fetch = vi.fn(async () => {
            // the backend closes the user's sockets as it logs the token out, before it answers
            socket.handlers.onWebSocketClose(1008)
            // ...and answers 200 text/plain (AuthController: ResponseEntity<String>)
            const headers: Record<string, string> = { 'content-type': 'text/plain;charset=UTF-8', 'content-length': '24' }
            return {
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
                text: () => Promise.resolve('Successfully logged out.'),
                json: () => Promise.reject(new SyntaxError('Unexpected token \'S\', "Successfully logged out." is not valid JSON')),
            } as unknown as Response
        })
        vi.stubGlobal('fetch', fetch)
        try {
            await expect(authService.logout()).resolves.toBe('Successfully logged out.')
            expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/auth\/logout$/), expect.objectContaining({ method: 'POST' }))
            expect(assign).not.toHaveBeenCalled()
            // not signOutToLogin (assign was never called): logout's own clearToken ran
            expect(jsdomStorage.getItem('authToken')).toBeNull()
        } finally {
            release()
        }
    })
})

describe('authService and guests (spec §3)', () => {
    const GUEST = { id: 'g1', username: 'gost_4821', guest: true }
    // POST /api/auth/guest's guestSecret: 43 characters of [A-Za-z0-9_-] (B4, Ruling 32)
    const SECRET = 'q1W2e3R4t5Y6u7I8o9P0a1S2d3F4g5H6j7K8l9Z0x1C'

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

    test("startGuest posts the language, and keeps the guest's token, user and secret (Ruling 32)", async () => {
        vi.stubGlobal('localStorage', jsdomStorage)
        const fetch = vi.fn(async () => jsonResponse(200, { token: 'g-tok', user: GUEST, message: null, guestSecret: SECRET }))
        vi.stubGlobal('fetch', fetch)
        await authService.startGuest('hr')
        expect(call(fetch, 0)).toMatchObject({ method: 'POST', body: '{"language":"hr"}' })
        expect(call(fetch, 0).url).toMatch(/\/api\/auth\/guest$/)
        expect(jsdomStorage.getItem('authToken')).toBe('g-tok')
        expect(JSON.parse(jsdomStorage.getItem('user') ?? 'null')).toEqual(GUEST)
        // the key the report names for S9
        expect(GUEST_SECRET_KEY).toBe('stiglja:guestSecret')
        expect(jsdomStorage.getItem(GUEST_SECRET_KEY)).toBe(SECRET)
    })

    test('renameGuest sends the name, swaps the stored token and user, and the next request carries the new token', async () => {
        vi.stubGlobal('localStorage', jsdomStorage)
        jsdomStorage.setItem('authToken', 'old-tok')
        jsdomStorage.setItem('user', JSON.stringify(GUEST))
        jsdomStorage.setItem(GUEST_SECRET_KEY, SECRET)
        const fetch = vi.fn()
            .mockResolvedValueOnce(jsonResponse(200, { token: 'new-tok', user: { id: 'g1', username: 'jura', guest: true }, message: null }))
            .mockResolvedValueOnce(jsonResponse(200, {}))
        vi.stubGlobal('fetch', fetch)
        await authService.renameGuest('jura')
        expect(call(fetch, 0)).toMatchObject({ method: 'PATCH', body: '{"username":"jura"}', authorization: 'Bearer old-tok' })
        expect(call(fetch, 0).url).toMatch(/\/user\/me\/guest-name$/)
        expect(jsdomStorage.getItem('authToken')).toBe('new-tok')
        expect(JSON.parse(jsdomStorage.getItem('user') ?? 'null')).toMatchObject({ username: 'jura', guest: true })
        // a rename keeps the secret (Ruling 32): the server keeps its hash on the same account
        expect(jsdomStorage.getItem(GUEST_SECRET_KEY)).toBe(SECRET)
        await userService.getMe()
        expect(call(fetch, 1).authorization).toBe('Bearer new-tok')
    })

    test('a new name is sent in NFC: a decomposed č (Matic + U+030C) goes as Matič (Ruling 35)', async () => {
        vi.stubGlobal('localStorage', jsdomStorage)
        jsdomStorage.setItem('authToken', 'old-tok')
        const fetch = vi.fn(async () => jsonResponse(200, { token: 'new-tok', user: { id: 'g1', username: 'matič', guest: true }, message: null }))
        vi.stubGlobal('fetch', fetch)
        await authService.renameGuest('Matic\u030C')
        expect(call(fetch, 0).body).toBe('{"username":"Mati\u010D"}')
    })

    test('a rename refused while seated (409 IN_GAME) keeps the token and the user', async () => {
        vi.stubGlobal('localStorage', jsdomStorage)
        jsdomStorage.setItem('authToken', 'old-tok')
        jsdomStorage.setItem('user', JSON.stringify(GUEST))
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(409, { error: "You can't change your name while at a table or in a game", code: 'IN_GAME' })))
        const refused = authService.renameGuest('jura')
        await expect(refused).rejects.toBeInstanceOf(ApiError)
        await expect(refused).rejects.toMatchObject({ status: 409, code: 'IN_GAME' })
        expect(jsdomStorage.getItem('authToken')).toBe('old-tok')
        expect(JSON.parse(jsdomStorage.getItem('user') ?? 'null')).toEqual(GUEST)
    })

    test("the server closing the old token's socket (1008) during a rename does not sign the tab out", async () => {
        const assign = vi.fn()
        vi.stubGlobal('localStorage', jsdomStorage)
        vi.stubGlobal('location', { ...window.location, assign })
        jsdomStorage.setItem('authToken', 'old-tok')
        jsdomStorage.setItem('user', JSON.stringify(GUEST))
        const release = gameSocket.acquire()
        const socket = sockets.clients[sockets.clients.length - 1]
        socket.handlers.onConnect()
        vi.stubGlobal('fetch', vi.fn(async () => {
            // the server ends the old name's session (and its sockets) before it answers with the new token
            socket.handlers.onWebSocketClose(1008)
            return jsonResponse(200, { token: 'new-tok', user: { id: 'g1', username: 'jura', guest: true }, message: null })
        }))
        try {
            await authService.renameGuest('jura')
            expect(assign).not.toHaveBeenCalled()
            expect(sockets.clients[sockets.clients.length - 1].token).toBe('new-tok')
        } finally {
            release()
        }
    })

    test('signing in or up as a member ends the guest in this browser, and its secret with it (spec §3.3)', async () => {
        vi.stubGlobal('localStorage', jsdomStorage)
        const member = { token: 'm-tok', user: { id: 'u1', username: 'ana', guest: false }, message: null }
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, member)))
        jsdomStorage.setItem(GUEST_SECRET_KEY, SECRET)
        await authService.login({ username: 'ana', password: 'long-enough-1' })
        expect(jsdomStorage.getItem(GUEST_SECRET_KEY)).toBeNull()
        jsdomStorage.setItem(GUEST_SECRET_KEY, SECRET)
        await authService.signup({ username: 'ana', email: 'ana@example.com', password: 'long-enough-1' })
        expect(jsdomStorage.getItem(GUEST_SECRET_KEY)).toBeNull()
    })

    test("a guest's wrong password for a member account on /login keeps the guest signed in", async () => {
        const assign = vi.fn()
        vi.stubGlobal('localStorage', jsdomStorage)
        vi.stubGlobal('location', { ...window.location, assign })
        jsdomStorage.setItem('authToken', 'g-tok')
        jsdomStorage.setItem('user', JSON.stringify(GUEST))
        jsdomStorage.setItem(GUEST_SECRET_KEY, SECRET)
        const fetch = vi.fn(async () => jsonResponse(401, { error: 'Bad credentials', code: 'BAD_CREDENTIALS' }))
        vi.stubGlobal('fetch', fetch)
        await expect(authService.login({ username: 'ana', password: 'wrong-password' })).rejects.toMatchObject({ code: 'BAD_CREDENTIALS' })
        // the refusal is about the password typed, not the guest's token: nothing ends, nothing signs in again
        expect(fetch).toHaveBeenCalledTimes(1)
        expect(assign).not.toHaveBeenCalled()
        expect(jsdomStorage.getItem('authToken')).toBe('g-tok')
        expect(jsdomStorage.getItem(GUEST_SECRET_KEY)).toBe(SECRET)
    })
})
