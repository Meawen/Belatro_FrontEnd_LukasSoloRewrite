import { describe, test, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import GamePageConnected from './GamePageConnected'
import { useBelatroGame } from '../../hooks/useBelatroGame'
import type { PublicGameView } from '../../types/game'
import { captureConsole } from '../../test/captureConsole'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u3', username: 'carol' } }) }))
vi.mock('../../hooks/useBelatroGame', () => ({ useBelatroGame: vi.fn() }))
// The banner reads the real socket store; here it is a marker that shows where the page mounts it
vi.mock('./ReconnectBanner', () => ({ ReconnectBanner: () => <p>Reconnect banner slot</p> }))

const actions = { bidTrump: vi.fn(), passBid: vi.fn(), play: vi.fn(), challenge: vi.fn() }
const seating = ['alice', 'bob', 'carol', 'dave'].map((id) => ({ id, cardsLeft: 6 }))
const publicView = {
    gameId: 'g1', gameState: 'BIDDING', bids: [],
    currentTrick: { leadPlayerId: '_NO_LEAD_', trump: null, plays: {} },
    teamAScore: 0, teamBScore: 0, teamA: [], teamB: [], challengeUsedByPlayer: {}, winnerTeamId: null,
    tieBreaker: false, seatingOrder: seating, declarations: {}, belaDeclaredByPlayer: {}, challengeWindowExpiresAt: null,
} as PublicGameView

function renderPage() {
    render(
        <MemoryRouter initialEntries={['/game/g1']}>
            <Routes><Route path="/game/:gameId" element={<GamePageConnected />} /></Routes>
        </MemoryRouter>,
    )
}

/** Like the real hook: the view lives in state, and a new game id does not reset it. */
function useGameStateKeptAcrossIds(gameId: string) {
    const [view] = useState<PublicGameView>(() => ({
        ...publicView,
        gameId,
        gameState: gameId === 'g1' ? 'COMPLETED' : 'BIDDING',
    }))
    return { publicView: view, privateView: null, isConnected: true, connectionError: null, error: null, actions }
}

/** Stands in for PlayPage (Phase 7): shows the notice the table passed along, and how it got here. */
function PlayPageStub() {
    const location = useLocation()
    const navigationType = useNavigationType()
    return <p data-testid="play-notice" data-navigation={navigationType}>{(location.state as { notice?: string } | null)?.notice}</p>
}

beforeEach(() => vi.clearAllMocks())

describe('GamePageConnected', () => {
    test('waits for the connection and the first snapshot', () => {
        vi.mocked(useBelatroGame).mockReturnValue({
            publicView: null, privateView: null, isConnected: false, connectionError: null, error: null, actions,
        })
        renderPage()
        expect(screen.getByText('Connecting to game...')).toBeInTheDocument()
        expect(vi.mocked(useBelatroGame).mock.calls[0][0]).toBe('g1')
    })

    test('renders the table for the signed-in player', () => {
        vi.mocked(useBelatroGame).mockReturnValue({
            publicView, privateView: null, isConnected: true, connectionError: null, error: null, actions,
        })
        renderPage()
        expect(screen.getByTestId('game-phase')).toHaveTextContent('Bidding')
        expect(screen.getAllByTestId(/^seat-/)[0]).toHaveAttribute('data-testid', 'seat-carol')
    })

    test("the table's bid buttons call the game's own actions", async () => {
        const user = userEvent.setup()
        vi.mocked(useBelatroGame).mockReturnValue({
            publicView,
            privateView: { publicPart: publicView, hand: [], yourTurn: true, challengeUsed: false },
            isConnected: true, connectionError: null, error: null, actions,
        })
        renderPage()
        await user.click(screen.getByRole('button', { name: 'Pass' }))
        expect(actions.passBid).toHaveBeenCalledTimes(1)
        await user.click(screen.getByRole('button', { name: 'Call Karo' }))
        expect(actions.bidTrump).toHaveBeenCalledTimes(1)
        expect(actions.bidTrump).toHaveBeenCalledWith('KARA')
        expect(actions.play).not.toHaveBeenCalled()
        expect(actions.challenge).not.toHaveBeenCalled()
    })

    test("moving to another game id shows that game, never the previous game's view", async () => {
        const user = userEvent.setup()
        vi.mocked(useBelatroGame).mockImplementation(useGameStateKeptAcrossIds)
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
        expect(vi.mocked(useBelatroGame).mock.lastCall?.[0]).toBe('g2')
    })

    test('the reconnect banner sits on the loading screen and above the table (R-30)', () => {
        vi.mocked(useBelatroGame).mockReturnValue({
            publicView: null, privateView: null, isConnected: false, connectionError: null, error: null, actions,
        })
        renderPage()
        expect(screen.getByText('Reconnect banner slot')).toBeInTheDocument()
        cleanup()
        vi.mocked(useBelatroGame).mockReturnValue({
            publicView, privateView: null, isConnected: true, connectionError: null, error: null, actions,
        })
        renderPage()
        expect(screen.getByText('Reconnect banner slot')).toBeInTheDocument()
        expect(screen.getByTestId('game-phase')).toBeInTheDocument()
    })

    test("a game that isn't yours or has ended: the message and a way back, no spinner (R-35)", async () => {
        const user = userEvent.setup()
        vi.mocked(useBelatroGame).mockReturnValue({
            publicView: null, privateView: null, isConnected: true, connectionError: null, error: null,
            notAvailable: true, actions,
        })
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
            vi.mocked(useBelatroGame).mockImplementation(() => { throw new Error('unexpected view shape') })
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
        vi.mocked(useBelatroGame).mockReturnValue({
            publicView: { ...publicView, gameState: 'CANCELLED', endReason: 'DECLINED', forfeitTeamId: null } as PublicGameView,
            privateView: null, isConnected: true, connectionError: null, error: null, actions,
        })
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
})
