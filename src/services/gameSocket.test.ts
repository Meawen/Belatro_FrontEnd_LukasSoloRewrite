import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import type { IMessage, StompSubscription } from '@stomp/stompjs'

const sockjs = vi.hoisted(() => ({ urls: [] as string[] }))
vi.mock('sockjs-client', () => ({
    default: class FakeSockJS {
        constructor(url: string) { sockjs.urls.push(url) }
    },
}))
vi.mock('@stomp/stompjs', () => ({ Client: class FakeClient {} }))

import { JSDOM } from 'jsdom'
import { createGameSocket, stompConfig, type StompClientHandlers, type StompClientLike } from './gameSocket'
import { captureConsole } from '../test/captureConsole'

class FakeClient implements StompClientLike {
    activated = 0
    deactivated = 0
    published: { destination: string; body: string }[] = []
    subs: { destination: string; callback: (m: IMessage) => void; active: boolean }[] = []
    token: string
    handlers: StompClientHandlers
    constructor(token: string, handlers: StompClientHandlers) {
        this.token = token
        this.handlers = handlers
    }
    activate() { this.activated += 1 }
    deactivate() { this.deactivated += 1 }
    publish(params: { destination: string; body: string }) { this.published.push(params) }
    subscribe(destination: string, callback: (m: IMessage) => void): StompSubscription {
        const sub = { destination, callback, active: true }
        this.subs.push(sub)
        return { id: `sub-${this.subs.length}`, unsubscribe: () => { sub.active = false } }
    }
    deliver(destination: string, body: string) {
        this.subs.filter((s) => s.active && s.destination === destination)
            .forEach((s) => s.callback({ body } as IMessage))
    }
    activeSubs(destination: string) {
        return this.subs.filter((s) => s.active && s.destination === destination).length
    }
}

function setup(token: string | null = 'tok-1') {
    const clients: FakeClient[] = []
    let currentToken = token
    const endSession = vi.fn()
    const socket = createGameSocket(
        (t, handlers) => { const c = new FakeClient(t, handlers); clients.push(c); return c },
        () => currentToken,
        endSession,
    )
    return { socket, clients, endSession, setToken: (t: string | null) => { currentToken = t } }
}

beforeEach(() => { vi.useFakeTimers(); sockjs.urls.length = 0 })
afterEach(() => { vi.useRealTimers() })

describe('gameSocket: one STOMP connection per tab', () => {
    test('any number of holders share one client', () => {
        const { socket, clients } = setup()
        socket.acquire(); socket.acquire(); socket.acquire()
        expect(clients).toHaveLength(1)
        expect(clients[0].activated).toBe(1)
        expect(socket.getState()).toEqual({ isConnected: false, isConnecting: true, error: null })
    })

    test('a quick release and re-acquire (React StrictMode) keeps the same client', () => {
        const { socket, clients } = setup()
        const release = socket.acquire()
        release()
        socket.acquire()
        vi.advanceTimersByTime(5000)
        expect(clients).toHaveLength(1)
        expect(clients[0].deactivated).toBe(0)
    })

    test('the last release closes the client after the grace period', () => {
        const { socket, clients } = setup()
        const release = socket.acquire()
        clients[0].handlers.onConnect()
        release()
        vi.advanceTimersByTime(999)
        expect(clients[0].deactivated).toBe(0)
        vi.advanceTimersByTime(1)
        expect(clients[0].deactivated).toBe(1)
        expect(socket.getState().isConnected).toBe(false)
    })

    test('without a token nothing connects and the state says why', () => {
        const { socket, clients } = setup(null)
        socket.acquire()
        expect(clients).toHaveLength(0)
        expect(socket.getState().error).toBe('Authentication required')
    })
})

describe('gameSocket: subscriptions', () => {
    test('subscriptions made before CONNECTED are sent on connect, one per destination', () => {
        const { socket, clients } = setup()
        socket.acquire()
        const a = vi.fn()
        const b = vi.fn()
        socket.subscribe('/topic/games/g1', a)
        socket.subscribe('/topic/games/g1', b)
        expect(clients[0].subs).toHaveLength(0)
        clients[0].handlers.onConnect()
        expect(clients[0].activeSubs('/topic/games/g1')).toBe(1)
        clients[0].deliver('/topic/games/g1', '{"x":1}')
        expect(a).toHaveBeenCalledWith('{"x":1}')
        expect(b).toHaveBeenCalledWith('{"x":1}')
    })

    test('the STOMP subscription lives until its last handler leaves', () => {
        const { socket, clients } = setup()
        socket.acquire()
        clients[0].handlers.onConnect()
        const offA = socket.subscribe('/user/queue/ranked/status', vi.fn())
        const offB = socket.subscribe('/user/queue/ranked/status', vi.fn())
        offA()
        expect(clients[0].activeSubs('/user/queue/ranked/status')).toBe(1)
        offB()
        expect(clients[0].activeSubs('/user/queue/ranked/status')).toBe(0)
    })

    test('publish sends JSON only while connected', () => {
        const { socket, clients } = setup()
        socket.acquire()
        expect(socket.publish('/app/games/g1/refresh', {})).toBe(false)
        clients[0].handlers.onConnect()
        expect(socket.publish('/app/games/g1/bid', { pass: true, trump: null })).toBe(true)
        expect(clients[0].published).toEqual([{ destination: '/app/games/g1/bid', body: '{"pass":true,"trump":null}' }])
    })
})

