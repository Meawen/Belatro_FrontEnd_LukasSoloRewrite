import { describe, test, expect, vi, afterEach } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useHand2Coach } from './useHand2Coach'
import { privateFor, stateOf, view } from '../components/board/testing'
import { MotionProvider } from '../motion/MotionProvider'
import { en } from '../i18n/catalog/en'
import type { Coach, CoachMove } from '../components/board/coach'
import type { BoardState } from '../components/board/model/accept'
import type { GameBid, GameCard, PrivateGameView, PublicGameView } from '../types/game'

// Škola bele's hand 2 (open beta §7.3): the coach over a real bot game. Carol's game, Herc trump, bob led As Tref

afterEach(() => {
    vi.restoreAllMocks()
})

const CALLED: GameBid[] = [{ playerId: 'alice', action: 'CALL_TRUMP', selectedTrump: 'HERC' }]
const T7: GameCard = { boja: 'TREF', rank: 'SEDMICA' }
const T9: GameCard = { boja: 'TREF', rank: 'DEVETKA' }
const HA: GameCard = { boja: 'HERC', rank: 'AS' }
const KK: GameCard = { boja: 'KARA', rank: 'KRALJ' }
const HAND = [T7, T9, HA, KK]
// the server's order, not the hand's
const LEGAL = [T9, T7]

const PLAY = (version: number, more: Partial<PublicGameView> = {}) => view({
    gameState: 'PLAYING', bids: CALLED, stateVersion: version,
    currentTrick: { leadPlayerId: 'bob', trump: 'HERC', plays: { bob: { boja: 'TREF', rank: 'AS' } } },
    ...more,
})
/** My turn in PLAYING with the server's legal cards ('absent': an older backend, no field at all). */
const myPlay = (version = 5, legalCards: GameCard[] | null | 'absent' = LEGAL): BoardState => {
    const priv = privateFor(PLAY(version), true, HAND)
    return stateOf(legalCards === 'absent' ? priv : { ...priv, legalCards } as PrivateGameView)
}
const theirPlay = (version = 6) => stateOf({ ...privateFor(PLAY(version, { currentPlayerId: 'dave' }), false, HAND), legalCards: null })
const passes = (n: number): GameBid[] => ['dave', 'alice', 'bob'].slice(0, n).map((playerId) => ({ playerId, action: 'PASS', selectedTrump: null }))
const myBid = (bids: GameBid[] = [], version = 1) => stateOf({ ...privateFor(view({ bids, stateVersion: version }), true, HAND), legalCards: null })

const play = (card: GameCard): CoachMove => ({ kind: 'play', card, bela: false })
const OTHER_MOVES: CoachMove[] = [{ kind: 'bid', trump: 'HERC' }, { kind: 'pass' }, { kind: 'challenge' }]

/** The hook as the game page uses it; `coach` comes back through `got`. */
const got: { coach: Coach | undefined } = { coach: undefined }
function Harness({ state, guest, onExit }: { state: BoardState | null; guest: boolean; onExit: () => void }) {
    const { coach, warning } = useHand2Coach(state, { guest, onExit })
    got.coach = coach
    return (
        <>
            {coach?.panel}
            {warning}
        </>
    )
}

function renderCoach(state: BoardState | null, { guest = false, onExit = vi.fn() }: { guest?: boolean; onExit?: () => void } = {}) {
    const ui = (s: BoardState | null) => <MotionProvider><Harness state={s} guest={guest} onExit={onExit} /></MotionProvider>
    const result = render(ui(state))
    return { ...result, onExit, rerenderWith: (next: BoardState | null) => result.rerender(ui(next)) }
}

/** Asks the coach to confirm a move, as the board does; `answers` records each answer it gives. */
function ask(move: CoachMove) {
    const answers = vi.fn()
    let promise: Promise<boolean> = Promise.resolve(false)
    act(() => {
        promise = got.coach!.confirm!(move)
        promise.then(answers)
    })
    return { promise, answers }
}

const dialog = () => screen.getByRole('dialog', { name: 'An illegal card' })
const noDialog = () => waitFor(() => expect(screen.queryByRole('dialog', { name: 'An illegal card' })).toBeNull())
const panel = () => screen.getByTestId('hand2-panel')

