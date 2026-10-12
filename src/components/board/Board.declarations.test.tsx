import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { act, cleanup, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { actions, renderBoard, tableState } from './testing'
import { belotRow, layoutFor } from './model/cardTargets'
import { cardLabel } from '../game/gameView'
import { indexOf, playTable, type FanOut } from '../../test/fixtures/views/table'

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

// seed 113: alice and bob both say 20 up to As; alice is first in turn order (ORDER), so team A (alice, carol) scores 20
const tie = playTable({ seed: 113 })
const CALL = indexOf(tie, 'call:')
const SEATS = ['alice', 'bob', 'carol', 'dave']
const SR = 'Declarations: alice 20 up to As, bob 20 up to As, you nothing, dave nothing. alice was first: Team A scores 20.'
const SAID = ['20 · up to As', '20 · up to As', '–', '–']

const bubble = (seat: string) => document.querySelector<HTMLElement>(`.board-moment__bubble[data-seat="${seat}"]`)
const bubbles = () => SEATS.map((seat) => bubble(seat)?.textContent ?? null)
const panel = () => screen.queryByRole('button', { name: 'Skip declarations' })
const overlay = () => document.querySelector<HTMLElement>('.board-moment')
const cards = () => screen.getAllByTestId('hand-card')
const logged = (line: string) => within(screen.getByRole('log')).queryAllByText(line).length
/** The declared cards shown at a seat, by name. */
const declared = (seat: string) => [...screen.getByTestId(`seat-${seat}`).querySelectorAll('.board-seat__declared img')].map((img) => img.getAttribute('alt'))
const after = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })

/** The board live from the bid before the call to the call itself, the clock at the call. */
function live(me = 'carol', fanOuts: FanOut[] = tie, options: { reducedMotion?: 'always' } = {}) {
    vi.useFakeTimers()
    const call = indexOf(fanOuts, 'call:')
    vi.setSystemTime(fanOuts[call - 1].at)
    const moves = actions()
    const result = renderBoard({ state: tableState(fanOuts[call - 1], me), me, actions: moves }, options)
    vi.setSystemTime(fanOuts[call].at)
    result.rerenderWith({ state: tableState(fanOuts[call], me) })
    return { ...result, moves, call }
}

