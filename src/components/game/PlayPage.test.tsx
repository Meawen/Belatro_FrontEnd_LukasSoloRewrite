import { StrictMode } from 'react'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { JSDOM } from 'jsdom'
import { PlayPage } from './PlayPage'
import { RankedQueueProvider } from './RankedQueueProvider'

const stomp = vi.hoisted(() => ({ clients: [] as unknown[] }))
vi.mock('@stomp/stompjs', () => ({
    Client: class FakeClient {
        constructor(config: unknown) { stomp.clients.push(config) }
        activate() {}
        deactivate() {}
        publish() {}
        subscribe() { return { id: 'sub', unsubscribe() {} } }
    },
}))
vi.mock('sockjs-client', () => ({ default: class FakeSockJS {} }))
vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'u1', username: 'ana' }, isAuthenticated: true, isLoading: false, token: 'tok-1' }),
}))

const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

beforeEach(() => {
    vi.stubGlobal('localStorage', jsdomStorage)
    jsdomStorage.setItem('authToken', 'tok-1')
    // the pre-fix hook gated every connect() on GET /actuator/health
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
})
afterEach(() => {
    jsdomStorage.clear()
    vi.unstubAllGlobals()
})

describe('/play page (B7)', () => {
    test('opens exactly one STOMP client although three components use the socket', async () => {
        render(<StrictMode><MemoryRouter initialEntries={['/play']}><RankedQueueProvider><PlayPage /></RankedQueueProvider></MemoryRouter></StrictMode>)
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)) })
        expect(screen.getByText('RANKED')).toBeInTheDocument()
        expect(stomp.clients).toHaveLength(1)
    })

    // Phase 6's table sends the other three here when a player declines (R-25)
    test('shows the notice the game table passes with a declined match', () => {
        render(
            <MemoryRouter initialEntries={[{ pathname: '/play', state: { notice: "A player declined — you're back in the queue" } }]}>
                <RankedQueueProvider><PlayPage /></RankedQueueProvider>
            </MemoryRouter>,
        )
        expect(screen.getByText("A player declined — you're back in the queue")).toBeInTheDocument()
    })
})
