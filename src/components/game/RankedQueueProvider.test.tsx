import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { RankedQueueProvider } from './RankedQueueProvider'
import { PlayButton } from './PlayButton'
import { QueueStatus } from './QueueStatus'
import { rankedService } from '../../services/rankedService'
import { ApiError } from '../../services/api'
import { captureConsole } from '../../test/captureConsole'

// The tab's socket, faked: frames are delivered by hand and holders are counted.
const socket = vi.hoisted(() => {
    const handlers = new Map<string, Set<(body: string) => void>>()
    return {
        handlers,
        holders: 0,
        state: { isConnected: true, isConnecting: false, error: null as string | null, isReconnecting: false },
        deliver(destination: string, body: unknown) {
            handlers.get(destination)?.forEach((handler) => handler(JSON.stringify(body)))
        },
    }
})
// Only the singleton is faked; every other export of the module (constants, createGameSocket) stays real.
vi.mock('../../services/gameSocket', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../services/gameSocket')>()),
    gameSocket: {
        acquire: () => {
            socket.holders += 1
            let released = false
            return () => {
                if (released) return
                released = true
                socket.holders -= 1
            }
        },
        subscribe: (destination: string, handler: (body: string) => void) => {
            const set = socket.handlers.get(destination) ?? new Set<(body: string) => void>()
            set.add(handler)
            socket.handlers.set(destination, set)
            return () => {
                set.delete(handler)
            }
        },
        publish: () => true,
        getState: () => socket.state,
        onStateChange: () => () => {},
        tokenRevoked: () => {},
    },
}))
vi.mock('../../services/rankedService', () => ({
    rankedService: { joinQueue: vi.fn(), leaveQueue: vi.fn(), declineMatch: vi.fn() },
}))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true, user: { id: 'u1', username: 'ana' } }) }))

const STATUS = '/user/queue/ranked/status'
const MATCH_FOUND = '/user/queue/match-found'
const inQueue = { state: 'IN_QUEUE', estWaitSeconds: -1, queueSize: 1, mmr: 1200 }
function match(id: string) {
    return {
        id,
        teamA: [{ id: 'u1', username: 'ana' }, { id: 'u4', username: 'dan' }],
        teamB: [{ id: 'u2', username: 'bob' }, { id: 'u3', username: 'cy' }],
        originLobby: null, gameMode: 'RANKED', result: null, startTime: null, endTime: null,
    }
}

/** The provider as App mounts it: around the routes, so it outlives every page. */
function renderApp(path: string, playPage: ReactNode = <Link to="/profile">Profile</Link>) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <RankedQueueProvider>
                <Routes>
                    <Route path="/play" element={playPage} />
                    <Route path="/profile" element={<><h1>Profile page</h1><Link to="/play">Play</Link></>} />
                    <Route path="/game/:gameId" element={<h1>Game page</h1>} />
                </Routes>
            </RankedQueueProvider>
        </MemoryRouter>,
    )
}

beforeEach(() => {
    vi.clearAllMocks()
    socket.handlers.clear()
    socket.holders = 0
})
afterEach(() => vi.useRealTimers())

describe('RankedQueueProvider (R-33, R-38)', () => {
    test('holds the socket on /play, and not on other pages while not queued', () => {
        const { unmount } = renderApp('/play')
        expect(socket.holders).toBe(1)
        unmount()
        renderApp('/profile')
        expect(socket.holders).toBe(0)
    })

    test('queued on /play, then on /profile: a match-found frame opens the dialog there', async () => {
        renderApp('/play')
        act(() => socket.deliver(STATUS, inQueue))
        await userEvent.setup().click(screen.getByRole('link', { name: 'Profile' }))
        expect(screen.getByRole('heading', { name: 'Profile page' })).toBeInTheDocument()
        // still queued: the socket stays held away from /play
        expect(socket.holders).toBe(1)
        act(() => socket.deliver(MATCH_FOUND, match('m1')))
        expect(screen.getByRole('heading', { name: 'Match Found!' })).toBeInTheDocument()
    })

    test('the first IN_QUEUE after a reload sets the queued state: Leave is offered', () => {
        renderApp('/play', <PlayButton />)
        expect(screen.getByRole('button', { name: 'Find Match' })).toBeInTheDocument()
        act(() => socket.deliver(STATUS, inQueue))
        expect(screen.getByRole('button', { name: 'Leave Queue' })).toBeInTheDocument()
    })

    test('a 409 "Already queued" on join counts as queued: Leave is offered and no error shows', async () => {
        vi.mocked(rankedService.joinQueue).mockRejectedValue(new ApiError({ status: 409, message: 'Already queued' }))
        renderApp('/play', <PlayButton />)
        await userEvent.setup().click(screen.getByRole('button', { name: 'Find Match' }))
        expect(await screen.findByRole('button', { name: 'Leave Queue' })).toBeInTheDocument()
        expect(screen.queryByText(/Already queued/)).not.toBeInTheDocument()
    })

    test('every found match starts its own 15-s countdown', () => {
        vi.useFakeTimers()
        renderApp('/profile')
        act(() => socket.deliver(MATCH_FOUND, match('m1')))
        // nobody answers: the dialog accepts by itself after 15 s
        act(() => {
            vi.advanceTimersByTime(15_000)
        })
        expect(screen.getByRole('heading', { name: 'Game page' })).toBeInTheDocument()
        act(() => socket.deliver(MATCH_FOUND, match('m2')))
        expect(screen.getByText('Auto-accepting in 15 seconds...')).toBeInTheDocument()
    })
})