describe('Board: the declaration moment in the middle of the table (gameplay rules §6)', () => {
    test('live: the seats speak in turn order 0.6 s apart, the tied seats add their height, then the winner line; the log says it once', () => {
        live()
        expect(bubbles()).toEqual(['20', null, null, null])
        expect(panel()).toHaveTextContent('Declarations')
        expect(logged(SR)).toBe(1)
        after(600)
        expect(bubbles()).toEqual(['20', '20', null, null])
        after(600)
        expect(bubbles()).toEqual(['20', '20', '–', null])
        after(600)
        expect(bubbles()).toEqual(['20', '20', '–', '–'])
        expect(bubble('carol')).toHaveAttribute('data-nothing')
        after(800)
        expect(bubbles()).toEqual(SAID)
        expect(panel()).not.toHaveTextContent('Team A')
        after(800)
        expect(panel()).toHaveTextContent('alice was first: Team A scores 20')
        // the winner's bubble in the accent; the bubbles are words for the eye only: the log has the whole moment
        expect(bubble('alice')).toHaveAttribute('data-won')
        expect(bubble('bob')).not.toHaveAttribute('data-won')
        expect(bubble('alice')!.closest('[aria-hidden="true"]')).not.toBeNull()
        expect(logged(SR)).toBe(1)
    })

    test('my cards are disabled until playOpensAt on the server clock (skew), and enable then without a new frame', () => {
        vi.useFakeTimers()
        // the server's clock runs 30 s ahead of this one: alice leads the first trick
        const skew = 30_000
        const moves = actions()
        vi.setSystemTime(tie[CALL - 1].at - skew)
        const { rerenderWith } = renderBoard({ state: { ...tableState(tie[CALL - 1], 'alice'), skew }, me: 'alice', actions: moves })
        vi.setSystemTime(tie[CALL].at - skew)
        rerenderWith({ state: { ...tableState(tie[CALL], 'alice'), skew } })
        const table = screen.getByRole('region', { name: 'Game table' })
        const plain = () => cards().find((card) => !/^(Kralj|Baba) Herc$/.test(card.getAttribute('aria-label')!))!
        cards().forEach((card) => expect(card).toBeDisabled())
        expect(table).toHaveAttribute('data-waiting', 'true')
        // the lead's turn shows through the wait (the controller's ruling; e2e/gameplay.mjs's myTurn reads it)
        expect(screen.getByTestId('your-turn')).toBeInTheDocument()
        act(() => { plain().click() })
        expect(moves.play).not.toHaveBeenCalled()
        after(4999)
        cards().forEach((card) => expect(card).toBeDisabled())
        after(1)
        cards().forEach((card) => expect(card).toBeEnabled())
        expect(table).not.toHaveAttribute('data-waiting')
        expect(screen.getByTestId('your-turn')).toBeInTheDocument()
        act(() => { plain().click() })
        expect(moves.play).toHaveBeenCalledTimes(1)
    })

    test('the waiting hand is dimmed on its card art, leaving the flip layers alone', () => {
        expect(css).toMatch(/\.board\[data-waiting\] \.board-hand-card \.ui-card \{[^}]*filter: drop-shadow\(0 3px 0 rgb\(0 0 0 \/ 0\.35\)\) brightness\(/)
    })

    test('a tap on the moment hides it on my screen; my cards stay disabled until play opens', () => {
        const { rerenderWith, call } = live('alice')
        act(() => { panel()!.click() })
        expect(overlay()).toBeNull()
        cards().forEach((card) => expect(card).toBeDisabled())
        // the hand's later frames and the clock don't bring it back
        rerenderWith({ state: tableState(tie[call + 1], 'alice') })
        after(1000)
        expect(overlay()).toBeNull()
        cards().forEach((card) => expect(card).toBeDisabled())
        after(4000)
        cards().forEach((card) => expect(card).toBeEnabled())
    })

    test("at playOpensAt it closes: the winners' cards by their seats until the first trick is collected, the chips until the next deal", () => {
        const { rerenderWith, call } = live()
        const aliceCards = tie[call].public.zvanja!.seats[0].cards.map(cardLabel)
        expect(aliceCards).toHaveLength(3)
        // during the wait: the bubbles, no chips and no cards yet
        expect(within(screen.getByTestId('seat-alice')).queryByText('Zvanja 20')).toBeNull()
        expect(declared('alice')).toEqual([])
        after(5000)
        expect(overlay()).toBeNull()
        expect(within(screen.getByTestId('seat-alice')).getByText('Zvanja 20')).toBeInTheDocument()
        expect(declared('alice')).toEqual(aliceCards)
        for (const loser of ['bob', 'carol', 'dave']) {
            expect(declared(loser)).toEqual([])
            expect(screen.getByTestId(`seat-${loser}`)).not.toHaveTextContent('Zvanja')
        }
        // the first trick: its 4th card collects it (lastTrick); the cards go, the chip stays
        const fourth = indexOf(tie, 'play:', call) + 6
        for (let i = call + 1; i < fourth; i++) rerenderWith({ state: tableState(tie[i]) })
        expect(declared('alice')).toEqual(aliceCards)
        rerenderWith({ state: tableState(tie[fourth]) })
        expect(declared('alice')).toEqual([])
        expect(within(screen.getByTestId('seat-alice')).getByText('Zvanja 20')).toBeInTheDocument()
        rerenderWith({ state: tableState(tie[indexOf(tie, 'hand-complete')]) })
        expect(within(screen.getByTestId('seat-alice')).getByText('Zvanja 20')).toBeInTheDocument()
        rerenderWith({ state: tableState(tie[indexOf(tie, 'next-deal')]) })
        expect(screen.queryByText('Zvanja 20')).toBeNull()
    })

    test('the chips replace the old "sequence" chips: a winning seat with two declarations shows both', () => {
        // seed 234: alice's two runs (20 + 20, up to As) beat bob's 20 up to Decko and carol's up to Baba; carol is alice's partner
        const runs = playTable({ seed: 234 })
        const call = indexOf(runs, 'call:')
        vi.useFakeTimers()
        vi.setSystemTime(runs[call].at + 6000)
        renderBoard({ state: tableState(runs[call + 1], 'carol', 'snapshot') })
        expect(within(screen.getByTestId('seat-alice')).getByText('Zvanja 20 + 20')).toBeInTheDocument()
        expect(within(screen.getByTestId('seat-carol')).getByText('Zvanja 20')).toBeInTheDocument()
        expect(screen.getByTestId('seat-bob')).not.toHaveTextContent('Zvanja')
        expect(screen.getByRole('region', { name: 'Game table' })).not.toHaveTextContent('sequence')
        expect(screen.getAllByTestId('declaration').map((line) => line.textContent)).toEqual(['alice: 20 + 20', 'carol: 20'])
    })

    test('a snapshot during the wait shows the moment fully said, and a live frame after it does not replay it', () => {
        vi.useFakeTimers()
        vi.setSystemTime(tie[CALL].at + 100)
        const { rerenderWith } = renderBoard({ state: tableState(tie[CALL], 'carol', 'snapshot') })
        expect(bubbles()).toEqual(SAID)
        expect(panel()).toHaveTextContent('alice was first: Team A scores 20')
        expect(logged(SR)).toBe(1)
        after(500)
        rerenderWith({ state: tableState(tie[CALL + 1]) })
        expect(bubbles()).toEqual(SAID)
        expect(panel()).toHaveTextContent('alice was first: Team A scores 20')
        after(4400)
        expect(overlay()).toBeNull()
        expect(declared('alice')).toHaveLength(3)
    })

    test('a tap hides the moment of its own hand only: the next hand is said again', () => {
        const two = playTable({ seed: 113, hands: 2 })
        const { rerenderWith } = live('carol', two)
        act(() => { panel()!.click() })
        expect(overlay()).toBeNull()
        const call = indexOf(two, 'call:', indexOf(two, 'next-deal'))
        vi.setSystemTime(two[call - 1].at)
        rerenderWith({ state: tableState(two[call - 1]) })
        vi.setSystemTime(two[call].at)
        rerenderWith({ state: tableState(two[call]) })
        expect(panel()).toHaveTextContent('Declarations')
        expect(bubbles().filter((said) => said !== null)).toHaveLength(1)
    })

    test('a snapshot after the wait: only the chips, and the cards until trick 1 is collected; nothing for the log', () => {
        vi.useFakeTimers()
        vi.setSystemTime(tie[CALL].at + 7000)
        renderBoard({ state: tableState(tie[indexOf(tie, 'play:', CALL)], 'carol', 'snapshot') })
        expect(overlay()).toBeNull()
        expect(within(screen.getByTestId('seat-alice')).getByText('Zvanja 20')).toBeInTheDocument()
        expect(declared('alice')).toHaveLength(3)
        expect(logged(SR)).toBe(0)
    })

    test('reduced motion: the same words on the same timing, and nothing scales in', () => {
        live('carol', tie, { reducedMotion: 'always' })
        expect(bubbles()).toEqual(['20', null, null, null])
        after(600)
        expect(bubbles()).toEqual(['20', '20', null, null])
        expect(bubble('bob')!.style.transform).not.toMatch(/scale/)
        expect(panel()!.style.transform).not.toMatch(/scale/)
        after(2800)
        expect(bubbles()).toEqual(SAID)
        expect(panel()).toHaveTextContent('alice was first: Team A scores 20')
        cleanup()
        // with motion a new bubble pops in from 0.6
        live()
        after(600)
        expect(bubble('bob')!.style.transform).toMatch(/scale\(0\.6\)/)
    })

    test('taps: the overlay takes none; only its panel, a button, does, and it sits clear of my hand at all three layouts', () => {
        expect(css).toMatch(/\.board-region \{[^}]*pointer-events: none;/)
        expect(css).toMatch(/\.board-moment \{[^}]*z-index: var\(--z-bid\);/)
        expect(css).toMatch(/\.board-moment__panel \{[^}]*pointer-events: auto;/)
        expect(css).not.toMatch(/\.board-moment__(bubble|spot) \{[^}]*pointer-events: auto;/)
        vi.useFakeTimers()
        for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }, { width: 812, height: 375 }]) {
            vi.setSystemTime(tie[CALL].at + 100)
            renderBoard({ state: tableState(tie[CALL], 'carol', 'snapshot'), viewport })
            const root = overlay()!
            expect(root).toHaveClass('board-region')
            expect(root.style.pointerEvents).toBe('')
            expect([...root.querySelectorAll('button')]).toEqual([panel()])
            const handTop = Math.min(...cards().map((card) => Number.parseFloat(card.style.top)))
            // the panel is centred on its top: half a two-line panel stays well above the hand
            expect(Number.parseFloat(panel()!.style.top) + 70, `${viewport.width}x${viewport.height}`).toBeLessThan(handTop)
            cleanup()
        }
    })
})

