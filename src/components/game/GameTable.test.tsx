import { describe, test, expect, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameTable, type GameTableProps } from './GameTable'
import type { GameCard, PrivateGameView, PublicGameView } from '../../types/game'

const seating = ['alice', 'bob', 'carol', 'dave'].map((id) => ({ id, cardsLeft: 6 }))

function view(overrides: Partial<PublicGameView> = {}): PublicGameView {
    return {
        gameId: 'g1',
        gameState: 'BIDDING',
        bids: [],
        currentTrick: { leadPlayerId: '_NO_LEAD_', trump: null, plays: {} },
        teamAScore: 0,
        teamBScore: 0,
        teamA: [seating[0], seating[2]],
        teamB: [seating[1], seating[3]],
        challengeUsedByPlayer: {},
        winnerTeamId: null,
        tieBreaker: false,
        seatingOrder: seating,
        declarations: {},
        belaDeclaredByPlayer: {},
        challengeWindowExpiresAt: null,
        ...overrides,
    }
}

const myCards: GameCard[] = [
    { boja: 'HERC', rank: 'AS' },
    { boja: 'HERC', rank: 'SEDMICA' },
    { boja: 'KARA', rank: 'DESETKA' },
    { boja: 'PIK', rank: 'KRALJ' },
    { boja: 'TREF', rank: 'BABA' },
    { boja: 'TREF', rank: 'DECKO' },
]

function privateFor(publicPart: PublicGameView, yourTurn: boolean): PrivateGameView {
    return { publicPart, hand: myCards, yourTurn, challengeUsed: false }
}

function renderTable(publicView: PublicGameView, yourTurn: boolean, extra: Partial<GameTableProps> = {}) {
    const handlers = {
        onPass: vi.fn(), onCallTrump: vi.fn(), onPlayCard: vi.fn(), onChallenge: vi.fn(), onLeave: vi.fn(),
    }
    render(
        <GameTable
            publicView={publicView}
            privateView={privateFor(publicView, yourTurn)}
            me="carol"
            error={null}
            {...handlers}
            {...extra}
        />,
    )
    return handlers
}