describe('Join and leave errors belong to the /play visit', () => {
    /** /play with the queue button and a way out; /profile has the way back. */
    const playPage = <><PlayButton /><Link to="/profile">Profile</Link></>

    async function awayAndBack(user: ReturnType<typeof userEvent.setup>) {
        await user.click(screen.getByRole('link', { name: 'Profile' }))
        expect(screen.getByRole('heading', { name: 'Profile page' })).toBeInTheDocument()
        await user.click(screen.getByRole('link', { name: 'Play' }))
    }

    test('a refused join is not shown again after leaving /play and coming back', async () => {
        captureConsole()
        try {
            vi.mocked(rankedService.joinQueue).mockRejectedValue(new ApiError({ status: 429, message: 'You can queue again in 97 s' }))
            renderApp('/play', playPage)
            const user = userEvent.setup()
            await user.click(screen.getByRole('button', { name: 'Find Match' }))
            expect(await screen.findByText('You can queue again in 97 s')).toBeInTheDocument()
            await awayAndBack(user)
            expect(screen.getByRole('button', { name: 'Find Match' })).toBeInTheDocument()
            expect(screen.queryByText('You can queue again in 97 s')).not.toBeInTheDocument()
        } finally {
            vi.restoreAllMocks()
        }
    })

    test('a failed leave is not shown again after leaving /play and coming back', async () => {
        captureConsole()
        try {
            vi.mocked(rankedService.leaveQueue).mockRejectedValue(new ApiError({ status: 500, message: 'Leave failed' }))
            renderApp('/play', playPage)
            act(() => socket.deliver(STATUS, inQueue))
            const user = userEvent.setup()
            await user.click(screen.getByRole('button', { name: 'Leave Queue' }))
            expect(await screen.findByText('Error: Leave failed')).toBeInTheDocument()
            await awayAndBack(user)
            expect(screen.getByRole('button', { name: 'Leave Queue' })).toBeInTheDocument()
            expect(screen.queryByText('Error: Leave failed')).not.toBeInTheDocument()
        } finally {
            vi.restoreAllMocks()
        }
    })
})

describe('Match Found Decline (R-25)', () => {
    test('Decline calls the decline endpoint for that game and closes the dialog', async () => {
        vi.mocked(rankedService.declineMatch).mockResolvedValue(undefined)
        renderApp('/profile')
        act(() => socket.deliver(MATCH_FOUND, match('m1')))
        await userEvent.setup().click(screen.getByRole('button', { name: 'Decline' }))
        expect(rankedService.declineMatch).toHaveBeenCalledWith('m1')
        await waitFor(() => expect(screen.queryByRole('heading', { name: 'Match Found!' })).not.toBeInTheDocument())
        // the decliner stays where they were
        expect(screen.getByRole('heading', { name: 'Profile page' })).toBeInTheDocument()
    })

    // the copy is the SPA's own: the 409 body may say anything
    test('a 409 says the match can no longer be declined and keeps the dialog', async () => {
        vi.mocked(rankedService.declineMatch).mockRejectedValue(new ApiError({ status: 409, message: 'Conflict' }))
        renderApp('/profile')
        act(() => socket.deliver(MATCH_FOUND, match('m1')))
        await userEvent.setup().click(screen.getByRole('button', { name: 'Decline' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('This match can no longer be declined')
        expect(screen.getByRole('heading', { name: 'Match Found!' })).toBeInTheDocument()
    })
})

describe('Time in queue (spec §4.5)', () => {
    test('counts from the first IN_QUEUE, and starts again for the next queue', () => {
        vi.useFakeTimers()
        renderApp('/play', <QueueStatus />)
        act(() => socket.deliver(STATUS, inQueue))
        act(() => {
            vi.advanceTimersByTime(3000)
        })
        expect(screen.getByText('Time in queue').nextElementSibling).toHaveTextContent(/^0:03$/)
        act(() => socket.deliver(STATUS, { ...inQueue, state: 'CANCELLED' }))
        expect(screen.queryByText('Time in queue')).not.toBeInTheDocument()
        act(() => socket.deliver(STATUS, inQueue))
        expect(screen.getByText('Time in queue').nextElementSibling).toHaveTextContent(/^0:00$/)
    })
})