describe("hand 2's coach (open beta §7.3, D-24)", () => {
    test('no state, no coach, no warning', () => {
        const { container } = renderCoach(null)
        expect(got.coach).toBeUndefined()
        expect(container).toBeEmptyDOMElement()
        expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    })

    test('marks exactly the legal cards on my turn, none otherwise; it never refuses', () => {
        const { rerenderWith } = renderCoach(myPlay())
        expect([...got.coach!.marked!].sort()).toEqual(['TREF-DEVETKA', 'TREF-SEDMICA'])
        for (const move of [play(T9), play(HA), ...OTHER_MOVES]) expect(got.coach!.allowed(move), JSON.stringify(move)).toBe(true)
        rerenderWith(myBid())
        expect(got.coach!.marked).toBeUndefined()
        rerenderWith(theirPlay())
        expect(got.coach!.marked).toBeUndefined()
    })

    test('a legal card, a bid, a pass and a challenge go without a warning', async () => {
        const { rerenderWith } = renderCoach(myPlay())
        for (const move of [play(T7), play(T9), ...OTHER_MOVES]) {
            const { promise } = ask(move)
            await expect(promise, JSON.stringify(move)).resolves.toBe(true)
        }
        expect(screen.queryByRole('dialog')).toBeNull()
        // bidding: no legal cards, so nothing to confirm
        rerenderWith(myBid())
        expect(got.coach!.confirm).toBeUndefined()
        // an older backend sends no legalCards: no marks and no warnings
        rerenderWith(myPlay(7, 'absent'))
        expect(got.coach!.marked).toBeUndefined()
        expect(got.coach!.confirm).toBeUndefined()
    })

    test('an illegal card opens the warning; Play it anyway resolves true', async () => {
        const user = userEvent.setup()
        renderCoach(myPlay())
        const { promise, answers } = ask(play(HA))
        const warning = dialog()
        expect(within(warning).getByText('Tref was led and you hold Tref, so you must follow suit. Any Tref of yours may go here.')).toBeInTheDocument()
        expect(within(warning).getByText(en.guide.hand2.warning.body)).toBeInTheDocument()
        // the likely next step has focus, so the risky one is never one Enter away
        expect(within(warning).getByRole('button', { name: 'Choose another card' })).toHaveFocus()
        expect(answers).not.toHaveBeenCalled()
        await user.click(within(warning).getByRole('button', { name: 'Play it anyway' }))
        await expect(promise).resolves.toBe(true)
        await noDialog()
        expect(answers).toHaveBeenCalledTimes(1)
    })

    test('every other way out resolves false', async () => {
        const user = userEvent.setup()
        const ways: [string, () => Promise<void> | void][] = [
            ['Choose another card', () => user.click(within(dialog()).getByRole('button', { name: 'Choose another card' }))],
            ['Escape', () => user.keyboard('{Escape}')],
            ['the scrim', () => user.click(document.querySelector('.ui-scrim')!)],
        ]
        for (const [name, close] of ways) {
            const { unmount } = renderCoach(myPlay())
            const { promise, answers } = ask(play(HA))
            dialog()
            await close()
            await expect(promise, name).resolves.toBe(false)
            await noDialog()
            // a second way out after the first settles nothing more
            await user.keyboard('{Escape}')
            expect(answers, name).toHaveBeenCalledTimes(1)
            unmount()
        }
        // the page goes while the warning is open
        const { unmount } = renderCoach(myPlay())
        const { promise, answers } = ask(play(HA))
        dialog()
        unmount()
        await expect(promise).resolves.toBe(false)
        expect(answers).toHaveBeenCalledTimes(1)
    })

    test('a turn that changes while the warning is open resolves false and closes it', async () => {
        const { rerenderWith } = renderCoach(myPlay(5))
        const { promise, answers } = ask(play(HA))
        dialog()
        // the timer played for me, or the turn passed: a newer private frame
        rerenderWith(theirPlay(6))
        await expect(promise).resolves.toBe(false)
        await noDialog()
        // back to my turn, the same card still held: nothing answers again
        rerenderWith(myPlay(7))
        await act(async () => {})
        expect(answers).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('dialog')).toBeNull()
    })

    test('after the first hand, and in a finished game, there is no coach; an open warning resolves false', async () => {
        const after = stateOf({ ...privateFor(view({ teamAScore: 162, teamBScore: 0, stateVersion: 9 }), true, HAND), legalCards: null })
        const { rerenderWith, unmount } = renderCoach(myPlay())
        const first = ask(play(HA))
        rerenderWith(after)
        await expect(first.promise).resolves.toBe(false)
        expect(got.coach).toBeUndefined()
        await noDialog()
        unmount()

        const over = stateOf({ ...privateFor(PLAY(9, { gameState: 'COMPLETED', teamAScore: 1001, teamBScore: 500, winnerTeamId: 'A' }), false, HAND), legalCards: null })
        const again = renderCoach(myPlay())
        const second = ask(play(HA))
        again.rerenderWith(over)
        await expect(second.promise).resolves.toBe(false)
        expect(got.coach).toBeUndefined()
        expect(screen.queryByTestId('hand2-panel')).toBeNull()
    })

    test('the panel: the tip on my bid, the play line and Why?’s reason on my play, the wait and done lines, Exit, and the Rules link', async () => {
        const user = userEvent.setup()
        const { rerenderWith, onExit, unmount } = renderCoach(myBid(), { guest: true })
        const rules = () => within(panel()).getByRole('link', { name: 'More in the Rules ›' })
        expect(within(panel()).getByRole('heading', { level: 2, name: 'Hand 2' })).toBeInTheDocument()
        expect(panel()).toHaveAttribute('data-phase', 'bid')
        expect(panel()).toHaveTextContent(en.guide.hand2.tip)
        expect(rules()).toHaveAttribute('href', '/rules#rules-bidding')
        expect(rules()).toHaveAttribute('target', '_blank')
        // a 44-px target, as every standalone link (R4 review, Accessibility)
        expect(rules()).toHaveClass('inline-flex', 'min-h-11', 'items-center')
        // Exit says where it goes: a guest to the start page
        const exit = within(panel()).getByRole('button', { name: 'Exit' })
        expect(exit).toHaveAccessibleDescription('Back to the start page')
        expect(within(panel()).getByText('Back to the start page')).toBeVisible()
        await user.click(exit)
        expect(onExit).toHaveBeenCalledTimes(1)

        // the dealer after three passes must call
        rerenderWith(myBid(passes(3), 2))
        expect(panel()).toHaveTextContent(en.guide.hand2.tipMust)
        expect(panel()).not.toHaveTextContent(en.guide.hand2.tip)

        // my play: the line, and Hint says why these cards
        rerenderWith(myPlay(5))
        expect(panel()).toHaveAttribute('data-phase', 'play')
        expect(panel()).toHaveTextContent(en.guide.hand2.play)
        expect(rules()).toHaveAttribute('href', '/rules#rules-playing')
        const why = 'Tref was led and you hold Tref, so you must follow suit. Any Tref of yours may go here.'
        const hint = within(panel()).getByRole('button', { name: 'Why?' })
        expect(hint).toHaveAttribute('aria-expanded', 'false')
        expect(within(panel()).getByText(why)).not.toBeVisible()
        await user.click(hint)
        expect(hint).toHaveAttribute('aria-expanded', 'true')
        expect(within(panel()).getByText(why)).toBeVisible()
        expect(hint.getAttribute('aria-controls')).toBe(within(panel()).getByText(why).id)
        // the reason is said where the panel speaks: one live region, there for the whole guide
        const said = within(panel()).getByTestId('hand2-said')
        expect(said).toHaveAttribute('aria-live', 'polite')
        expect(said).toContainElement(within(panel()).getByText(why))
        // the next state closes it again
        rerenderWith(myPlay(6))
        expect(within(panel()).getByRole('button', { name: 'Why?' })).toHaveAttribute('aria-expanded', 'false')
        expect(within(panel()).getByTestId('hand2-said')).toBe(said)

        // not my turn; the hand's result
        rerenderWith(theirPlay(7))
        expect(panel()).toHaveAttribute('data-phase', 'wait')
        expect(panel()).toHaveTextContent(en.guide.hand2.wait)
        expect(within(panel()).queryByRole('button', { name: 'Why?' })).toBeNull()
        rerenderWith(stateOf({ ...privateFor(PLAY(8, { gameState: 'HAND_COMPLETE' }), false, HAND), legalCards: null }))
        expect(panel()).toHaveAttribute('data-phase', 'done')
        expect(panel()).toHaveTextContent(en.guide.hand2.done)
        // the hand's result: how a hand is scored (spec §7.4, "the right section")
        expect(rules()).toHaveAttribute('href', '/rules#rules-scoring')
        unmount()

        // a member's Exit goes Home
        renderCoach(theirPlay(), { guest: false })
        expect(within(panel()).getByRole('button', { name: 'Exit' })).toHaveAccessibleDescription('Back to Home')
    })
})
