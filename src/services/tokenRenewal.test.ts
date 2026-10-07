import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'
import type { StompClientHandlers } from './gameSocket'
import { captureConsole } from '../test/captureConsole'

// The real socket module (its session decision and default sign-out included) on fake STOMP
// clients, as in session.test.ts
const sockets = vi.hoisted(() => ({
    clients: [] as { token: string; handlers: StompClientHandlers; deactivated: number }[],
}))
vi.mock('./gameSocket', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./gameSocket')>()
    return {
        ...actual,
        gameSocket: actual.createGameSocket((token, handlers) => {
            const client = { token, handlers, deactivated: 0 }
            sockets.clients.push(client)
            return {
                activate() {},
                deactivate() { client.deactivated += 1 },
                publish() {},
                subscribe: () => ({ id: 'sub', unsubscribe() {} }),
            }
        }),
    }
})

import { gameSocket } from './gameSocket'
import { renewIfExpiring, startTokenRenewal } from './tokenRenewal'

// Node 26's own localStorage global is unusable here; borrow jsdom's (see api.test.ts)
const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

const NOW = Date.UTC(2026, 9, 5, 20, 0, 0)

/** A JWT whose payload carries `exp` (seconds since the epoch). The SPA never checks the signature. */
function tokenExpiringIn(ms: number, id: string): string {
    const payload = btoa(JSON.stringify({ sub: 'ana', sv: 3, jti: id, exp: Math.floor((NOW + ms) / 1000) }))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    return `eyJhbGciOiJIUzI1NiJ9.${payload}.signature-${id}`
}

const OLD = tokenExpiringIn(10 * 60_000, 'old')
const FRESH = tokenExpiringIn(120 * 60_000, 'fresh')

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

const renewed = () => jsonResponse(200, { token: FRESH, user: { id: 'u1', username: 'ana' }, message: null })

let assign: ReturnType<typeof vi.fn>
const held: (() => void)[] = []

/** Hold the game socket as a mounted game page does; afterEach lets go. Returns its STOMP client. */
function hold() {
    held.push(gameSocket.acquire())
    return sockets.clients[sockets.clients.length - 1]
}

beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    assign = vi.fn()
    vi.stubGlobal('localStorage', jsdomStorage)
    vi.stubGlobal('location', { ...window.location, assign })
    jsdomStorage.setItem('user', '{"id":"u1","username":"ana"}')
    sockets.clients.length = 0
})

afterEach(() => {
    held.splice(0).forEach((release) => release())
    vi.advanceTimersByTime(1000)
    gameSocket.disconnect()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    jsdomStorage.clear()
})

