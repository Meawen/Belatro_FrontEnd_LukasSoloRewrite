import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import GamePageConnected from './GamePageConnected'
import { useGameViews, type GameViews } from '../../hooks/useGameViews'
import type { BoardState } from '../board/model/accept'
import type { PrivateGameView, PublicGameView } from '../../types/game'
import { captureConsole } from '../../test/captureConsole'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u3', username: 'carol' } }) }))
vi.mock('../../hooks/useGameViews', () => ({ useGameViews: vi.fn() }))
// The banner reads the real socket store; here it is a marker that shows where the page mounts it
vi.mock('./ReconnectBanner', () => ({ ReconnectBanner: () => <p>Reconnect banner slot</p> }))
// useRematch holds its own socket channel; here it is a stub the tests read back
const rematchMock = vi.hoisted(() => ({
    useRematch: vi.fn(),
    state: { votes: 0, cancelledBy: null, expired: false, playAgain: vi.fn(), leave: vi.fn() },
}))
vi.mock('../../hooks/useRematch', () => ({ useRematch: rematchMock.useRematch }))
// useMatchHands asks the REST API for the stored moves; here nothing is stored yet
vi.mock('../../hooks/useMatchHands', () => ({ useMatchHands: () => ({ hands: null, ended: null, loading: false, error: null, refresh: vi.fn() }) }))
const art = vi.hoisted(() => ({ preloadCardArt: vi.fn(() => Promise.resolve()) }))
vi.mock('../../services/cardArt', async (importOriginal) => ({ ...(await importOriginal<object>()), preloadCardArt: art.preloadCardArt }))

const actions = { bidTrump: vi.fn(), passBid: vi.fn(), play: vi.fn(), challenge: vi.fn() }
const seating = ['alice', 'bob', 'carol', 'dave'].map((id) => ({ id, cardsLeft: 6 }))
const publicView = {
    gameId: 'g1', gameState: 'BIDDING', bids: [],
    currentTrick: { leadPlayerId: '_NO_LEAD_', trump: null, plays: {} },
    teamAScore: 0, teamBScore: 0, teamA: [], teamB: [], challengeUsedByPlayer: {}, winnerTeamId: null,
    tieBreaker: false, seatingOrder: seating, declarations: {}, belaDeclaredByPlayer: {}, challengeWindowExpiresAt: null,
} as unknown as PublicGameView

/** What useGameViews returns for these views: the accepted state the board renders, and its two parts. */
function views(pub: PublicGameView | null, priv: PrivateGameView | null = null, more: Partial<GameViews> = {}): GameViews {
    const view: BoardState | null = pub ? { publicView: pub, privateView: priv, receivedAt: 1, skew: 0, source: 'live' } : null
    return {
        view, snapshot: false, publicView: pub, privateView: priv,
        isConnected: true, connectionError: null, error: null, notAvailable: false, actions, ...more,
    }
}

function renderPage() {
    render(
        <MemoryRouter initialEntries={['/game/g1']}>
            <Routes><Route path="/game/:gameId" element={<GamePageConnected />} /></Routes>
        </MemoryRouter>,
    )
}

/** Like the real hook: the view lives in state, and a new game id does not reset it. */
function useGameStateKeptAcrossIds(gameId: string): GameViews {
    const [view] = useState<PublicGameView>(() => ({
        ...publicView,
        gameId,
        gameState: gameId === 'g1' ? 'COMPLETED' : 'BIDDING',
    }))
    return views(view)
}

/** Stands in for PlayPage (Phase 7): shows the notice the table passed along, and how it got here. */
function PlayPageStub() {
    const location = useLocation()
    const navigationType = useNavigationType()
    return <p data-testid="play-notice" data-navigation={navigationType}>{(location.state as { notice?: string } | null)?.notice}</p>
}

// the whole board renders in every test: slower than a 5-s default on a busy machine
vi.setConfig({ testTimeout: 20_000 })