describe('Board: my chips never sit on my hand (gameplay rules §6)', () => {
    test('in landscape my chips go over my plate with my declared cards, as my bubble did; elsewhere under it; the other seats as before', () => {
        // seed 1254, the hand's first card: carol (me) holds Zvanja 100 + 20 and six declared cards, alice 20 and three
        const t = playTable({ seed: 1254 })
        const first = t[indexOf(t, 'play:')]
        for (const viewport of [{ width: 812, height: 375 }, { width: 375, height: 812 }, { width: 1440, height: 900 }]) {
            vi.useFakeTimers()
            vi.setSystemTime(first.at)
            renderBoard({ state: tableState(first, 'carol', 'snapshot'), viewport })
            const where = `${viewport.width}x${viewport.height}`
            const mine = screen.getByTestId('seat-carol')
            const above = mine.querySelector<HTMLElement>(':scope > .board-seat__above')!
            const chip = within(mine).getByText('Zvanja 100 + 20')
            expect(above.querySelector('[role="group"]'), where).toHaveAccessibleName('Your declared cards')
            expect(declared('carol'), where).toHaveLength(6)
            // landscape: my plate sits low beside my hand, so the chips go over it too, closest to the plate
            const landscape = viewport.width === 812
            expect(above.contains(chip), where).toBe(landscape)
            if (landscape) expect([...above.children].map((child) => child.className), where).toEqual(['board-seat__declared', 'board-seat__chips'])
            else expect(chip.closest('.board-seat__chips')?.parentElement, where).toBe(mine)
            // the other seats keep their chips and cards under the plate
            const alice = screen.getByTestId('seat-alice')
            expect(alice.querySelector('.board-seat__above'), where).toBeNull()
            expect(within(alice).getByText('Zvanja 20').closest('.board-seat__chips')?.parentElement, where).toBe(alice)
            expect(declared('alice'), where).toHaveLength(3)
            cleanup()
            vi.useRealTimers()
        }
    })
})

