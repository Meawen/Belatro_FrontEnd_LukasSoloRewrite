import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { act, cleanup, screen, within } from '@testing-library/react'
import { privateFor, renderBoard, stateOf, tableState, view } from './testing'
import { find, indexOf, playTable } from '../../test/fixtures/views/table'
import type { GamePhase } from '../../types/game'

// jsdom draws nothing: no 2D context for the arena's canvas
// the whole board renders in every test: slower than a 5-s default on a busy machine
vi.setConfig({ testTimeout: 20_000 })

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
})

const table = playTable()
const board = (publicView = view(), yourTurn = false, me = 'carol') =>
    renderBoard({ state: stateOf(privateFor(publicView, yourTurn)), me })

describe('Board: seats, phase, team and trick (GameTable cases, R-31)', () => {
    test('seats start with me at the bottom and follow the turn order', () => {
        board()
        const order = screen.getAllByTestId(/^seat-/).map((el) => el.getAttribute('data-testid'))
        expect(order).toEqual(['seat-carol', 'seat-dave', 'seat-alice', 'seat-bob'])
        expect(within(screen.getByTestId('seat-carol')).getByText('You')).toBeInTheDocument()
        expect(screen.getByTestId('cards-left-dave')).toHaveTextContent('6')
    })

    test("while bidding the last hand's trick and its trump are not shown", () => {
        // The backend keeps the previous hand's last trick, trump included, until the next hand's first play.
        board(view({
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

    test("a completed hand is nobody's turn, even when the server still says it is mine", () => {
        // The backend does not advance the current player after a hand's last play.
        board(view({ gameState: 'HAND_COMPLETE' }), true)
        expect(screen.queryByTestId('your-turn')).not.toBeInTheDocument()
        expect(screen.getByText('Waiting for other players...')).toBeInTheDocument()
    })

    test('a rejected move is shown', () => {
        renderBoard({ state: stateOf(privateFor(view(), false)), error: 'Not a participant in game g1' })
        expect(screen.getByRole('alert')).toHaveTextContent('Not a participant in game g1')
    })

    test('the seat whose turn it is is highlighted, with the seconds left on its timer', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-05T20:00:00Z'))
        board(view({ gameState: 'PLAYING', currentPlayerId: 'alice', turnExpiresAt: Date.now() + 30_000 }))
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
        board()
        expect(screen.getByTestId('your-team')).toHaveTextContent('Your team: A')
        cleanup()
        board(view(), false, 'dave')
        expect(screen.getByTestId('your-team')).toHaveTextContent('Your team: B')
    })

    test('the scored declarations are listed', () => {
        board(view({
            gameState: 'PLAYING',
            declarations: {
                alice: { bela: false, sequencesBySuit: { HERC: 50 }, fourOfAKindPoints: 0, bestSequencePoints: 50 },
                carol: { bela: false, sequencesBySuit: {}, fourOfAKindPoints: 100, bestSequencePoints: 0 },
            },
        }))
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
            board(view({ gameState: phase }))
            expect(screen.getByTestId('game-phase').textContent).toBe(word)
            expect(screen.getByTestId('game-phase')).toHaveAttribute('data-phase', phase)
            cleanup()
        }
    })

    test('who declared bela is shown', () => {
        board(view({ gameState: 'PLAYING', belaDeclaredByPlayer: { alice: false, bob: true, carol: false, dave: false } }))
        expect(screen.getAllByTestId('declaration').map((el) => el.textContent)).toEqual(['bob: bela 20'])
    })
})

describe('Board: the DOM contract on real views (spec §5.10, §7.2)', () => {
    test('the trick shows at each seat (data-seat), in play order, and in words', () => {
        renderBoard({ state: tableState(find(table, 'play:bob:PIK-BABA')) })
        const cards = screen.getAllByTestId('trick-card')
        expect(cards.map((el) => [el.getAttribute('data-seat'), el.getAttribute('data-card')])).toEqual([['alice', 'PIK-SEDMICA'], ['bob', 'PIK-BABA']])
        expect(screen.getByText('Trick: alice 7 Pik, bob Baba Pik')).toBeInTheDocument()
        expect(screen.getAllByTestId('hand-card').map((el) => el.getAttribute('data-card'))).not.toContain('PIK-SEDMICA')
    })

    test('all 6 hand cards are there at the first bidding state, flying in from the dealer', () => {
        renderBoard({ state: tableState(table[0]) })
        const cards = screen.getAllByTestId('hand-card')
        expect(cards).toHaveLength(6)
        cards.forEach((card) => expect(card.style.transform).toContain('translate'))
        expect(screen.getByTestId('dealer-chip').closest('[data-testid^="seat-"]')).toHaveAttribute('data-testid', 'seat-dave')
    })

    test('a snapshot snaps: the cards are at their places at once, no deal', () => {
        renderBoard({ state: tableState(table[0], 'carol', 'snapshot') })
        const cards = screen.getAllByTestId('hand-card')
        expect(cards).toHaveLength(6)
        cards.forEach((card) => expect(card.style.transform).not.toContain('translate'))
    })

    test('trump is absent while bidding and exactly "Herc" after the call; the felt turns to spring', () => {
        const { rerenderWith } = renderBoard({ state: tableState(table[indexOf(table, 'bid:carol:PASS')]) })
        expect(screen.queryByTestId('trump')).not.toBeInTheDocument()
        expect(screen.getByTestId('arena')).toHaveAttribute('data-season', 'none')
        rerenderWith({ state: tableState(find(table, 'call:')) })
        expect(screen.getByTestId('trump').textContent).toBe('Herc')
        expect(screen.getByTestId('arena')).toHaveAttribute('data-season', 'spring')
        expect(screen.getAllByTestId('hand-card')).toHaveLength(8)
    })

    test('score-a holds exactly the number while the digits slide', () => {
        const { rerenderWith } = renderBoard({ state: tableState(table[indexOf(table, 'hand-complete') - 1]) })
        expect(screen.getByTestId('score-a').textContent).toBe('0')
        rerenderWith({ state: tableState(find(table, 'hand-complete')) })
        expect(screen.getByTestId('score-a').textContent).toBe('11')
        expect(screen.getByTestId('score-b').textContent).toBe('171')
        expect(screen.getByTestId('score-a').closest('.board-score')!.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0)
    })

    test('a finished trick is held 900 ms, then sweeps to the winner’s pile, which counts it once it lands', () => {
        vi.useFakeTimers()
        const { rerenderWith } = renderBoard({ state: tableState(find(table, 'play:carol:PIK-OSMICA')) })
        rerenderWith({ state: tableState(find(table, 'play:dave:PIK-DESETKA')) })
        expect(screen.getAllByTestId('trick-card')).toHaveLength(4)
        expect(screen.getByTestId('pile-b')).toHaveAttribute('data-count', '0')
        act(() => { vi.advanceTimersByTime(899) })
        expect(screen.getAllByTestId('trick-card')).toHaveLength(4)
        act(() => { vi.advanceTimersByTime(1) })
        expect(screen.queryAllByTestId('trick-card')).toHaveLength(0)
        expect(screen.getByTestId('pile-b')).toHaveAttribute('data-count', '0')
        act(() => { vi.advanceTimersByTime(800) })
        expect(screen.getByTestId('pile-b')).toHaveAttribute('data-count', '1')
    })

    test('each kept test id exists at most once — and the HUD’s, the hand’s and each seat’s exactly once — through a whole hand', () => {
        const singular = ['game-phase', 'your-turn', 'trump', 'score-a', 'score-b', 'end-reason', 'dealer-must-call', 'bela-prompt',
            'challenge-hint', 'rematch-votes', 'turn-countdown', 'your-team', 'hand', 'dealer-chip', 'arena', 'pile-a', 'pile-b']
        const always = ['game-phase', 'score-a', 'score-b', 'your-team', 'hand', 'arena',
            ...['alice', 'bob', 'carol', 'dave'].flatMap((id) => [`seat-${id}`, `cards-left-${id}`])]
        const { rerenderWith } = renderBoard({ state: tableState(table[0]) })
        for (const fanOut of table) {
            rerenderWith({ state: tableState(fanOut) })
            const count = new Map<string, number>()
            document.querySelectorAll('[data-testid]').forEach((el) => {
                const id = el.getAttribute('data-testid')!
                count.set(id, (count.get(id) ?? 0) + 1)
            })
            for (const id of singular) expect(count.get(id) ?? 0, `${fanOut.label}: ${id}`).toBeLessThanOrEqual(1)
            for (const id of always) expect(count.get(id) ?? 0, `${fanOut.label}: ${id}`).toBe(1)
        }
    }, 60_000)

    test('the hand is a toolbar of only the hand-card buttons, and the summary lists my hand (M-10)', () => {
        renderBoard({ state: tableState(table[0]) })
        const hand = screen.getByRole('toolbar', { name: 'Your hand' })
        expect(hand).toHaveAttribute('data-testid', 'hand')
        expect([...hand.children].every((el) => el.getAttribute('data-testid') === 'hand-card')).toBe(true)
        screen.getAllByTestId('hand-card').forEach((card) => {
            expect(card).toBeDisabled()
            expect(card).toHaveAttribute('aria-disabled', 'true')
        })
        const labels = screen.getAllByTestId('hand-card').map((card) => card.getAttribute('aria-label'))
        expect(screen.getByText(`Your hand: ${labels.join(', ')}`)).toBeInTheDocument()
        expect(screen.getByRole('region', { name: 'Game table' })).toBeInTheDocument()
    })
})
