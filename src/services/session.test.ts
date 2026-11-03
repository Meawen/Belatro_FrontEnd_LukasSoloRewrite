import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { JSDOM } from 'jsdom'
import type { StompClientHandlers } from './gameSocket'

// The real socket module (its session decision and default sign-out included), on fake STOMP clients
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
import { createGameSocket, gameSocket } from './gameSocket'
import { userService } from './userService'
import { useAuth } from '../hooks/useAuth'
import { GUEST_SECRET_KEY } from './guestSecret'
import { renewIfExpiring } from './tokenRenewal'

// Node 26's own localStorage global is unusable here; borrow jsdom's (see api.test.ts)
const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

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

// What the backend sends for a token it refuses (JwtAuthenticationFilter)
const sessionExpired = () => jsonResponse(401, { error: 'Session expired, please sign in again' })

const latestSocket = () => sockets.clients[sockets.clients.length - 1]

let assign: ReturnType<typeof vi.fn>

beforeEach(() => {
    assign = vi.fn()
    vi.stubGlobal('localStorage', jsdomStorage)
    vi.stubGlobal('location', { ...window.location, assign })
    jsdomStorage.setItem('authToken', 'tok-1')
    jsdomStorage.setItem('user', '{"id":"u1","username":"ana"}')
})

afterEach(() => {
    gameSocket.disconnect()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    jsdomStorage.clear()
})

describe('one decision ends a session: a REST 401', () => {
    test('an invalid_token 401 ends the session once', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sessionExpired()))
        await expect(apiClient.get('/lobbies/l1')).rejects.toMatchObject({ status: 401, invalidToken: true })
        expect(assign).toHaveBeenCalledTimes(1)
        expect(assign).toHaveBeenCalledWith('/login?reason=session-ended')
        expect(jsdomStorage.getItem('authToken')).toBeNull()
        // only the token: another tab's password change may store a new one (see below)
        expect(jsdomStorage.getItem('user')).not.toBeNull()
    })

    test('a 401 for a token that is no longer the stored one does not end it', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => {
            // a password change stored a rotated token while this request was out
            jsdomStorage.setItem('authToken', 'tok-2')
            return sessionExpired()
        }))
        await expect(apiClient.get('/lobbies/l1')).rejects.toMatchObject({ status: 401, invalidToken: true })
        expect(assign).not.toHaveBeenCalled()
        expect(jsdomStorage.getItem('authToken')).toBe('tok-2')
        expect(jsdomStorage.getItem('user')).not.toBeNull()
    })

    test('a 401 that lands while a password change is held is decided when the change fails', async () => {
        const settled = gameSocket.holdSessionEnd()
        try {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sessionExpired()))
            await expect(apiClient.get('/lobbies/l1')).rejects.toMatchObject({ status: 401 })
            // the change's 200 (and its new token) may still come: nothing is decided yet
            expect(assign).not.toHaveBeenCalled()
            expect(jsdomStorage.getItem('authToken')).toBe('tok-1')
            // it failed, so no new token: the session is over
            settled()
            expect(assign).toHaveBeenCalledWith('/login?reason=session-ended')
            expect(jsdomStorage.getItem('authToken')).toBeNull()
        } finally {
            settled() // a no-op once settled; keeps a failed run from holding the next test's decisions
        }
    })

    test('a 401 that lands while a password change is held carries on once the change stored its token', async () => {
        const settled = gameSocket.holdSessionEnd()
        try {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sessionExpired()))
            await expect(apiClient.get('/lobbies/l1')).rejects.toMatchObject({ status: 401 })
            expect(jsdomStorage.getItem('authToken')).toBe('tok-1')
            jsdomStorage.setItem('authToken', 'tok-2')
            settled()
            expect(assign).not.toHaveBeenCalled()
            expect(jsdomStorage.getItem('authToken')).toBe('tok-2')
        } finally {
            settled()
        }
    })
})

describe('one decision ends a session: a refused STOMP CONNECT', () => {
    function refuseConnect() {
        const release = gameSocket.acquire()
        const socket = latestSocket()
        // the backend's CONNECT gate refuses the token with an ERROR frame, then Spring closes the socket
        socket.handlers.onStompError('STOMP CONNECT requires a valid Bearer token')
        socket.handlers.onWebSocketClose(1002)
        return release
    }

    test('then a /user/me 401 ends the session', async () => {
        const fetch = vi.fn().mockResolvedValue(sessionExpired())
        vi.stubGlobal('fetch', fetch)
        const release = refuseConnect()
        try {
            await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('/login?reason=session-ended'))
            expect(fetch).toHaveBeenCalledTimes(1)
            expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/user\/me$/), expect.objectContaining({ method: 'GET' }))
            expect(jsdomStorage.getItem('authToken')).toBeNull()
        } finally {
            release()
        }
    })

    test('then a /user/me 503 retries with backoff and keeps the session', async () => {
        vi.useFakeTimers()
        const fetch = vi.fn().mockResolvedValue(jsonResponse(503, { error: 'Service temporarily unavailable' }))
        vi.stubGlobal('fetch', fetch)
        const release = refuseConnect()
        try {
            const refused = latestSocket()
            await vi.advanceTimersByTimeAsync(5000)
            expect(fetch).toHaveBeenCalledTimes(1)
            expect(latestSocket()).not.toBe(refused)
            expect(latestSocket().token).toBe('tok-1')
            expect(assign).not.toHaveBeenCalled()
            expect(jsdomStorage.getItem('authToken')).toBe('tok-1')
        } finally {
            release()
        }
    })
})

