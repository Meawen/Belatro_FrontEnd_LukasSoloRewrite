import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderBoard, tableState } from './testing'
import { endedHand } from './model/hands'
import { devHands } from '../../dev/devTable'
import { find, indexOf, playTable, type FanOut } from '../../test/fixtures/views/table'
import type { MatchHands } from '../../hooks/useMatchHands'

// the whole board renders in every test: slower than a 5-s default on a busy machine
vi.setConfig({ testTimeout: 20_000 })

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => {
    vi.restoreAllMocks()
})

const table = playTable({ hands: 2 })
const PHONE = { width: 375, height: 812 }
function storedHands(fanOuts: readonly FanOut[], upTo: number): MatchHands {
    const hands = devHands(fanOuts, upTo)
    const v = fanOuts[upTo].public
    return { hands, ended: endedHand(hands, { a: v.teamAScore, b: v.teamBScore }), loading: false, error: null, refresh: vi.fn() }
}

describe('Board: the game menu (spec §5.4, X-10, US-36)', () => {
    test('This hand without test ids, Rules in a new tab, Back to home with its note; Escape closes it', async () => {
        const user = userEvent.setup()
        renderBoard({ state: tableState(find(table, 'call:')) })
        await user.click(screen.getByRole('button', { name: 'Game menu' }))
        const menu = screen.getByRole('dialog', { name: 'Game menu' })
        expect(within(menu).getByRole('heading', { name: 'This hand' })).toBeInTheDocument()
        expect(within(menu).getByText('Your team: A')).toBeInTheDocument()
        expect(within(menu).getByText('dave: Herc')).toBeInTheDocument()
        expect(menu.querySelectorAll('[data-testid]')).toHaveLength(0)
        expect(within(menu).getByRole('link', { name: 'Rules' })).toHaveAttribute('target', '_blank')
        expect(within(menu).getByRole('button', { name: 'Back to home' })).toBeInTheDocument()
        expect(within(menu).getByText("Your seat stays. If you're away, the timer plays for you; 5 missed turns in a row forfeit (casual: the game is cancelled).")).toBeInTheDocument()
        expect(within(menu).queryByRole('button', { name: 'Bela Blok' })).not.toBeInTheDocument()
        await user.keyboard('{Escape}')
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Game menu' })).not.toBeInTheDocument())
        expect(screen.getAllByTestId('your-team')).toHaveLength(1)
    })
})

describe('Board: Bela Blok (spec §5.4, US-35)', () => {
    test('on a desktop a column: every hand’s points, the running total and the hint', () => {
        const end = indexOf(table, 'next-deal')
        renderBoard({ state: tableState(table[end]), hands: storedHands(table, end) })
        const blok = screen.getByTestId('bela-blok')
        expect(within(blok).getByRole('heading', { name: 'Bela Blok' })).toBeInTheDocument()
        const rows = within(blok).getAllByRole('row').map((row) => [...row.querySelectorAll('td, th')].map((cell) => cell.textContent))
        expect(rows).toEqual([['#', 'Mi', 'Vi'], ['1', '11', '171'], ['Total', '11', '171']])
        expect(within(blok).getByText("Tap your team's pile to look at the tricks you've won this hand.")).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Blok' })).not.toBeInTheDocument()
    })

    test('on a phone a sheet, from the HUD’s Blok and from the menu; opening it asks for the stored hands', async () => {
        const user = userEvent.setup()
        const end = indexOf(table, 'next-deal')
        const hands = storedHands(table, end)
        renderBoard({ state: tableState(table[end]), hands, viewport: PHONE })
        expect(screen.queryByTestId('bela-blok')).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Blok' }))
        expect(hands.refresh).toHaveBeenCalledTimes(1)
        const sheet = screen.getByRole('dialog', { name: 'Bela Blok' })
        expect(sheet).toHaveAttribute('data-testid', 'bela-blok')
        expect(within(sheet).getAllByRole('row')).toHaveLength(3)
        await user.click(within(sheet).getByRole('button', { name: 'Close' }))
        await user.click(screen.getByRole('button', { name: 'Game menu' }))
        await user.click(within(screen.getByRole('dialog', { name: 'Game menu' })).getByRole('button', { name: 'Bela Blok' }))
        expect(screen.getByRole('dialog', { name: 'Bela Blok' })).toBeInTheDocument()
        expect(screen.getAllByTestId('bela-blok')).toHaveLength(1)
    })
})

describe('Board: the piles and the peek (spec §5.3.3, D-11, US-32)', () => {
    test('my team’s pile opens the tricks we won this hand, the winner crowned; the opponents’ stays closed', async () => {
        const user = userEvent.setup()
        // alice's team (A) has won one trick by now: trick 5
        const at = indexOf(table, 'play:alice:TREF-KRALJ')
        const hands = storedHands(table, at)
        renderBoard({ state: tableState(table[at], 'alice'), me: 'alice', hands })
        expect(screen.getByTestId('pile-a')).toHaveAttribute('data-count', '1')
        expect(screen.getByTestId('pile-b')).toHaveAttribute('data-count', '4')
        await user.click(screen.getByRole('button', { name: "Opponents' tricks (4)" }))
        expect(screen.getByRole('status')).toHaveTextContent("You can only look at your team's tricks")
        expect(screen.queryByTestId('peek-sheet')).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: "Look at your team's tricks (1)" }))
        expect(hands.refresh).toHaveBeenCalled()
        const peek = screen.getByTestId('peek-sheet')
        expect(peek).toHaveAttribute('role', 'dialog')
        expect(within(peek).getByRole('heading', { name: "Your team's tricks" })).toBeInTheDocument()
        const trick = within(peek).getByText('Trick 5').closest('li')!
        expect(within(trick).getAllByRole('img').filter((img) => img.tagName === 'IMG')).toHaveLength(4)
        expect(within(trick).getByRole('img', { name: 'won the trick' })).toBeInTheDocument()
    })

    test('no trick won yet: the peek says so', async () => {
        const user = userEvent.setup()
        const at = indexOf(table, 'play:bob:PIK-BABA')
        renderBoard({ state: tableState(table[at]), hands: storedHands(table, at) })
        await user.click(screen.getByRole('button', { name: "Look at your team's tricks (0)" }))
        expect(within(screen.getByTestId('peek-sheet')).getByText('No tricks won yet this hand.')).toBeInTheDocument()
    })
})