describe('gameSocket: reconnects', () => {
    test('reconnect() replaces the client with one on the current token and re-subscribes', () => {
        const { socket, clients, setToken } = setup('old-token')
        socket.acquire()
        clients[0].handlers.onConnect()
        socket.subscribe('/user/queue/games/g1', vi.fn())
        setToken('new-token')
        socket.reconnect()
        expect(clients[0].deactivated).toBe(1)
        expect(clients).toHaveLength(2)
        expect(clients[1].token).toBe('new-token')
        clients[1].handlers.onConnect()
        expect(clients[1].activeSubs('/user/queue/games/g1')).toBe(1)
    })

    test('a late close from the replaced client is ignored', () => {
        const { socket, clients } = setup()
        socket.acquire()
        clients[0].handlers.onConnect()
        socket.reconnect()
        clients[1].handlers.onConnect()
        clients[0].handlers.onWebSocketClose(1008)
        expect(socket.getState().isConnected).toBe(true)
        vi.advanceTimersByTime(60000)
        expect(clients).toHaveLength(2)
    })

    test('an abnormal close retries with backoff, at most three times', () => {
        const { socket, clients } = setup()
        socket.acquire()
        clients[0].handlers.onWebSocketClose(1006)
        vi.advanceTimersByTime(4999)
        expect(clients).toHaveLength(1)
        vi.advanceTimersByTime(1)
        expect(clients).toHaveLength(2)
        clients[1].handlers.onWebSocketClose(1006)
        vi.advanceTimersByTime(10000)
        expect(clients).toHaveLength(3)
        clients[2].handlers.onWebSocketClose(1006)
        vi.advanceTimersByTime(20000)
        expect(clients).toHaveLength(4)
        clients[3].handlers.onWebSocketClose(1006)
        vi.advanceTimersByTime(60000)
        expect(clients).toHaveLength(4)
        expect(socket.getState().error).toBe('Failed to connect after multiple attempts')
    })

    test('a revoked session (close 1008) or a STOMP ERROR is not retried', () => {
        const a = setup()
        a.socket.acquire()
        a.clients[0].handlers.onWebSocketClose(1008)
        vi.advanceTimersByTime(60000)
        expect(a.clients).toHaveLength(1)

        const b = setup()
        b.socket.acquire()
        b.clients[0].handlers.onStompError('STOMP CONNECT requires a valid Bearer token')
        b.clients[0].handlers.onWebSocketClose(1002)
        vi.advanceTimersByTime(60000)
        expect(b.clients).toHaveLength(1)
        expect(b.socket.getState().error).toBe('STOMP CONNECT requires a valid Bearer token')
    })

    test('a server going away (1001) or a lost heartbeat (1000) is retried with backoff', () => {
        const { socket, clients } = setup()
        socket.acquire()
        socket.subscribe('/topic/games/g1', vi.fn())
        clients[0].handlers.onConnect()
        // Spring closes every session with 1001 when the backend stops (deploy, restart)
        clients[0].handlers.onWebSocketClose(1001)
        expect(socket.getState().isConnected).toBe(false)
        vi.advanceTimersByTime(5000)
        expect(clients).toHaveLength(2)
        clients[1].handlers.onConnect()
        expect(clients[1].activeSubs('/topic/games/g1')).toBe(1)
        // stompjs closes a socket whose heartbeat stopped; SockJS reports that as 1000
        clients[1].handlers.onWebSocketClose(1000)
        vi.advanceTimersByTime(5000)
        expect(clients).toHaveLength(3)
    })

    test('our own closes are never retried, whatever code the old socket reports', () => {
        const { socket, clients } = setup()
        const release = socket.acquire()
        clients[0].handlers.onConnect()
        socket.reconnect()
        clients[0].handlers.onWebSocketClose(1000)
        vi.advanceTimersByTime(60000)
        expect(clients).toHaveLength(2)
        release()
        vi.advanceTimersByTime(1000)
        expect(clients[1].deactivated).toBe(1)
        clients[1].handlers.onWebSocketClose(1000)
        vi.advanceTimersByTime(60000)
        expect(clients).toHaveLength(2)
    })

    test('every connect reads the token then in storage: a retry never reuses a stale one', () => {
        const { socket, clients, setToken } = setup('tok-1')
        socket.acquire()
        clients[0].handlers.onWebSocketClose(1006)
        setToken('tok-2')
        vi.advanceTimersByTime(5000)
        expect(clients[1].token).toBe('tok-2')
        clients[1].handlers.onWebSocketClose(1006)
        setToken(null)
        vi.advanceTimersByTime(10000)
        expect(clients).toHaveLength(2)
        expect(socket.getState().error).toBe('Authentication required')
    })
})

