import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { act, cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { actions, privateFor, renderBoard, stateOf, tableState, view } from './testing'
import { find, playTable } from '../../test/fixtures/views/table'
import type { CoachMove } from './coach'
import type { GameCard } from '../../types/game'
import { setLang } from '../../i18n/lang'
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
// my playing turn, trump Herc, nothing on the table: Kralj Herc and Baba Herc are a bela pair (Board.input.test.tsx)
const PLAY = view({ gameState: 'PLAYING', currentTrick: { leadPlayerId: 'carol', trump: 'HERC', plays: {} } })
const HAND: GameCard[] = [
    { boja: 'HERC', rank: 'KRALJ' },
    { boja: 'HERC', rank: 'BABA' },
    { boja: 'KARA', rank: 'AS' },
    { boja: 'PIK', rank: 'BABA' },
]
const playing = () => stateOf(privateFor(PLAY, true, HAND))
const bidding = () => stateOf(privateFor(view(), true))
// carol to play in mid-trick, Challenge available in the HUD; the open window, the hand result's Challenge
const challenging = () => tableState(find(table, 'play:bob:PIK-BABA'))
const inTheWindow = () => tableState(find(table, 'window-open'))

const AS_KARO: CoachMove = { kind: 'play', card: { boja: 'KARA', rank: 'AS' }, bela: false }
const card = (name: string) => screen.getByRole('button', { name })
const handCards = () => screen.getAllByTestId('hand-card')

/** A confirm that answers when the test says so (inside act: it sets state after the click's own act). */
function deferredConfirm() {
    let answer: (yes: boolean) => void = () => {}
    const confirm = vi.fn(() => new Promise<boolean>((resolve) => { answer = resolve }))
    return { confirm, settle: (yes: boolean) => act(async () => { answer(yes) }) }
}

describe('Board: the coach (open beta §7.2, §7.3)', () => {
    test('without a coach: no marks, no slot, the names as today', async () => {
        const user = userEvent.setup()
        const moves = actions()
        renderBoard({ state: playing(), actions: moves })
        expect(document.querySelector('[data-marked]')).toBeNull()
        expect(screen.queryByTestId('coach-panel')).toBeNull()
        await user.click(card('As Karo'))
        expect(moves.play).toHaveBeenCalledWith({ boja: 'KARA', rank: 'AS' }, false)
    })

    test('a refused card sends nothing and changes nothing; the coach says why', async () => {
        const user = userEvent.setup()
        const moves = actions()
        const coach = { allowed: vi.fn(() => false), onRefused: vi.fn() }
        renderBoard({ state: playing(), actions: moves, coach })
        await user.click(card('As Karo'))
        expect(coach.onRefused).toHaveBeenCalledTimes(1)
        expect(coach.onRefused).toHaveBeenCalledWith(AS_KARO)
        expect(moves.play).not.toHaveBeenCalled()
        expect(card('As Karo').querySelector('[data-pending]')).toBeNull()
        handCards().forEach((one) => expect(one).toBeEnabled())
        // Enter on the focused card is the same press
        card('As Karo').focus()
        await user.keyboard('{Enter}')
        expect(coach.onRefused).toHaveBeenCalledTimes(2)
        expect(coach.onRefused).toHaveBeenLastCalledWith(AS_KARO)
        expect(moves.play).not.toHaveBeenCalled()
        expect(document.querySelector('[data-pending]')).toBeNull()
        handCards().forEach((one) => expect(one).toBeEnabled())
    })

    test('a refused bid or pass sends nothing; the buttons stay enabled', async () => {
        const user = userEvent.setup()
        const moves = actions()
        const coach = { allowed: vi.fn(() => false), onRefused: vi.fn() }
        renderBoard({ state: bidding(), actions: moves, coach })
        await user.click(card('Call Herc'))
        expect(coach.onRefused).toHaveBeenLastCalledWith({ kind: 'bid', trump: 'HERC' })
        expect(moves.bidTrump).not.toHaveBeenCalled()
        await user.click(card('Pass'))
        expect(coach.onRefused).toHaveBeenLastCalledWith({ kind: 'pass' })
        expect(moves.passBid).not.toHaveBeenCalled()
        expect(coach.onRefused).toHaveBeenCalledTimes(2)
        expect(card('Call Herc')).toBeEnabled()
        expect(card('Pass')).toBeEnabled()
    })

    test('a refused Challenge sends nothing, in the HUD and in the hand result', async () => {
        const user = userEvent.setup()
        const moves = actions()
        const coach = { allowed: vi.fn(() => false), onRefused: vi.fn() }
        renderBoard({ state: challenging(), actions: moves, coach })
        await user.click(card('Challenge'))
        expect(coach.onRefused).toHaveBeenCalledTimes(1)
        expect(coach.onRefused).toHaveBeenCalledWith({ kind: 'challenge' })
        expect(moves.challenge).not.toHaveBeenCalled()
        expect(card('Challenge')).toBeEnabled()
        expect(card('Challenge')).not.toHaveAttribute('aria-busy')
        cleanup()

        renderBoard({ state: inTheWindow(), actions: moves, coach })
        const sheet = () => within(screen.getByTestId('hand-result')).getByRole('button', { name: 'Challenge' })
        await user.click(sheet())
        expect(coach.onRefused).toHaveBeenCalledTimes(2)
        expect(coach.onRefused).toHaveBeenLastCalledWith({ kind: 'challenge' })
        expect(moves.challenge).not.toHaveBeenCalled()
        expect(sheet()).toBeEnabled()
        expect(sheet()).not.toHaveAttribute('aria-busy')
    })

    test('an allowed move goes out through actions', async () => {
        const user = userEvent.setup()
        const moves = actions()
        const coach = { allowed: vi.fn(() => true), onRefused: vi.fn() }
        renderBoard({ state: playing(), actions: moves, coach })
        await user.click(card('As Karo'))
        expect(moves.play).toHaveBeenCalledTimes(1)
        expect(moves.play).toHaveBeenCalledWith({ boja: 'KARA', rank: 'AS' }, false)
        // it lifts and the hand locks, as today
        expect(card('As Karo').querySelector('[data-pending]')).not.toBeNull()
        handCards().forEach((one) => expect(one).toBeDisabled())
        cleanup()

        const { rerenderWith } = renderBoard({ state: bidding(), actions: moves, coach })
        await user.click(card('Call Karo'))
        expect(moves.bidTrump).toHaveBeenCalledWith('KARA')
        rerenderWith({ state: bidding() })
        await user.click(card('Pass'))
        expect(moves.passBid).toHaveBeenCalledTimes(1)
        cleanup()

        renderBoard({ state: challenging(), actions: moves, coach })
        await user.click(card('Challenge'))
        expect(moves.challenge).toHaveBeenCalledTimes(1)
        expect(card('Challenge')).toBeDisabled()

        expect(coach.allowed.mock.calls).toEqual([[AS_KARO], [{ kind: 'bid', trump: 'KARA' }], [{ kind: 'pass' }], [{ kind: 'challenge' }]])
        expect(coach.onRefused).not.toHaveBeenCalled()
    })

    test('bela: a card refused at the tap opens no prompt; a refused answer keeps the prompt; Play + Bela goes as {kind: play, bela: true}', async () => {
        const user = userEvent.setup()
        const moves = actions()
        const coach = {
            allowed: vi.fn((move: CoachMove) => move.kind === 'play' && move.card.rank === 'BABA' && move.card.boja === 'HERC' && move.bela),
            onRefused: vi.fn(),
        }
        renderBoard({ state: playing(), actions: moves, coach })
        await user.click(card('Kralj Herc'))
        expect(coach.onRefused).toHaveBeenCalledTimes(1)
        expect(coach.onRefused).toHaveBeenCalledWith({ kind: 'play', card: { boja: 'HERC', rank: 'KRALJ' }, bela: false })
        expect(screen.queryByTestId('bela-prompt')).toBeNull()

        await user.click(card('Baba Herc'))
        expect(screen.getByTestId('bela-prompt')).toBeInTheDocument()
        expect(coach.onRefused).toHaveBeenCalledTimes(1)

        await user.click(card('Play'))
        expect(coach.onRefused).toHaveBeenCalledTimes(2)
        expect(coach.onRefused).toHaveBeenLastCalledWith({ kind: 'play', card: { boja: 'HERC', rank: 'BABA' }, bela: false })
        expect(moves.play).not.toHaveBeenCalled()
        expect(screen.getByTestId('bela-prompt')).toBeInTheDocument()

        await user.click(card('Play + Bela'))
        expect(moves.play).toHaveBeenCalledTimes(1)
        expect(moves.play).toHaveBeenCalledWith({ boja: 'HERC', rank: 'BABA' }, true)
        expect(coach.onRefused).toHaveBeenCalledTimes(2)
    })

    test('marked cards carry the mark and a name suffix, in both languages', async () => {
        const user = userEvent.setup()
        const moves = actions()
        // TREF-AS isn't in my hand: it marks nothing
        renderBoard({ state: playing(), actions: moves, coach: { allowed: () => true, marked: ['KARA-AS', 'PIK-BABA', 'TREF-AS'] } })
        expect(document.querySelectorAll('[data-marked]')).toHaveLength(2)
        expect(card('As Karo, highlighted')).toHaveAttribute('data-marked')
        expect(card('Baba Pik, highlighted')).toHaveAttribute('data-marked')
        expect(card('Kralj Herc')).not.toHaveAttribute('data-marked')
        await user.click(card('As Karo, highlighted'))
        expect(moves.play).toHaveBeenCalledWith({ boja: 'KARA', rank: 'AS' }, false)
        cleanup()

        // the bela prompt keeps the plain name
        renderBoard({ state: playing(), coach: { allowed: () => true, marked: ['HERC-BABA'] } })
        await user.click(card('Baba Herc, highlighted'))
        expect(screen.getByRole('group', { name: 'Declare bela with Baba Herc?' })).toBeInTheDocument()
        cleanup()

        setLang('hr')
        try {
            renderBoard({ state: playing(), coach: { allowed: () => true, marked: ['KARA-AS'] } })
            expect(card('As Karo, istaknuto')).toHaveAttribute('data-marked')
        } finally {
            setLang('en')
        }

        expect(css).toMatch(/\.board-hand-card\[data-marked\] \.board-card__ring \{[^}]*box-shadow: 0 0 0 3px var\(--success\);[^}]*opacity: 1;/)
    })

    test('confirm: false sends nothing; true sends the move once, from the newest model', async () => {
        const user = userEvent.setup()
        const moves = actions()
        const { confirm, settle } = deferredConfirm()
        const coach = { allowed: vi.fn(() => true), confirm, onRefused: vi.fn() }
        renderBoard({ state: playing(), actions: moves, coach })
        await user.click(card('As Karo'))
        expect(confirm).toHaveBeenCalledTimes(1)
        expect(confirm).toHaveBeenCalledWith(AS_KARO)
        expect(moves.play).not.toHaveBeenCalled()
        expect(document.querySelector('[data-pending]')).toBeNull()

        // one confirm at a time: another press is ignored while it is open
        await user.click(card('Baba Pik'))
        expect(coach.allowed).toHaveBeenCalledTimes(1)
        expect(confirm).toHaveBeenCalledTimes(1)

        await settle(false)
        expect(moves.play).not.toHaveBeenCalled()
        handCards().forEach((one) => expect(one).toBeEnabled())

        await user.click(card('As Karo'))
        expect(confirm).toHaveBeenCalledTimes(2)
        await settle(true)
        expect(moves.play).toHaveBeenCalledTimes(1)
        expect(moves.play).toHaveBeenCalledWith({ boja: 'KARA', rank: 'AS' }, false)
        expect(card('As Karo').querySelector('[data-pending]')).not.toBeNull()
        handCards().forEach((one) => expect(one).toBeDisabled())
        expect(coach.onRefused).not.toHaveBeenCalled()
        cleanup()

        // the bid path
        const bid = deferredConfirm()
        renderBoard({ state: bidding(), actions: moves, coach: { allowed: () => true, confirm: bid.confirm } })
        await user.click(card('Pass'))
        expect(bid.confirm).toHaveBeenCalledWith({ kind: 'pass' })
        expect(moves.passBid).not.toHaveBeenCalled()
        await bid.settle(true)
        expect(moves.passBid).toHaveBeenCalledTimes(1)
    })

    test('a confirm that answers after my turn passed, or after the board is gone, sends nothing', async () => {
        const user = userEvent.setup()
        const moves = actions()
        const first = deferredConfirm()
        const { rerenderWith } = renderBoard({ state: playing(), actions: moves, coach: { allowed: () => true, confirm: first.confirm } })
        await user.click(card('As Karo'))
        expect(first.confirm).toHaveBeenCalledTimes(1)
        rerenderWith({ state: stateOf(privateFor(PLAY, false, HAND)) })
        await first.settle(true)
        expect(moves.play).not.toHaveBeenCalled()
        cleanup()

        const second = deferredConfirm()
        const { unmount } = renderBoard({ state: playing(), actions: moves, coach: { allowed: () => true, confirm: second.confirm } })
        await user.click(card('As Karo'))
        expect(second.confirm).toHaveBeenCalledTimes(1)
        unmount()
        await second.settle(true)
        expect(moves.play).not.toHaveBeenCalled()
    })

    test('the panel renders inside the board, under the HUD, without blocking the hand', async () => {
        const user = userEvent.setup()
        const moves = actions()
        renderBoard({ state: playing(), actions: moves, coach: { allowed: () => true, panel: <p>Lesson</p> } })
        const panel = within(screen.getByRole('region', { name: 'Game table' })).getByTestId('coach-panel')
        expect(panel).toHaveTextContent('Lesson')
        expect(panel.parentElement).toHaveClass('board-region', 'board-coach')
        expect(panel.closest('.board-area')).not.toBeNull()
        // after my hand, before the HUD: painted above the cards' regions, below what comes later
        expect(screen.getByTestId('hand').compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(panel.compareDocumentPosition(document.querySelector('.board-hud')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        await user.click(card('As Karo'))
        expect(moves.play).toHaveBeenCalledWith({ boja: 'KARA', rank: 'AS' }, false)
        cleanup()

        renderBoard({ state: playing(), coach: { allowed: () => true } })
        expect(screen.queryByTestId('coach-panel')).toBeNull()

        // the region takes no taps; only the panel does, under the HUD, its bottom above the felt's middle
        expect(css).toMatch(/\.board-region \{[^}]*pointer-events: none;/)
        expect(css).toMatch(/\.board-coach \{[^}]*z-index: var\(--z-chips\);/)
        expect(css).toMatch(/\.board-coach__panel \{[^}]*top: 52px;/)
        expect(css).toMatch(/\.board-coach__panel \{[^}]*max-height: calc\(50% - 60px\);/)
        expect(css).toMatch(/\.board-coach__panel \{[^}]*pointer-events: auto;/)
        // a portrait phone while the HUD holds Challenge (stacked over its info button, down to 152 px): under that, its
        // bottom where it was (Chromium's hit check: the panel's button at 375×812 hit the Challenge's column)
        expect(css).toMatch(/\.board\[data-layout="portrait"\]:has\(\.board-challenge--hud\) \.board-coach__panel \{[^}]*top: 158px;[^}]*max-height: calc\(50% - 166px\);/)
    })
})
