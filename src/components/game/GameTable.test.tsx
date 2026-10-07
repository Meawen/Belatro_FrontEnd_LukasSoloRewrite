import { describe, test, expect, vi, afterEach } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameTable, type GameTableProps } from './GameTable'
import type { GameCard, GamePhase, PrivateGameView, PublicGameView } from '../../types/game'

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
        currentPlayerId: null,
        turnExpiresAt: null,
        endReason: null,
        forfeitTeamId: null,
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
        expect(screen.getByTestId('game-phase')).toHaveTextContent('Bidding')
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
        expect(handlers.onPlayCard).toHaveBeenCalledWith({ boja: 'HERC', rank: 'AS' }, false)
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
        expect(screen.getByTestId('game-phase')).toHaveTextContent('Bidding')
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
        expect(screen.getByTestId('game-phase')).toHaveTextContent('Playing')
        expect(screen.queryByRole('button', { name: 'Challenge' })).not.toBeInTheDocument()
    })

    test('a finished game names the winner and offers the way back', async () => {
        const user = userEvent.setup()
        const handlers = renderTable(view({ gameState: 'COMPLETED', winnerTeamId: 'A', teamAScore: 1001, teamBScore: 640 }), false)
        expect(screen.getByRole('heading', { name: 'Game over' })).toBeInTheDocument()
        expect(screen.getByText('Team A wins')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Back to lobbies' }))
        expect(handlers.onLeave).toHaveBeenCalledTimes(1)
    })

    test('a rejected move is shown', () => {
        renderTable(view(), false, { error: 'Not a participant in game g1' })
        expect(screen.getByRole('alert')).toHaveTextContent('Not a participant in game g1')
    })
})

