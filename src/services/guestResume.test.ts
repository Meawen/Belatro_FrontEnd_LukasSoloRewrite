import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'
import type { StompClientHandlers } from './gameSocket'

// The real socket module (its session decision and default sign-out included), on fake STOMP clients, as in
// session.test.ts
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

import { apiClient } from './api'
import { authService } from './authService'
import { gameSocket } from './gameSocket'
import { GUEST_SECRET_KEY } from './guestSecret'
import { renewIfExpiring } from './tokenRenewal'
import { userService } from './userService'

// Node 26's own localStorage global is unusable here; borrow jsdom's (see api.test.ts)
const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

const GUEST = { id: 'g1', username: 'gost_4821', guest: true }
const SECRET = 'q1W2e3R4t5Y6u7I8o9P0a1S2d3F4g5H6j7K8l9Z0x1C'

/** A JWT as the backend issues it, whose exp is this far from now; the SPA reads exp without checking the signature. */
function jwt(expiresInMs: number, id: string): string {
    const exp = Math.floor((Date.now() + expiresInMs) / 1000)
    const payload = btoa(JSON.stringify({ sub: 'gost_4821', jti: id, iat: exp - 120 * 60, exp }))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    return `eyJhbGciOiJIUzI1NiJ9.${payload}.signature-${id}`
}

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

// What the backend sends for a token it refuses (JwtAuthenticationFilter), and for a wrong password or secret
const sessionExpired = () => jsonResponse(401, { error: 'Session expired, please sign in again', code: 'SESSION_EXPIRED' })
const badCredentials = () => jsonResponse(401, { error: 'Bad credentials', code: 'BAD_CREDENTIALS' })
const signedBackIn = (token: string) => jsonResponse(200, { token, user: GUEST, message: null })

type Call = { path: string; authorization: string | undefined; body: unknown }
/** The fetch calls so far: path, bearer and body. */
function calls(fetch: ReturnType<typeof vi.fn>): Call[] {
    return fetch.mock.calls.map(([url, init]) => ({
        path: new URL(String(url), 'http://localhost').pathname.replace(/^\/backend/, ''),
        authorization: ((init as RequestInit).headers as Record<string, string>).Authorization,
        body: (init as RequestInit).body ? JSON.parse(String((init as RequestInit).body)) : undefined,
    }))
}
const logins = (fetch: ReturnType<typeof vi.fn>) => calls(fetch).filter((c) => c.path === '/api/auth/login')

let assign: ReturnType<typeof vi.fn>

beforeEach(() => {
    assign = vi.fn()
    vi.stubGlobal('localStorage', jsdomStorage)
    vi.stubGlobal('location', { ...window.location, assign })
    jsdomStorage.setItem('user', JSON.stringify(GUEST))
    jsdomStorage.setItem(GUEST_SECRET_KEY, SECRET)
})

afterEach(() => {
    gameSocket.disconnect()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    jsdomStorage.clear()
})