describe('renewIfExpiring (R-10)', () => {
    test('a token 10 minutes from expiry is renewed: the new token is stored and the game socket reopens on it', async () => {
        jsdomStorage.setItem('authToken', OLD)
        const socket = hold()
        socket.handlers.onConnect()
        const fetch = vi.fn().mockResolvedValue(renewed())
        vi.stubGlobal('fetch', fetch)

        await expect(renewIfExpiring()).resolves.toBe(true)

        expect(fetch).toHaveBeenCalledTimes(1)
        expect(fetch).toHaveBeenCalledWith('/backend/user/me/token', expect.objectContaining({ method: 'POST' }))
        expect(fetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${OLD}`)
        expect(jsdomStorage.getItem('authToken')).toBe(FRESH)
        expect(socket.deactivated).toBe(1)
        expect(sockets.clients).toHaveLength(2)
        expect(sockets.clients[1].token).toBe(FRESH)
    })

    test('15 minutes or more left, more than half of a short token\'s life left, no token, or an unreadable one: no request', async () => {
        const fetch = vi.fn()
        vi.stubGlobal('fetch', fetch)
        // a 160-s token with 100 s left: renewal waits for the last half (80 s)
        const shortLived = `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ sub: 'ana', sv: 3, jti: 'short', iat: Math.floor(NOW / 1000) - 60, exp: Math.floor(NOW / 1000) + 100 })).replace(/=+$/, '')}.signature-short`
        for (const stored of [tokenExpiringIn(15 * 60_000, 'later'), shortLived, null, 'not-a-jwt']) {
            if (stored === null) jsdomStorage.removeItem('authToken')
            else jsdomStorage.setItem('authToken', stored)
            await expect(renewIfExpiring()).resolves.toBe(false)
        }
        expect(fetch).not.toHaveBeenCalled()
    })

    test('a 1008 on the old socket after renewal does not route to /login', async () => {
        jsdomStorage.setItem('authToken', OLD)
        const oldSocket = hold()
        oldSocket.handlers.onConnect()
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(renewed()))
        await renewIfExpiring()
        // the server's expiry sweep closes the old token's socket with 1008
        oldSocket.handlers.onWebSocketClose(1008)
        expect(assign).not.toHaveBeenCalled()
        expect(jsdomStorage.getItem('authToken')).toBe(FRESH)
        expect(gameSocket.getState().error).toBeNull()
    })

    test('a socket still on the old token when another tab renewed carries on with the new token at its 1008', () => {
        jsdomStorage.setItem('authToken', OLD)
        const socket = hold()
        socket.handlers.onConnect()
        // another tab of this browser renewed: the shared storage holds the new token
        jsdomStorage.setItem('authToken', FRESH)
        socket.handlers.onWebSocketClose(1008)
        expect(assign).not.toHaveBeenCalled()
        expect(sockets.clients).toHaveLength(2)
        expect(sockets.clients[1].token).toBe(FRESH)
    })

    test('a network error or a 5xx never signs the tab out; the next trigger tries again', async () => {
        captureConsole()
        jsdomStorage.setItem('authToken', OLD)
        const socket = hold()
        socket.handlers.onConnect()
        const fetch = vi.fn()
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce(jsonResponse(503, { error: 'Service temporarily unavailable' }))
            .mockResolvedValueOnce(jsonResponse(500, { error: 'Internal Server Error' }))
            .mockResolvedValueOnce(renewed())
        vi.stubGlobal('fetch', fetch)
        for (let attempt = 0; attempt < 3; attempt++) {
            await expect(renewIfExpiring()).resolves.toBe(false)
            expect(jsdomStorage.getItem('authToken')).toBe(OLD)
        }
        expect(assign).not.toHaveBeenCalled()
        expect(sockets.clients).toHaveLength(1)
        await expect(renewIfExpiring()).resolves.toBe(true)
        expect(jsdomStorage.getItem('authToken')).toBe(FRESH)
    })

    test('a 401 ends the session the normal way, through api.ts', async () => {
        captureConsole()
        jsdomStorage.setItem('authToken', OLD)
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { error: 'Session expired, please sign in again' })))
        await expect(renewIfExpiring()).resolves.toBe(false)
        expect(assign).toHaveBeenCalledTimes(1)
        expect(assign).toHaveBeenCalledWith('/login?reason=session-ended')
        expect(jsdomStorage.getItem('authToken')).toBeNull()
    })

    test('at most one renewal is in flight', async () => {
        jsdomStorage.setItem('authToken', OLD)
        let answer: (response: Response) => void = () => {}
        const fetch = vi.fn(() => new Promise<Response>((resolve) => { answer = resolve }))
        vi.stubGlobal('fetch', fetch)
        const first = renewIfExpiring()
        const second = renewIfExpiring()
        answer(renewed())
        await expect(first).resolves.toBe(true)
        await expect(second).resolves.toBe(true)
        expect(fetch).toHaveBeenCalledTimes(1)
    })

    test('a token replaced while the renewal was out (a sign-out, another tab) is kept', async () => {
        jsdomStorage.setItem('authToken', OLD)
        const otherTab = tokenExpiringIn(119 * 60_000, 'other-tab')
        vi.stubGlobal('fetch', vi.fn(async () => {
            jsdomStorage.setItem('authToken', otherTab)
            return renewed()
        }))
        await expect(renewIfExpiring()).resolves.toBe(false)
        expect(jsdomStorage.getItem('authToken')).toBe(otherTab)
    })
})

describe('startTokenRenewal (R-10)', () => {
    test('checks at once, when the tab is shown again and every minute; stop() removes all three', async () => {
        captureConsole()
        jsdomStorage.setItem('authToken', OLD)
        // every attempt fails, so the token stays near its expiry and every trigger shows as a request
        const fetch = vi.fn().mockResolvedValue(jsonResponse(503, { error: 'Service temporarily unavailable' }))
        vi.stubGlobal('fetch', fetch)
        const stop = startTokenRenewal()
        await vi.advanceTimersByTimeAsync(0)
        expect(fetch).toHaveBeenCalledTimes(1)
        // jsdom pretends to be visible
        document.dispatchEvent(new Event('visibilitychange'))
        await vi.advanceTimersByTimeAsync(0)
        expect(fetch).toHaveBeenCalledTimes(2)
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
        try {
            document.dispatchEvent(new Event('visibilitychange'))
            await vi.advanceTimersByTimeAsync(0)
            expect(fetch).toHaveBeenCalledTimes(2)
        } finally {
            Reflect.deleteProperty(document, 'visibilityState')
        }
        await vi.advanceTimersByTimeAsync(60_000)
        expect(fetch).toHaveBeenCalledTimes(3)
        stop()
        document.dispatchEvent(new Event('visibilitychange'))
        await vi.advanceTimersByTimeAsync(180_000)
        expect(fetch).toHaveBeenCalledTimes(3)
    })
})