beforeEach(() => {
    vi.clearAllMocks()
    rematchMock.useRematch.mockReturnValue(rematchMock.state)
    // jsdom draws nothing: no 2D context for the arena's canvas
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => {
    vi.restoreAllMocks()
})

describe('GamePageConnected', () => {
    test('waits for the connection and the first snapshot', () => {
        vi.mocked(useGameViews).mockReturnValue(views(null, null, { isConnected: false }))
        renderPage()
        expect(screen.getByText('Connecting to game...')).toBeInTheDocument()
        expect(vi.mocked(useGameViews).mock.calls[0][0]).toBe('g1')
    })

    test('renders the table for the signed-in player', () => {
        vi.mocked(useGameViews).mockReturnValue(views(publicView))
        renderPage()
        expect(screen.getByTestId('game-phase')).toHaveTextContent('Bidding')
        expect(screen.getAllByTestId(/^seat-/)[0]).toHaveAttribute('data-testid', 'seat-carol')
        expect(art.preloadCardArt).toHaveBeenCalled()
    })

    test("the table's bid buttons call the game's own actions", async () => {
        const user = userEvent.setup()
        vi.mocked(useGameViews).mockReturnValue(views(publicView, { publicPart: publicView, hand: [], yourTurn: true, challengeUsed: false }))
        renderPage()
        await user.click(screen.getByRole('button', { name: 'Pass' }))
        expect(actions.passBid).toHaveBeenCalledTimes(1)
        // the stub says the pass didn't go out (it returns nothing), so the panel stays free for the next bid
        await user.click(screen.getByRole('button', { name: 'Call Karo' }))
        expect(actions.bidTrump).toHaveBeenCalledTimes(1)
        expect(actions.bidTrump).toHaveBeenCalledWith('KARA')
        expect(actions.play).not.toHaveBeenCalled()
        expect(actions.challenge).not.toHaveBeenCalled()
    })

    test("moving to another game id shows that game, never the previous game's view", async () => {
        const user = userEvent.setup()
        vi.mocked(useGameViews).mockImplementation(useGameStateKeptAcrossIds)
        render(
            <MemoryRouter initialEntries={['/game/g1']}>
                <Routes>
                    <Route path="/game/:gameId" element={<><GamePageConnected /><Link to="/game/g2">Next game</Link></>} />
                </Routes>
            </MemoryRouter>,
        )
        expect(screen.getByTestId('game-phase')).toHaveTextContent('Game over')
        await user.click(screen.getByRole('link', { name: 'Next game' }))
        expect(screen.getByTestId('game-phase')).toHaveTextContent('Bidding')
        expect(vi.mocked(useGameViews).mock.lastCall?.[0]).toBe('g2')
    })

    test('the reconnect banner sits on the loading screen and above the table (R-30)', () => {
        vi.mocked(useGameViews).mockReturnValue(views(null, null, { isConnected: false }))
        renderPage()
        expect(screen.getByText('Reconnect banner slot')).toBeInTheDocument()
        cleanup()
        vi.mocked(useGameViews).mockReturnValue(views(publicView))
        renderPage()
        expect(screen.getByText('Reconnect banner slot')).toBeInTheDocument()
        expect(screen.getByTestId('game-phase')).toBeInTheDocument()
    })

    test("a game that isn't yours or has ended: the message and a way back, no spinner (R-35)", async () => {
        const user = userEvent.setup()
        vi.mocked(useGameViews).mockReturnValue(views(null, null, { notAvailable: true }))
        render(
            <MemoryRouter initialEntries={['/game/g1']}>
                <Routes>
                    <Route path="/game/:gameId" element={<GamePageConnected />} />
                    <Route path="/dashboard" element={<p>Dashboard page</p>} />
                </Routes>
            </MemoryRouter>,
        )
        expect(screen.getByText("This game isn't yours or has ended")).toBeInTheDocument()
        expect(screen.queryByText('Loading game state...')).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Back to dashboard' }))
        expect(screen.getByText('Dashboard page')).toBeInTheDocument()
    })

    test('a crash in the table shows the error screen and leaves the app shell standing (R-29)', () => {
        captureConsole()
        try {
            vi.mocked(useGameViews).mockImplementation(() => { throw new Error('unexpected view shape') })
            render(
                <MemoryRouter initialEntries={['/game/g1']}>
                    <nav>App shell</nav>
                    <Routes><Route path="/game/:gameId" element={<GamePageConnected />} /></Routes>
                </MemoryRouter>,
            )
            expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Go to dashboard' })).toBeInTheDocument()
            expect(screen.getByText('App shell')).toBeInTheDocument()
        } finally {
            vi.restoreAllMocks()
        }
    })

    test('a declined ranked match goes back to /play with the notice, replacing the game page (R-25)', () => {
        vi.mocked(useGameViews).mockReturnValue(views({ ...publicView, gameState: 'CANCELLED', endReason: 'DECLINED', forfeitTeamId: null }))
        render(
            <MemoryRouter initialEntries={['/game/g1']}>
                <Routes>
                    <Route path="/game/:gameId" element={<GamePageConnected />} />
                    <Route path="/play" element={<PlayPageStub />} />
                </Routes>
            </MemoryRouter>,
        )
        const play = screen.getByTestId('play-notice')
        expect(play).toHaveTextContent("A player declined — you're back in the queue")
        expect(play).toHaveAttribute('data-navigation', 'REPLACE')
    })

    test('a ranked forfeit keeps its table: only a declined match goes back to /play', () => {
        vi.mocked(useGameViews).mockReturnValue(views({ ...publicView, gameState: 'CANCELLED', endReason: 'FORFEIT', forfeitTeamId: 'B' }))
        render(
            <MemoryRouter initialEntries={['/game/g1']}>
                <Routes>
                    <Route path="/game/:gameId" element={<GamePageConnected />} />
                    <Route path="/play" element={<PlayPageStub />} />
                </Routes>
            </MemoryRouter>,
        )
        expect(screen.getByRole('heading', { name: 'Game over' })).toBeInTheDocument()
        expect(screen.getByTestId('end-reason')).toHaveTextContent('Team B forfeited — Team A wins')
        expect(screen.queryByTestId('play-notice')).not.toBeInTheDocument()
    })

    test('the game-over screen gets the rematch, offered only once the game is over (R-45)', async () => {
        const user = userEvent.setup()
        vi.mocked(useGameViews).mockReturnValue(views(publicView))
        renderPage()
        expect(rematchMock.useRematch).toHaveBeenLastCalledWith('g1', false)
        cleanup()
        vi.mocked(useGameViews).mockReturnValue(views({ ...publicView, gameState: 'COMPLETED', winnerTeamId: 'A' }))
        renderPage()
        expect(rematchMock.useRematch).toHaveBeenLastCalledWith('g1', true)
        await user.click(screen.getByRole('button', { name: 'Play again' }))
        expect(rematchMock.state.playAgain).toHaveBeenCalledTimes(1)
    })
})