describe("a guest's session comes back with its secret (Ruling 32)", () => {
    test('an expired guest token: the guest signs back in with its secret, and nothing is sent on the expired token', async () => {
        const expired = jwt(-60 * 60_000, 'old')
        const fresh = jwt(120 * 60_000, 'fresh')
        jsdomStorage.setItem('authToken', expired)
        const fetch = vi.fn(async (url: string, init: RequestInit) => {
            if (url.endsWith('/api/auth/login')) return signedBackIn(fresh)
            const bearer = (init.headers as Record<string, string>).Authorization
            return bearer === `Bearer ${fresh}` ? jsonResponse(200, { ...GUEST, guest: true }) : sessionExpired()
        })
        vi.stubGlobal('fetch', fetch)

        // the renewal check (at start, when the tab is shown, every minute) finds the expired token
        const renewed = renewIfExpiring()
        // a page's request while the sign-in is under way waits for it
        const me = userService.getMe()
        await expect(renewed).resolves.toBe(true)
        await expect(me).resolves.toMatchObject({ username: 'gost_4821' })

        // the normal sign-in, with the guest's current name and its secret
        expect(logins(fetch)).toEqual([{ path: '/api/auth/login', authorization: `Bearer ${expired}`, body: { username: 'gost_4821', password: SECRET } }])
        expect(calls(fetch).filter((c) => c.path === '/user/me').map((c) => c.authorization)).toEqual([`Bearer ${fresh}`])
        expect(jsdomStorage.getItem('authToken')).toBe(fresh)
        expect(JSON.parse(jsdomStorage.getItem('user') ?? 'null')).toEqual(GUEST)
        expect(jsdomStorage.getItem(GUEST_SECRET_KEY)).toBe(SECRET)
        expect(assign).not.toHaveBeenCalled()
    })

    test("a member's expired token is left alone: no sign-in is tried, and nothing ends", async () => {
        jsdomStorage.setItem('user', JSON.stringify({ id: 'u1', username: 'ana' }))
        jsdomStorage.removeItem(GUEST_SECRET_KEY)
        const expired = jwt(-60 * 60_000, 'old')
        jsdomStorage.setItem('authToken', expired)
        const fetch = vi.fn()
        vi.stubGlobal('fetch', fetch)
        await expect(renewIfExpiring()).resolves.toBe(false)
        expect(fetch).not.toHaveBeenCalled()
        expect(jsdomStorage.getItem('authToken')).toBe(expired)
    })

    test('a 401 for a guest that still holds its secret signs it back in instead of ending the session', async () => {
        jsdomStorage.setItem('authToken', 'g-tok')
        const release = gameSocket.acquire()
        sockets.clients[sockets.clients.length - 1].handlers.onConnect()
        const fetch = vi.fn(async (url: string, init: RequestInit) => {
            if (url.endsWith('/api/auth/login')) return signedBackIn('g-new')
            // the server refused g-tok (its 24-hour chain ended): only the new token works
            return (init.headers as Record<string, string>).Authorization === 'Bearer g-new' ? jsonResponse(200, { id: 'l1' }) : sessionExpired()
        })
        vi.stubGlobal('fetch', fetch)
        try {
            await expect(apiClient.get('/lobbies/l1')).rejects.toMatchObject({ status: 401, invalidToken: true })
            await vi.waitFor(() => expect(jsdomStorage.getItem('authToken')).toBe('g-new'))
            expect(logins(fetch)).toHaveLength(1)
            expect(logins(fetch)[0].body).toEqual({ username: 'gost_4821', password: SECRET })
            // the socket reopens on the new token, and the next request carries it
            await vi.waitFor(() => expect(sockets.clients[sockets.clients.length - 1].token).toBe('g-new'))
            await expect(apiClient.get('/lobbies/l1')).resolves.toEqual({ id: 'l1' })
            expect(assign).not.toHaveBeenCalled()
            expect(jsdomStorage.getItem(GUEST_SECRET_KEY)).toBe(SECRET)
        } finally {
            release()
        }
    })

    test('a secret the server refuses ends the guest session the one way sessions end, and forgets the secret (S9 shows that end)', async () => {
        jsdomStorage.setItem('authToken', 'g-tok')
        const fetch = vi.fn(async (url: string) => (url.endsWith('/api/auth/login') ? badCredentials() : sessionExpired()))
        vi.stubGlobal('fetch', fetch)
        await expect(apiClient.get('/lobbies/l1')).rejects.toMatchObject({ status: 401 })
        await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('/login?reason=session-ended'))
        expect(assign).toHaveBeenCalledTimes(1)
        expect(logins(fetch)).toHaveLength(1)
        expect(jsdomStorage.getItem(GUEST_SECRET_KEY)).toBeNull()
        expect(jsdomStorage.getItem('authToken')).toBeNull()
    })

    test('no answer to the sign-in ends nothing: the token and the secret stay for the next try', async () => {
        jsdomStorage.setItem('authToken', 'g-tok')
        const fetch = vi.fn(async (url: string) => {
            if (url.endsWith('/api/auth/login')) throw new TypeError('Failed to fetch')
            return sessionExpired()
        })
        vi.stubGlobal('fetch', fetch)
        await expect(apiClient.get('/lobbies/l1')).rejects.toMatchObject({ status: 401 })
        await vi.waitFor(() => expect(logins(fetch)).toHaveLength(1))
        // the sign-in's answer (none) has been handled by the time a new request may go out
        await expect(apiClient.get('/lobbies/l1')).rejects.toMatchObject({ status: 401 })
        expect(assign).not.toHaveBeenCalled()
        expect(jsdomStorage.getItem('authToken')).toBe('g-tok')
        expect(jsdomStorage.getItem(GUEST_SECRET_KEY)).toBe(SECRET)
    })

    test("a 401 for the old token while a rename is under way waits for the rename, and never tries the secret", async () => {
        jsdomStorage.setItem('authToken', 'g-tok')
        const fetch = vi.fn(async (url: string): Promise<Response> => {
            if (url.endsWith('/user/me/guest-name')) {
                // the server ended the old name's session before it answers: a poll meanwhile gets a 401
                await apiClient.get('/lobbies/l1').catch(() => undefined)
                return jsonResponse(200, { token: 'new-tok', user: { id: 'g1', username: 'jura', guest: true }, message: null })
            }
            if (url.endsWith('/api/auth/login')) return signedBackIn('other-tok')
            return sessionExpired()
        })
        vi.stubGlobal('fetch', fetch)
        await authService.renameGuest('jura')
        expect(logins(fetch)).toEqual([])
        expect(assign).not.toHaveBeenCalled()
        expect(jsdomStorage.getItem('authToken')).toBe('new-tok')
    })
})