describe('GameTable', () => {
    test('seats start with me at the bottom and follow the turn order', () => {
        renderTable(view(), false)
        const order = screen.getAllByTestId(/^seat-/).map((el) => el.getAttribute('data-testid'))
        expect(order).toEqual(['seat-carol', 'seat-dave', 'seat-alice', 'seat-bob'])
        expect(within(screen.getByTestId('seat-carol')).getByText('You')).toBeInTheDocument()
        expect(screen.getByTestId('cards-left-dave')).toHaveTextContent('6')
    })

    test('on my bidding turn I can pass or call any suit; my cards stay locked', async () => {
        const user = userEvent.setup()
        const handlers = renderTable(view(), true)
        expect(screen.getByTestId('game-phase')).toHaveTextContent('BIDDING')
        expect(screen.getByTestId('your-turn')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Pass' }))
        expect(handlers.onPass).toHaveBeenCalledTimes(1)
        await user.click(screen.getByRole('button', { name: 'Call Herc' }))
        expect(handlers.onCallTrump).toHaveBeenCalledWith('HERC')
        await user.click(screen.getByRole('button', { name: 'Call Karo' }))
        expect(handlers.onCallTrump).toHaveBeenLastCalledWith('KARA')
        expect(screen.getAllByTestId('hand-card')).toHaveLength(6)
        screen.getAllByTestId('hand-card').forEach((card) => expect(card).toBeDisabled())
    })

    test('not my turn: no bid panel, a waiting note', () => {
        renderTable(view(), false)
        expect(screen.queryByRole('button', { name: 'Pass' })).not.toBeInTheDocument()
        expect(screen.queryByTestId('your-turn')).not.toBeInTheDocument()
        expect(screen.getByText('Waiting for other players...')).toBeInTheDocument()
    })

    test('on my playing turn a click plays that card; the trick shows at each seat; trump and bids are visible', async () => {
        const user = userEvent.setup()
        const playing = view({
            gameState: 'PLAYING',
            bids: [
                { playerId: 'alice', action: 'PASS', selectedTrump: null },
                { playerId: 'bob', action: 'CALL_TRUMP', selectedTrump: 'HERC' },
            ],
            currentTrick: { leadPlayerId: 'dave', trump: 'HERC', plays: { dave: { boja: 'PIK', rank: 'AS' } } },
        })
        const handlers = renderTable(playing, true)
        expect(screen.queryByRole('button', { name: 'Pass' })).not.toBeInTheDocument()
        expect(screen.getByTestId('trump')).toHaveTextContent('Herc')
        expect(screen.getAllByTestId('bid').map((el) => el.textContent)).toEqual(['alice: Pass', 'bob: Herc'])
        expect(within(screen.getByTestId('seat-dave')).getByTestId('trick-card')).toHaveAttribute('data-card', 'PIK-AS')
        await user.click(screen.getByRole('button', { name: 'As Herc' }))
        expect(handlers.onPlayCard).toHaveBeenCalledWith({ boja: 'HERC', rank: 'AS' })
    })

    test("while bidding the last hand's trick and its trump are not shown", () => {
        // The backend keeps the previous hand's last trick, trump included, until the next hand's first play.
        renderTable(view({
            gameState: 'BIDDING',
            bids: [],
            currentTrick: {
                leadPlayerId: 'alice',
                trump: 'HERC',
                plays: {
                    alice: { boja: 'HERC', rank: 'DEVETKA' },
                    bob: { boja: 'HERC', rank: 'KRALJ' },
                    carol: { boja: 'HERC', rank: 'BABA' },
                    dave: { boja: 'HERC', rank: 'OSMICA' },
                },
            },
        }), true)
        expect(screen.getByTestId('game-phase')).toHaveTextContent('BIDDING')
        expect(screen.queryByTestId('trump')).not.toBeInTheDocument()
        expect(screen.queryAllByTestId('trick-card')).toHaveLength(0)
    })

    test('a completed hand is nobody\'s turn, even when the server still says it is mine', () => {
        // The backend does not advance the current player after a hand's last play.
        renderTable(view({ gameState: 'HAND_COMPLETE' }), true)
        expect(screen.queryByTestId('your-turn')).not.toBeInTheDocument()
        expect(screen.getByText('Waiting for other players...')).toBeInTheDocument()
    })

    test('a challenge is offered while playing until it is used', async () => {
        const user = userEvent.setup()
        const playing = view({ gameState: 'PLAYING' })
        const handlers = renderTable(playing, false)
        screen.getAllByTestId('hand-card').forEach((card) => expect(card).toBeDisabled())
        await user.click(screen.getByRole('button', { name: 'Challenge' }))
        expect(handlers.onChallenge).toHaveBeenCalledTimes(1)

        // The server's next private view says the challenge is spent: no button any more.
        cleanup()
        renderTable(playing, false, { privateView: { ...privateFor(playing, false), challengeUsed: true } })
        expect(screen.getByTestId('game-phase')).toHaveTextContent('PLAYING')
        expect(screen.queryByRole('button', { name: 'Challenge' })).not.toBeInTheDocument()
    })

    test('a finished game names the winner and offers the way back', async () => {
        const user = userEvent.setup()
        const handlers = renderTable(view({ gameState: 'COMPLETED', winnerTeamId: 'A', teamAScore: 1001, teamBScore: 640 }), false)
        expect(screen.getByText('Game over')).toBeInTheDocument()
        expect(screen.getByText('Team A wins')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Back to lobbies' }))
        expect(handlers.onLeave).toHaveBeenCalledTimes(1)
    })

    test('a rejected move is shown', () => {
        renderTable(view(), false, { error: 'Not a participant in game g1' })
        expect(screen.getByRole('alert')).toHaveTextContent('Not a participant in game g1')
    })
})
