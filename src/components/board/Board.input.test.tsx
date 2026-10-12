import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { act, cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { actions, privateFor, renderBoard, stateOf, tableState, view } from './testing'
import { find, indexOf, playTable } from '../../test/fixtures/views/table'
import type { GameCard } from '../../types/game'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// board.css as written (Vitest doesn't load CSS); not new URL(…, import.meta.url), which Vite turns into an import
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'board.css'), 'utf8')

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

describe('Board: bids and plays (GameTable cases, R-23, R-32)', () => {
    test('on my bidding turn I can pass or call any suit, one bid in flight; my cards stay locked', async () => {
        const user = userEvent.setup()
        const moves = actions()
        const { rerenderWith } = renderBoard({ state: stateOf(privateFor(view(), true)), actions: moves })
        expect(screen.getByTestId('game-phase')).toHaveTextContent('Bidding')
        expect(screen.getByTestId('your-turn')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Pass' }))
        expect(moves.passBid).toHaveBeenCalledTimes(1)
        // one bid in flight (spec §5.3.5 #4): the next waits for a newer state from the server
        expect(screen.getByRole('button', { name: 'Call Herc' })).toBeDisabled()
        rerenderWith({ state: stateOf(privateFor(view(), true)) })
        await user.click(screen.getByRole('button', { name: 'Call Herc' }))
        expect(moves.bidTrump).toHaveBeenCalledWith('HERC')
        rerenderWith({ state: stateOf(privateFor(view(), true)) })
        await user.click(screen.getByRole('button', { name: 'Call Karo' }))
        expect(moves.bidTrump).toHaveBeenLastCalledWith('KARA')
        expect(screen.getAllByTestId('hand-card')).toHaveLength(6)
        screen.getAllByTestId('hand-card').forEach((card) => expect(card).toBeDisabled())
    })

    test('not my turn: no bid panel, a waiting note', () => {
        renderBoard({ state: stateOf(privateFor(view(), false)) })
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
        const moves = actions()
        renderBoard({ state: stateOf(privateFor(playing, true)), actions: moves })
        expect(screen.queryByRole('button', { name: 'Pass' })).not.toBeInTheDocument()
        expect(screen.getByTestId('trump')).toHaveTextContent('Herc')
        expect(screen.getAllByTestId('bid').map((el) => el.textContent)).toEqual(['alice: Pass', 'bob: Herc'])
        const trick = screen.getByTestId('trick-card')
        expect(trick).toHaveAttribute('data-seat', 'dave')
        expect(trick).toHaveAttribute('data-card', 'PIK-AS')
        await user.click(screen.getByRole('button', { name: 'As Herc' }))
        expect(moves.play).toHaveBeenCalledWith({ boja: 'HERC', rank: 'AS' }, false)
    })

    test("with three passes on record the dealer can't pass and is told to call trump", () => {
        const threePasses = ['alice', 'bob', 'carol'].map((playerId) => ({ playerId, action: 'PASS' as const, selectedTrump: null }))
        // dave bids last: the dealer
        renderBoard({ state: stateOf(privateFor(view({ bids: threePasses }), true)), me: 'dave' })
        expect(screen.getByRole('button', { name: 'Pass' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Call Herc' })).toBeEnabled()
        expect(screen.getByTestId('dealer-must-call')).toHaveTextContent('The dealer must call trump')
    })

    test('with fewer than three passes Pass stays available', () => {
        const twoPasses = ['alice', 'bob'].map((playerId) => ({ playerId, action: 'PASS' as const, selectedTrump: null }))
        renderBoard({ state: stateOf(privateFor(view({ bids: twoPasses }), true)) })
        expect(screen.getByRole('button', { name: 'Pass' })).toBeEnabled()
        expect(screen.queryByTestId('dealer-must-call')).not.toBeInTheDocument()
    })
})

describe('Board: bela (R-32)', () => {
    const playing = view({ gameState: 'PLAYING', currentTrick: { leadPlayerId: 'carol', trump: 'HERC', plays: {} } })
    const withHand = (hand: GameCard[]) => {
        const moves = actions()
        const result = renderBoard({ state: stateOf(privateFor(playing, true, hand)), actions: moves })
        return { moves, ...result }
    }
    const kingAndQueenOfTrump: GameCard[] = [
        { boja: 'HERC', rank: 'KRALJ' },
        { boja: 'HERC', rank: 'BABA' },
        { boja: 'KARA', rank: 'AS' },
        { boja: 'PIK', rank: 'BABA' },
    ]

    test('the trump queen while holding the trump king asks Play or Play + Bela; Play + Bela declares it', async () => {
        const user = userEvent.setup()
        const { moves } = withHand(kingAndQueenOfTrump)
        await user.click(screen.getByRole('button', { name: 'Baba Herc' }))
        expect(moves.play).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Play + Bela' }))
        expect(moves.play).toHaveBeenCalledWith({ boja: 'HERC', rank: 'BABA' }, true)
        expect(screen.queryByTestId('bela-prompt')).not.toBeInTheDocument()
    })

    test('Play sends the same card without bela', async () => {
        const user = userEvent.setup()
        const { moves } = withHand(kingAndQueenOfTrump)
        await user.click(screen.getByRole('button', { name: 'Kralj Herc' }))
        await user.click(screen.getByRole('button', { name: 'Play' }))
        expect(moves.play).toHaveBeenCalledTimes(1)
        expect(moves.play).toHaveBeenCalledWith({ boja: 'HERC', rank: 'KRALJ' }, false)
    })

    test('any other card is played at once, without bela', async () => {
        const user = userEvent.setup()
        const { moves, rerenderWith } = withHand(kingAndQueenOfTrump)
        await user.click(screen.getByRole('button', { name: 'As Karo' }))
        // one card in flight: the next press counts once a newer state has come
        rerenderWith({ state: stateOf(privateFor(playing, true, kingAndQueenOfTrump)) })
        await user.click(screen.getByRole('button', { name: 'Baba Pik' }))
        expect(moves.play).toHaveBeenNthCalledWith(1, { boja: 'KARA', rank: 'AS' }, false)
        expect(moves.play).toHaveBeenNthCalledWith(2, { boja: 'PIK', rank: 'BABA' }, false)
        cleanup()
        // the trump queen without the king in hand: no bela to declare
        const alone = withHand([{ boja: 'HERC', rank: 'BABA' }, { boja: 'KARA', rank: 'AS' }])
        await user.click(screen.getByRole('button', { name: 'Baba Herc' }))
        expect(alone.moves.play).toHaveBeenCalledWith({ boja: 'HERC', rank: 'BABA' }, false)
        expect(screen.queryByTestId('bela-prompt')).not.toBeInTheDocument()
    })

    test('the prompt drops its card when my turn passes, and Escape closes it without playing', async () => {
        const user = userEvent.setup()
        const bela = playTable({ seed: 11 })
        const moves = actions()
        const { rerenderWith } = renderBoard({ state: tableState(bela[indexOf(bela, 'play:bob:HERC-SEDMICA')]), actions: moves })
        await user.click(screen.getByRole('button', { name: 'Baba Herc' }))
        expect(screen.getByTestId('bela-prompt')).toBeInTheDocument()
        await user.keyboard('{Escape}')
        expect(screen.queryByTestId('bela-prompt')).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Kralj Herc' }))
        expect(screen.getByTestId('bela-prompt')).toBeInTheDocument()
        rerenderWith({ state: tableState(bela[indexOf(bela, 'play:carol:HERC-BABA')]) })
        expect(screen.queryByTestId('bela-prompt')).not.toBeInTheDocument()
        expect(moves.play).not.toHaveBeenCalled()
    })
})

describe('Board: the input rules (spec §5.3.5, D-9, O-2)', () => {
    test('one card in flight: it lifts at once, a second tap plays nothing; after 2 s it drops back and the lock holds until a newer state', () => {
        vi.useFakeTimers()
        const moves = actions()
        const myTurn = indexOf(table, 'play:bob:PIK-BABA')
        const { rerenderWith } = renderBoard({ state: tableState(table[myTurn]), actions: moves })
        const [first, second] = screen.getAllByTestId('hand-card')
        act(() => { first.click() })
        expect(moves.play).toHaveBeenCalledTimes(1)
        expect(first.querySelector('[data-pending]')).not.toBeNull()
        act(() => { second.click() })
        expect(moves.play).toHaveBeenCalledTimes(1)
        screen.getAllByTestId('hand-card').forEach((card) => expect(card).toBeDisabled())
        act(() => { vi.advanceTimersByTime(2000) })
        expect(screen.getAllByTestId('hand-card')[0].querySelector('[data-pending]')).toBeNull()
        screen.getAllByTestId('hand-card').forEach((card) => expect(card).toBeDisabled())
        // the CTL re-broadcast carries the same version: still nothing newer, the lock holds
        rerenderWith({ state: tableState(table[myTurn + 1]) })
        screen.getAllByTestId('hand-card').forEach((card) => expect(card).toBeDisabled())
    })

    test('input never waits for the hold: the trick’s winner leads while the finished trick is still on the table', async () => {
        const user = userEvent.setup()
        const moves = actions()
        const { rerenderWith } = renderBoard({ state: tableState(find(table, 'play:carol:PIK-OSMICA'), 'dave'), me: 'dave', actions: moves })
        rerenderWith({ state: tableState(find(table, 'play:dave:PIK-DESETKA'), 'dave') })
        expect(screen.getAllByTestId('trick-card')).toHaveLength(4)
        const lead = screen.getAllByTestId('hand-card')[0]
        expect(lead).toBeEnabled()
        await user.click(lead)
        expect(moves.play).toHaveBeenCalledTimes(1)
        expect(screen.getAllByTestId('trick-card')).toHaveLength(4)
    })

    test('a move that could not be sent leaves the hand free, so the player can try again (R-30)', async () => {
        const user = userEvent.setup()
        const moves = actions()
        moves.play.mockReturnValue(false)
        renderBoard({ state: tableState(find(table, 'play:bob:PIK-BABA')), actions: moves, error: 'Not sent — reconnecting' })
        await user.click(screen.getAllByTestId('hand-card')[0])
        expect(screen.getByRole('alert')).toHaveTextContent('Not sent — reconnecting')
        expect(screen.getAllByTestId('hand-card')[0]).toBeEnabled()
        expect(screen.getAllByTestId('hand-card')[0].querySelector('[data-pending]')).toBeNull()
    })

    test('a reconnect clears the lock: a move sent before the drop may be lost', async () => {
        const user = userEvent.setup()
        const { rerenderWith } = renderBoard({ state: tableState(find(table, 'play:bob:PIK-BABA')) })
        await user.click(screen.getAllByTestId('hand-card')[0])
        expect(screen.getAllByTestId('hand-card')[1]).toBeDisabled()
        rerenderWith({ isConnected: false })
        rerenderWith({ isConnected: true })
        expect(screen.getAllByTestId('hand-card')[1]).toBeEnabled()
    })

    test('the hand is one tab stop: arrows, Home and End move between the playable cards; Enter plays', async () => {
        const user = userEvent.setup()
        const moves = actions()
        renderBoard({ state: tableState(find(table, 'play:bob:PIK-BABA')), actions: moves })
        const cards = screen.getAllByTestId('hand-card')
        expect(cards.filter((card) => card.tabIndex === 0)).toHaveLength(1)
        cards[0].focus()
        await user.keyboard('{ArrowRight}')
        expect(cards[1]).toHaveFocus()
        await user.keyboard('{End}')
        expect(cards[cards.length - 1]).toHaveFocus()
        await user.keyboard('{ArrowRight}')
        expect(cards[0]).toHaveFocus()
        await user.keyboard('{ArrowLeft}{Home}')
        expect(cards[0]).toHaveFocus()
        await user.keyboard('{Enter}')
        expect(moves.play).toHaveBeenCalledWith(expect.objectContaining({ boja: cards[0].getAttribute('data-card')!.split('-')[0] }), false)
    })

    test('the owner’s hover lift and the bidding suit ring are kept for fine pointers (D-35, §5.6.5)', () => {
        expect(css).toMatch(/@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?\.board-hand-card:not\(:disabled\):hover \.board-card__lift \{\s*transform: translateY\(-24px\) scale\(1\.08\);/)
        expect(css).toMatch(/\.board-card__lift \{\s*transition: transform 160ms/)
        for (const suit of ['HERC', 'KARA', 'PIK', 'TREF']) {
            expect(css).toContain(`.board[data-phase="BIDDING"]:has([data-suit="${suit}"]:hover) .board-hand-card[data-suit="${suit}"] .board-card__ring`)
        }
        expect(css).toMatch(/\.board-card__ring \{[^}]*transition: opacity 120ms/)
    })
})