describe('Board: belot (gameplay rules §3, §6)', () => {
    // bob holds all eight Pik: the game ends at the call
    const belot = playTable({ belot: { player: 'bob', suit: 'PIK' } })
    const BELOT = 'Belot! bob holds all eight Pik'
    const PIK = belot[indexOf(belot, 'call:')].public.zvanja!.seats[1].cards.map(cardLabel)
    const gameOver = () => screen.queryByRole('heading', { name: 'Game over' })
    /** A belot's panel: a tap skips the wait for the end sheet, so it is named for that. */
    const belotPanel = () => screen.queryByRole('button', { name: 'Skip to the result' })

    test('live: the belot line with the eight cards while the end sheet waits about 4 s; then the end sheet alone', () => {
        live('carol', belot)
        expect(belotPanel()).toHaveTextContent(BELOT)
        expect(panel()).toBeNull()
        expect([...belotPanel()!.querySelectorAll('img')].map((img) => img.getAttribute('alt'))).toEqual(PIK)
        expect(PIK).toHaveLength(8)
        expect(logged(BELOT)).toBe(1)
        expect(gameOver()).toBeNull()
        after(3999)
        expect(gameOver()).toBeNull()
        expect(belotPanel()).toHaveTextContent(BELOT)
        after(1)
        expect(gameOver()).toBeInTheDocument()
        // not beside the end sheet: the panel goes as the sheet rises, and nothing in the finished game skips anything
        expect(overlay()).toBeNull()
        expect(belotPanel()).toBeNull()
        expect(logged(BELOT)).toBe(1)
    })

    test('a tap opens the end sheet at once, the panel gone; a snapshot (a reconnect) shows the end sheet alone', () => {
        live('carol', belot)
        act(() => { belotPanel()!.click() })
        expect(overlay()).toBeNull()
        expect(gameOver()).toBeInTheDocument()
        cleanup()
        const call = indexOf(belot, 'call:')
        vi.setSystemTime(belot[call].at)
        renderBoard({ state: tableState(belot[call], 'carol', 'snapshot') })
        expect(gameOver()).toBeInTheDocument()
        expect(screen.getByText('Team B wins by belot')).toBeInTheDocument()
        expect(overlay()).toBeNull()
        expect(belotPanel()).toBeNull()
    })

    test('the eight cards fit the panel: sized and stepped by belotRow at every layout', () => {
        vi.useFakeTimers()
        const call = indexOf(belot, 'call:')
        for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }, { width: 812, height: 375 }]) {
            vi.setSystemTime(belot[call - 1].at)
            const { rerenderWith } = renderBoard({ state: tableState(belot[call - 1]), viewport })
            vi.setSystemTime(belot[call].at)
            rerenderWith({ state: tableState(belot[call]) })
            const row = belotRow(layoutFor({ ...viewport, dpr: window.devicePixelRatio || 1 }))
            const shown = [...belotPanel()!.querySelectorAll<HTMLElement>('.ui-card')]
            expect(shown.map((card) => card.style.width)).toEqual(Array(8).fill(`${row.width}px`))
            expect(shown.map((card) => card.style.marginLeft)).toEqual(['', ...Array(7).fill(`${row.step - row.width}px`)])
            cleanup()
        }
    })

    test('a belot after an earlier hand: no card on the table, though the view still carries the last hand\'s trick (backend review B3)', () => {
        const played = playTable()
        const stale = played[indexOf(played, 'next-deal')].public.currentTrick!
        const call = indexOf(belot, 'call:')
        const edit = (f: FanOut): FanOut => {
            const view = { ...f.public, currentTrick: stale }
            return { ...f, public: view, private: Object.fromEntries(Object.entries(f.private).map(([id, p]) => [id, { ...p, publicPart: view }])) }
        }
        const later = [...belot.slice(0, call), edit(belot[call])]
        live('carol', later)
        expect(screen.queryAllByTestId('trick-card')).toHaveLength(0)
        after(4000)
        expect(gameOver()).toBeInTheDocument()
        expect(screen.getByText('Team B wins by belot')).toBeInTheDocument()
        expect(screen.getByTestId('end-reason')).toHaveTextContent('bob held all eight Pik')
        expect(screen.queryAllByTestId('trick-card')).toHaveLength(0)
        cleanup()
        renderBoard({ state: tableState(later[call], 'carol', 'snapshot') })
        expect(screen.queryAllByTestId('trick-card')).toHaveLength(0)
    })
})