describe('gameSocket: a session the server ended (close 1008)', () => {
    test('signs the tab out like a 401: no retry, and the state says why', () => {
        const { socket, clients, endSession } = setup('tok-1')
        socket.acquire()
        clients[0].handlers.onConnect()
        clients[0].handlers.onWebSocketClose(1008)
        expect(endSession).toHaveBeenCalledTimes(1)
        expect(socket.getState()).toEqual({
            isConnected: false,
            isConnecting: false,
            error: 'Your session ended — please sign in again',
        })
        vi.advanceTimersByTime(60000)
        expect(clients).toHaveLength(1)
    })

    test('a newer token in storage (password changed in another tab) carries on with it', () => {
        const { socket, clients, endSession, setToken } = setup('old-token')
        socket.acquire()
        clients[0].handlers.onConnect()
        socket.subscribe('/user/queue/games/g1', vi.fn())
        setToken('new-token')
        clients[0].handlers.onWebSocketClose(1008)
        expect(endSession).not.toHaveBeenCalled()
        expect(clients).toHaveLength(2)
        expect(clients[1].token).toBe('new-token')
        clients[1].handlers.onConnect()
        expect(clients[1].activeSubs('/user/queue/games/g1')).toBe(1)
        expect(socket.getState().error).toBeNull()
    })

    test('by default it forgets the stored token and reloads into the login page', () => {
        const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window
        const assign = vi.fn()
        vi.stubGlobal('localStorage', jsdomStorage)
        vi.stubGlobal('location', { ...window.location, assign })
        try {
            jsdomStorage.setItem('authToken', 'tok-1')
            const clients: FakeClient[] = []
            const socket = createGameSocket((t, handlers) => { const c = new FakeClient(t, handlers); clients.push(c); return c })
            socket.acquire()
            expect(clients[0].token).toBe('tok-1')
            clients[0].handlers.onWebSocketClose(1008)
            expect(jsdomStorage.getItem('authToken')).toBeNull()
            expect(assign).toHaveBeenCalledWith('/login?reason=session-ended')
        } finally {
            vi.unstubAllGlobals()
        }
    })
})

describe('stompConfig', () => {
    test('identity travels only as the Bearer token on CONNECT; the socket URL carries no user', () => {
        const config = stompConfig('tok-9', { onConnect: vi.fn(), onStompError: vi.fn(), onWebSocketClose: vi.fn() })
        expect(config.connectHeaders).toEqual({ Authorization: 'Bearer tok-9' })
        config.webSocketFactory?.()
        expect(sockjs.urls).toEqual(['/ws'])
    })

    test('connecting logs neither the CONNECT frame nor its Bearer token', async () => {
        const TOKEN = 'secret.jwt.value'
        const { Client: StompClient } = await vi.importActual<typeof import('@stomp/stompjs')>('@stomp/stompjs')
        const sent: string[] = []
        const ws = {
            url: '/ws',
            readyState: 0,
            binaryType: '',
            onopen: null as (() => void) | null,
            onclose: null,
            onerror: null,
            onmessage: null,
            send: (frame: string) => { sent.push(frame) },
            close: () => {},
        }
        const logs = captureConsole()
        try {
            const socket = createGameSocket(
                (token, handlers) => new StompClient({
                    ...stompConfig(token, handlers),
                    webSocketFactory: () => ws as unknown as WebSocket,
                }),
                () => TOKEN,
                vi.fn(),
            )
            socket.acquire()
            await vi.waitFor(() => expect(ws.onopen).toBeTypeOf('function'))
            ws.readyState = 1
            ws.onopen?.()
            // the real stompjs Client did send the CONNECT frame, token included...
            expect(sent.join('\n')).toContain(`Authorization:Bearer ${TOKEN}`)
            // ...and nothing it did reached the console
            expect(logs.leaked(TOKEN)).toEqual([])
        } finally {
            vi.restoreAllMocks()
        }
    })
})
