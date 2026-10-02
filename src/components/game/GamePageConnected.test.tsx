import { describe, test, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import GamePageConnected from './GamePageConnected'
import { useBelatroGame } from '../../hooks/useBelatroGame'
import type { PublicGameView } from '../../types/game'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u3', username: 'carol' } }) }))
vi.mock('../../hooks/useBelatroGame', () => ({ useBelatroGame: vi.fn() }))

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
        expect(screen.getByTestId('game-phase')).toHaveTextContent('BIDDING')
        expect(screen.getAllByTestId(/^seat-/)[0]).toHaveAttribute('data-testid', 'seat-carol')
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
        expect(screen.getByTestId('game-phase')).toHaveTextContent('COMPLETED')
        await user.click(screen.getByRole('link', { name: 'Next game' }))
        expect(screen.getByTestId('game-phase')).toHaveTextContent('BIDDING')
        expect(vi.mocked(useBelatroGame).mock.lastCall?.[0]).toBe('g2')
    })
})