describe('GameTable: whose turn, your team, declarations, phases, the hint and the end (R-31)', () => {
    afterEach(() => vi.useRealTimers())

    test('the seat whose turn it is is highlighted, with the seconds left on its timer', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-05T20:00:00Z'))
        renderTable(view({ gameState: 'PLAYING', currentPlayerId: 'alice', turnExpiresAt: Date.now() + 30_000 }), false)
        expect(screen.getByTestId('seat-alice')).toHaveAttribute('data-current', 'true')
        for (const other of ['bob', 'carol', 'dave']) {
            expect(screen.getByTestId(`seat-${other}`)).not.toHaveAttribute('data-current')
        }
        expect(within(screen.getByTestId('seat-alice')).getByTestId('turn-countdown')).toHaveTextContent('30 s')
        act(() => { vi.advanceTimersByTime(1000) })
        expect(screen.getByTestId('turn-countdown')).toHaveTextContent('29 s')
    })

    test('my team is labelled', () => {
        // teamA: alice and carol; teamB: bob and dave
        renderTable(view(), false)
        expect(screen.getByTestId('your-team')).toHaveTextContent('Your team: A')
        cleanup()
        renderTable(view(), false, { me: 'dave' })
        expect(screen.getByTestId('your-team')).toHaveTextContent('Your team: B')
    })

    test('the scored declarations are listed', () => {
        renderTable(view({
            gameState: 'PLAYING',
            declarations: {
                alice: { bela: false, sequencesBySuit: { HERC: 50 }, fourOfAKindPoints: 0, bestSequencePoints: 50 },
                carol: { bela: false, sequencesBySuit: {}, fourOfAKindPoints: 100, bestSequencePoints: 0 },
            },
        }), false)
        expect(screen.getAllByTestId('declaration').map((el) => el.textContent)).toEqual([
            'alice: sequence 50 (Herc)',
            'carol: four of a kind 100',
        ])
    })

    test('phases are shown in words; the raw state stays in data-phase', () => {
        const words: [GamePhase, string][] = [
            ['BIDDING', 'Bidding'], ['PLAYING', 'Playing'], ['HAND_COMPLETE', 'Hand finished'],
            ['COMPLETED', 'Game over'], ['CANCELLED', 'Cancelled'],
        ]
        for (const [phase, word] of words) {
            renderTable(view({ gameState: phase }), false)
            expect(screen.getByTestId('game-phase').textContent).toBe(word)
            expect(screen.getByTestId('game-phase')).toHaveAttribute('data-phase', phase)
            cleanup()
        }
    })

    test('the Challenge hint sits by the button while the button is offered', () => {
        const playing = view({ gameState: 'PLAYING' })
        renderTable(playing, false)
        expect(screen.getByRole('button', { name: 'Challenge' })).toBeEnabled()
        expect(screen.getByTestId('challenge-hint').textContent).toBe(
            'Think an opponent played an illegal card this hand? Challenge to win the whole hand. A wrong challenge costs your challenge for this hand')
        cleanup()
        renderTable(playing, false, { privateView: { ...privateFor(playing, false), challengeUsed: true } })
        expect(screen.queryByTestId('challenge-hint')).not.toBeInTheDocument()
    })

    test.each([
        ['FORFEIT by A', { endReason: 'FORFEIT', forfeitTeamId: 'A' }, 'Team A forfeited — Team B wins'],
        ['FORFEIT by B', { endReason: 'FORFEIT', forfeitTeamId: 'B' }, 'Team B forfeited — Team A wins'],
        ['ABANDONED by A', { endReason: 'ABANDONED', forfeitTeamId: 'A' }, 'Team A left — the game was abandoned (no result)'],
        ['ABANDONED by both teams', { endReason: 'ABANDONED', forfeitTeamId: null }, 'Everyone left — the game was abandoned (no result)'],
        ['DECLINED', { endReason: 'DECLINED', forfeitTeamId: null }, "A player declined — you're back in the queue"],
        ['CANCELLED', { endReason: 'CANCELLED', forfeitTeamId: null }, 'The game was cancelled'],
    ] as const)('an end by %s says why', (_label, ending, sentence) => {
        renderTable(view({ gameState: 'CANCELLED', ...ending }), false)
        expect(screen.getByTestId('end-reason').textContent).toBe(sentence)
    })

    test('a forfeit is a game over with a winner, not a cancelled match', () => {
        renderTable(view({ gameState: 'CANCELLED', endReason: 'FORFEIT', forfeitTeamId: 'B' }), false)
        expect(screen.getByRole('heading', { name: 'Game over' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Match cancelled' })).not.toBeInTheDocument()
    })
})

describe('GameTable: bela (R-32)', () => {
    const playing = view({ gameState: 'PLAYING', currentTrick: { leadPlayerId: 'carol', trump: 'HERC', plays: {} } })
    const withHand = (hand: GameCard[]) =>
        renderTable(playing, true, { privateView: { publicPart: playing, hand, yourTurn: true, challengeUsed: false } })
    const kingAndQueenOfTrump: GameCard[] = [
        { boja: 'HERC', rank: 'KRALJ' },
        { boja: 'HERC', rank: 'BABA' },
        { boja: 'KARA', rank: 'AS' },
        { boja: 'PIK', rank: 'BABA' },
    ]

    test('the trump queen while holding the trump king asks Play or Play + Bela; Play + Bela declares it', async () => {
        const user = userEvent.setup()
        const handlers = withHand(kingAndQueenOfTrump)
        await user.click(screen.getByRole('button', { name: 'Baba Herc' }))
        expect(handlers.onPlayCard).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Play + Bela' }))
        expect(handlers.onPlayCard).toHaveBeenCalledWith({ boja: 'HERC', rank: 'BABA' }, true)
        expect(screen.queryByTestId('bela-prompt')).not.toBeInTheDocument()
    })

    test('Play sends the same card without bela', async () => {
        const user = userEvent.setup()
        const handlers = withHand(kingAndQueenOfTrump)
        await user.click(screen.getByRole('button', { name: 'Kralj Herc' }))
        await user.click(screen.getByRole('button', { name: 'Play' }))
        expect(handlers.onPlayCard).toHaveBeenCalledTimes(1)
        expect(handlers.onPlayCard).toHaveBeenCalledWith({ boja: 'HERC', rank: 'KRALJ' }, false)
    })

    test('any other card is played at once, without bela', async () => {
        const user = userEvent.setup()
        const handlers = withHand(kingAndQueenOfTrump)
        await user.click(screen.getByRole('button', { name: 'As Karo' }))
        await user.click(screen.getByRole('button', { name: 'Baba Pik' }))
        expect(handlers.onPlayCard).toHaveBeenNthCalledWith(1, { boja: 'KARA', rank: 'AS' }, false)
        expect(handlers.onPlayCard).toHaveBeenNthCalledWith(2, { boja: 'PIK', rank: 'BABA' }, false)
        cleanup()
        // the trump queen without the king in hand: no bela to declare
        const alone = withHand([{ boja: 'HERC', rank: 'BABA' }, { boja: 'KARA', rank: 'AS' }])
        await user.click(screen.getByRole('button', { name: 'Baba Herc' }))
        expect(alone.onPlayCard).toHaveBeenCalledWith({ boja: 'HERC', rank: 'BABA' }, false)
        expect(screen.queryByTestId('bela-prompt')).not.toBeInTheDocument()
    })

    test('who declared bela is shown', () => {
        renderTable(view({ gameState: 'PLAYING', belaDeclaredByPlayer: { alice: false, bob: true, carol: false, dave: false } }), false)
        expect(screen.getAllByTestId('declaration').map((el) => el.textContent)).toEqual(['bob: bela 20'])
    })
})
