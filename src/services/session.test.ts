import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
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
import { gameSocket } from './gameSocket'

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
        expect(jsdomStorage.getItem('user')).toBeNull()
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