// N1: tab A changes the password while tab B (same browser, shared storage) holds a game socket.
// The server closes B's socket with 1008 at its first session bump, before A's 200 arrives.
describe('a password change in one tab while another tab holds a game socket', () => {
    test("the other tab's sign-out takes only the token, and the new token is never logged out", async () => {
        // tab B: its own socket module instance, signing out the default way (shared storage, reload)
        let tabB: StompClientHandlers | null = null
        createGameSocket((_token, handlers) => {
            tabB = handlers
            return { activate() {}, deactivate() {}, publish() {}, subscribe: () => ({ id: 'sub', unsubscribe() {} }) }
        }).acquire()
        tabB!.onConnect()

        let afterTabB: { token: string | null; user: string | null } | null = null
        const fetch = vi.fn(async (url: string) => {
            if (url.endsWith('/user/me/password')) {
                tabB!.onWebSocketClose(1008)
                afterTabB = { token: jsdomStorage.getItem('authToken'), user: jsdomStorage.getItem('user') }
                return jsonResponse(200, { token: 'tok-2', user: { id: 'u1', username: 'ana' }, message: null })
            }
            return jsonResponse(200, {})
        })
        vi.stubGlobal('fetch', fetch)

        // tab A
        await userService.changePassword({ currentPassword: 'long-enough-1', newPassword: 'long-enough-2' })
        expect(afterTabB).toEqual({ token: null, user: '{"id":"u1","username":"ana"}' })
        expect(jsdomStorage.getItem('authToken')).toBe('tok-2')
        expect(JSON.parse(jsdomStorage.getItem('user') ?? 'null')).toEqual({ id: 'u1', username: 'ana' })

        // the next useAuth mount in any tab (tab B's reload, tab A's next route) finds a consistent pair
        const { result } = renderHook(() => useAuth())
        expect(result.current.isAuthenticated).toBe(true)
        const logouts = fetch.mock.calls.filter(([url]) => url.endsWith('/api/auth/logout'))
        expect(logouts).toEqual([])
        expect(jsdomStorage.getItem('authToken')).toBe('tok-2')
    })
})

/** A JWT whose exp is this far from now; the SPA reads exp without checking the signature (as guestResume.test.ts). */
function jwt(expiresInMs: number): string {
    const exp = Math.floor((Date.now() + expiresInMs) / 1000)
    const payload = btoa(JSON.stringify({ sub: 'gost_4821', iat: exp - 120 * 60, exp })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    return `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`
}

describe("a guest's session ends on the landing page (Rulings 7, 32)", () => {
    beforeEach(() => {
        jsdomStorage.setItem('user', '{"id":"g1","username":"gost_4821","guest":true}')
        jsdomStorage.setItem('authToken', 'tok-g')
        jsdomStorage.setItem(GUEST_SECRET_KEY, 'secret-g')
    })

    const forgotten = () => [jsdomStorage.getItem('authToken'), jsdomStorage.getItem('user'), jsdomStorage.getItem(GUEST_SECRET_KEY)]

    test('a 401 forgets the guest (token, user and secret) and opens the landing page, which says so', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sessionExpired()))
        await expect(apiClient.get('/user/me')).rejects.toMatchObject({ status: 401 })
        await vi.waitFor(() => expect(assign).toHaveBeenCalled())
        expect(assign).toHaveBeenCalledTimes(1)
        expect(assign).toHaveBeenCalledWith('/?reason=guest-ended')
        expect(forgotten()).toEqual([null, null, null])
    })

    test('a refused resume ends the guest the same way', async () => {
        jsdomStorage.setItem('authToken', jwt(-60 * 60_000))
        // S8's sign-in with the secret: the server no longer knows this guest
        const fetch = vi.fn().mockResolvedValue(jsonResponse(401, { error: 'Bad credentials', code: 'BAD_CREDENTIALS' }))
        vi.stubGlobal('fetch', fetch)
        await expect(renewIfExpiring()).resolves.toBe(false)
        expect(fetch).toHaveBeenCalledTimes(1)
        expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/auth\/login$/), expect.anything())
        expect(assign).toHaveBeenCalledTimes(1)
        expect(assign).toHaveBeenCalledWith('/?reason=guest-ended')
        expect(forgotten()).toEqual([null, null, null])
    })

    // Ruling 44: someone who never had an account meets no sign-in wall, and is not taken off the page they read;
    // Ruling 48 adds the sign-in, sign-up and forgotten-password forms and the leaderboard, Ruling 62 the waitlist's link
    test.each(['/privacy', '/terms', '/rules', '/confirm-email', '/waitlist/confirm', '/reset-password', '/forgot-password', '/login', '/signup', '/users'])(
        'on %s, a page that needs no session, the guest is forgotten and the reader stays',
        async (pathname) => {
            vi.stubGlobal('location', { ...window.location, pathname, assign })
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sessionExpired()))
            await expect(apiClient.get('/user/me/active-game')).rejects.toMatchObject({ status: 401 })
            await vi.waitFor(() => expect(forgotten()).toEqual([null, null, null]))
            expect(assign).not.toHaveBeenCalled()
        },
    )

    test('anywhere else the guest goes to the landing page, never to sign-in', async () => {
        vi.stubGlobal('location', { ...window.location, pathname: '/lobby/abc', assign })
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sessionExpired()))
        await expect(apiClient.get('/lobbies/abc')).rejects.toMatchObject({ status: 401 })
        await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('/?reason=guest-ended'))
        expect(assign).not.toHaveBeenCalledWith('/login?reason=session-ended')
    })
})
