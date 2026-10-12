import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { actions, renderBoard, tableState } from './testing'
import { bannerSpot, layoutFor } from './model/cardTargets'
import { WHO_MS } from './model/challengeMoment'
import { endedHand } from './model/hands'
import { devHands } from '../../dev/devTable'
import { find, indexOf, playTable, type FanOut } from '../../test/fixtures/views/table'
import type { MatchHands } from '../../hooks/useMatchHands'

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
const PLAYERS = ['alice', 'bob', 'carol', 'dave']
const TEAM: Record<string, 'A' | 'B'> = { alice: 'A', bob: 'B', carol: 'A', dave: 'B' }
const HINT = "Think an opponent played an illegal card this hand? Challenge to win the whole hand. If you're wrong it costs no points, but you lose your challenge for the rest of the game."
const USED = "Your challenge was wrong, so it's gone for the rest of the game."
const REFUSED = "You can't challenge now"

// bob's card is the hand's second (alice led): carol is to play, and everyone still holds cards
const PLAYING = indexOf(table, 'play:bob:PIK-BABA')
const CALL = indexOf(table, 'call:')
const NEXT_DEAL = indexOf(table, 'next-deal')

/**
 * Fan-out `f` after `by`'s challenge, the game's `number`-th, as the server sends it to every seat (gameplay rules §1, §5):
 * a right one ends the hand there (HAND_COMPLETE with the cards still held, the challengers +162, the 10-s window); a
 * wrong one spends `by`'s challenge for the rest of the game, and play goes on.
 */
function challenged(f: FanOut, by: string, foulFound: boolean, number = 1): FanOut {
    const out = structuredClone(f)
    out.version += 1
    out.at += 400
    for (const [id, priv] of Object.entries(out.private)) {
        const pub = priv.publicPart
        Object.assign(pub, { stateVersion: out.version, serverNow: out.at, lastChallenge: { number, playerId: by, team: TEAM[by], foulFound, thisHand: true } })
        if (foulFound) {
            Object.assign(pub, { gameState: 'HAND_COMPLETE', currentPlayerId: null, turnExpiresAt: null, challengeWindowExpiresAt: out.at + 10_000 })
            if (TEAM[by] === 'A') pub.teamAScore += 162
            else pub.teamBScore += 162
            priv.yourTurn = false
        } else {
            pub.challengeUsedByPlayer[by] = true
            if (id === by) priv.challengeUsed = true
        }
    }
    return out
}

/** Fan-out `f` of a later hand: `by`'s challenge went wrong in an earlier one, and is still gone. */
function spent(f: FanOut, by: string): FanOut {
    const out = structuredClone(f)
    for (const [id, priv] of Object.entries(out.private)) {
        priv.publicPart.lastChallenge = { number: 1, playerId: by, team: TEAM[by], foulFound: false, thisHand: false }
        priv.publicPart.challengeUsedByPlayer[by] = true
        if (id === by) priv.challengeUsed = true
    }
    return out
}

/** The same fan-out as an older backend sends it: no lastChallenge, so challenges are inferred (spec §5.3.4). */
function older(f: FanOut): FanOut {
    const out = structuredClone(f)
    Object.values(out.private).forEach((priv) => { delete priv.publicPart.lastChallenge })
    return out
}

const banner = () => document.querySelector<HTMLElement>('.board-banner')
const panel = () => document.querySelector<HTMLElement>('.board-banner__panel')
const logged = (line: string) => within(screen.getByRole('log')).queryAllByText(line).length
const after = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })
const toast = () => screen.getByRole('status').textContent

/** `me`'s board live at bob's card, then the challenge as the server answers it. */
function live(me: string, answer: FanOut, options: { reducedMotion?: 'always' } = {}) {
    vi.useFakeTimers()
    const result = renderBoard({ state: tableState(table[PLAYING], me), me }, options)
    result.rerenderWith({ state: tableState(answer, me) })
    return result
}

describe('Board: the challenge said out loud in the middle of the table (gameplay rules §6, D-5)', () => {
    test('a wrong challenge: every screen says who, then "No foul", then nothing; the log says it once; no toast', () => {
        const wrong = challenged(table[PLAYING], 'bob', false)
        for (const me of PLAYERS) {
            live(me, wrong)
            const who = me === 'bob' ? 'You challenge!' : 'bob challenges!'
            const outcome = me === 'bob' ? 'No foul: you have no challenge left' : 'No foul: bob has no challenge left'
            expect(panel(), me).toHaveTextContent(who)
            after(1199)
            expect(panel(), me).toHaveTextContent(who)
            after(1)
            expect(panel(), me).toHaveTextContent(outcome)
            after(1999)
            expect(panel(), me).toHaveTextContent(outcome)
            after(1)
            expect(banner(), me).toBeNull()
            expect(logged(`${who} ${outcome}`), me).toBe(1)
            expect(toast(), me).toBe('')
            cleanup()
            vi.useRealTimers()
        }
    })

    test('a right challenge: every screen says who, then "Foul found" with the challenger\'s team, then nothing', () => {
        const right = challenged(table[PLAYING], 'dave', true)
        for (const me of PLAYERS) {
            live(me, right)
            const who = me === 'dave' ? 'You challenge!' : 'dave challenges!'
            expect(panel(), me).toHaveTextContent(who)
            after(1200)
            expect(panel(), me).toHaveTextContent('Foul found: Team B takes the hand')
            after(2000)
            expect(banner(), me).toBeNull()
            expect(logged(`${who} Foul found: Team B takes the hand`), me).toBe(1)
            expect(toast(), me).toBe('')
            cleanup()
            vi.useRealTimers()
        }
    })

    test('the banner takes no taps: a board region above the trick and below the sheets, with nothing to press', () => {
        expect(css).toMatch(/\.board-region \{[^}]*pointer-events: none;/)
        expect(css).toMatch(/\.board-banner \{[^}]*z-index: var\(--z-sweep\);/)
        expect(css).not.toMatch(/\.board-banner[\w-]* \{[^}]*pointer-events: auto/)
        live('carol', challenged(table[PLAYING], 'bob', false))
        const root = banner()!
        expect(root).toHaveClass('board-region')
        expect(root.style.pointerEvents).toBe('')
        expect(root.querySelectorAll('button, a, input, [tabindex]')).toHaveLength(0)
        // the words are for the eye; the live region has them once
        expect(root).toHaveAttribute('aria-hidden', 'true')
    })

    test('a snapshot never shows a banner (Review focus 4): not for a challenge it carries, nor on the live frame after it', () => {
        const wrong = challenged(table[PLAYING], 'bob', false)
        const { rerenderWith } = renderBoard({ state: tableState(table[PLAYING]) })
        rerenderWith({ state: tableState(wrong, 'carol', 'snapshot') })
        expect(banner()).toBeNull()
        expect(logged('bob challenges! No foul: bob has no challenge left')).toBe(0)
        // the hand goes on with the same lastChallenge: nothing to say
        const next = challenged(table[PLAYING + 2], 'bob', false)
        rerenderWith({ state: tableState(next) })
        expect(banner()).toBeNull()
        cleanup()
        // a page that opens on a snapshot after a challenge
        renderBoard({ state: tableState(challenged(table[PLAYING], 'dave', true), 'carol', 'snapshot') })
        expect(banner()).toBeNull()
        cleanup()
        // a snapshot during a banner ends it
        const shown = live('carol', wrong)
        expect(banner()).not.toBeNull()
        shown.rerenderWith({ state: tableState(next, 'carol', 'snapshot') })
        expect(banner()).toBeNull()
        after(5000)
        expect(banner()).toBeNull()
    })

    test('reduced motion: the same words on the same timing, and nothing moves', () => {
        live('carol', challenged(table[PLAYING], 'bob', false), { reducedMotion: 'always' })
        expect(panel()).toHaveTextContent('bob challenges!')
        expect(panel()!.style.transform).not.toMatch(/scale|translate/)
        after(1200)
        expect(panel()).toHaveTextContent('No foul: bob has no challenge left')
        expect(panel()!.style.transform).not.toMatch(/scale|translate/)
        after(2000)
        expect(banner()).toBeNull()
        cleanup()
        vi.useRealTimers()
        // with motion each step pops in from 0.6
        live('carol', challenged(table[PLAYING], 'bob', false))
        expect(panel()!.style.transform).toMatch(/scale\(0\.6\)/)
    })
})

describe('Board: the seats without a challenge (gameplay rules §6, D-6)', () => {
    test('a quiet "No challenge" tag on the spent seat for every viewer, said "bob: no challenge left", from the banner\'s outcome, still there after the next deal', () => {
        for (const me of PLAYERS) {
            const { rerenderWith } = live(me, challenged(table[PLAYING], 'bob', false))
            // while the banner says who, the seats are as before (the board's step before)
            expect(screen.queryByText('No challenge'), me).toBeNull()
            after(WHO_MS)
            const check = (when: string) => {
                const seat = screen.getByTestId('seat-bob')
                expect(within(seat).getByText('No challenge'), `${me} ${when}`).toBeInTheDocument()
                expect(within(seat).getByText(me === 'bob' ? 'You: no challenge left' : 'bob: no challenge left'), `${me} ${when}`).toHaveClass('sr-only')
                for (const other of PLAYERS.filter((id) => id !== 'bob')) {
                    expect(screen.getByTestId(`seat-${other}`), `${me} ${when}`).not.toHaveTextContent(/no challenge/i)
                }
            }
            check('at the outcome')
            rerenderWith({ state: tableState(spent(table[NEXT_DEAL], 'bob'), me) })
            expect(screen.getByTestId('game-phase'), me).toHaveTextContent('Bidding')
            check('after the next deal')
            cleanup()
            vi.useRealTimers()
        }
    })

    test('the tag is in the seat\'s chip row, in the quiet tone', () => {
        renderBoard({ state: tableState(spent(table[PLAYING], 'dave')) })
        const tag = within(screen.getByTestId('seat-dave')).getByText('No challenge').closest('.ui-tag')!
        expect(tag.closest('.board-seat__chips')).not.toBeNull()
        expect(tag).toHaveClass('bg-surface-2', 'text-text-2')
    })
})

describe('Board: your Challenge button (gameplay rules §6, R-2, R-3, D-4, D-7)', () => {
    const button = () => screen.getByRole('button', { name: 'Challenge' })

    test("hidden before the hand's first card, shown from it (R-2)", () => {
        const { rerenderWith } = renderBoard({ state: tableState(table[CALL]) })
        expect(screen.getByTestId('game-phase')).toHaveTextContent('Playing')
        expect(screen.queryByRole('button', { name: /^Challenge/ })).toBeNull()
        expect(screen.queryByTestId('challenge-hint')).toBeNull()
        rerenderWith({ state: tableState(find(table, 'play:alice:')) })
        expect(button()).toBeEnabled()
    })

    test('the hint while it is available, revealed by the info button and hidden again by Escape; Challenge is described by it', async () => {
        const user = userEvent.setup()
        renderBoard({ state: tableState(table[PLAYING]) })
        const hint = screen.getByTestId('challenge-hint')
        expect(hint.textContent).toBe(HINT)
        expect(hint).toHaveClass('sr-only')
        expect(button()).toHaveAccessibleDescription(HINT)
        await user.click(screen.getByRole('button', { name: 'What does Challenge do?' }))
        expect(hint).not.toHaveClass('sr-only')
        expect(screen.getByRole('button', { name: 'What does Challenge do?' })).toHaveAttribute('aria-expanded', 'true')
        await user.keyboard('{Escape}')
        expect(hint).toHaveClass('sr-only')
    })

    test('one tap, no confirm; the button is disabled until the server answers (Review focus 5): a newer state, or an error', async () => {
        const user = userEvent.setup()
        const moves = actions()
        const { rerenderWith } = renderBoard({ state: tableState(table[PLAYING]), actions: moves })
        await user.click(button())
        expect(moves.challenge).toHaveBeenCalledTimes(1)
        expect(button()).toBeDisabled()
        // a double tap sends nothing more
        await user.click(button())
        expect(moves.challenge).toHaveBeenCalledTimes(1)
        // the same save's other frame is no answer
        rerenderWith({ state: tableState(table[PLAYING + 1]) })
        expect(table[PLAYING + 1].version).toBe(table[PLAYING].version)
        expect(button()).toBeDisabled()
        // a newer state is (here the next card: a challenge's answer is said first, which the next describe covers)
        rerenderWith({ state: tableState(table[PLAYING + 2]) })
        expect(table[PLAYING + 2].version).toBeGreaterThan(table[PLAYING].version)
        expect(button()).toBeEnabled()
        await user.click(button())
        expect(moves.challenge).toHaveBeenCalledTimes(2)
        expect(button()).toBeDisabled()
        // a refused press is answered on the error queue only
        rerenderWith({ error: REFUSED })
        expect(button()).toBeEnabled()
        expect(screen.getByText(REFUSED)).toBeInTheDocument()
    })

    test('a press that could not be sent (reconnecting) leaves it enabled', async () => {
        const user = userEvent.setup()
        const moves = { ...actions(), challenge: vi.fn(() => false) }
        renderBoard({ state: tableState(table[PLAYING]), actions: moves })
        await user.click(button())
        expect(moves.challenge).toHaveBeenCalledTimes(1)
        expect(button()).toBeEnabled()
    })

    test('once my challenge is gone: "Challenge used", disabled, in place, with its info; in the HUD and in the hand result', async () => {
        const user = userEvent.setup()
        const moves = actions()
        renderBoard({ state: tableState(challenged(table[PLAYING], 'carol', false)), actions: moves })
        const used = screen.getByRole('button', { name: 'Challenge used' })
        expect(used).toBeDisabled()
        expect(used.closest('.board-hud')).not.toBeNull()
        expect(screen.queryByRole('button', { name: 'Challenge' })).toBeNull()
        expect(screen.getByTestId('challenge-hint').textContent).toBe(USED)
        expect(used).toHaveAccessibleDescription(USED)
        await user.click(screen.getByRole('button', { name: 'What does Challenge do?' }))
        expect(screen.getByTestId('challenge-hint')).not.toHaveClass('sr-only')
        expect(moves.challenge).not.toHaveBeenCalled()
        cleanup()
        // a later hand's window, the sheet
        renderBoard({ state: tableState(spent(find(table, 'window-open'), 'carol')) })
        const sheet = screen.getByTestId('hand-result')
        expect(within(sheet).getByRole('button', { name: 'Challenge used' })).toBeDisabled()
        expect(screen.getAllByTestId('challenge-hint')).toHaveLength(1)
    })

    test('hidden in the window a right challenge decided (R-3), in the HUD and in the sheet, from the banner\'s outcome', () => {
        const right = challenged(table[PLAYING], 'dave', true)
        for (const me of ['carol', 'dave']) {
            live(me, right)
            // while the banner says who, the HUD is the step before's: its Challenge shows, disabled
            expect(screen.getByRole('button', { name: 'Challenge' }), me).toBeDisabled()
            after(1200)
            // from the outcome (the sheet waits), and once the sheet is up
            expect(screen.queryByRole('button', { name: /^Challenge/ }), me).toBeNull()
            after(2000)
            expect(screen.getByTestId('hand-result'), me).toBeInTheDocument()
            expect(screen.queryByRole('button', { name: /^Challenge/ }), me).toBeNull()
            expect(screen.queryByTestId('challenge-hint'), me).toBeNull()
            cleanup()
            vi.useRealTimers()
        }
    })
})

describe('Board: the hand result after a right challenge (gameplay rules §6, D-8)', () => {
    test('who, then the outcome, then the sheet (D-8): its header names the challengers, the new numbers and the countdown; the cards stay in hand', () => {
        vi.useFakeTimers()
        const right = challenged(table[PLAYING], 'dave', true)
        vi.setSystemTime(table[PLAYING].at)
        const { rerenderWith } = renderBoard({ state: tableState(table[PLAYING]) })
        expect(screen.getAllByTestId('trick-card')).toHaveLength(2)
        const held = screen.getAllByTestId('hand-card').length
        vi.setSystemTime(right.at)
        rerenderWith({ state: tableState(right) })
        // the partial trick stays on the table while the banner says who; the sheet waits while the banner says it
        expect(screen.getAllByTestId('trick-card')).toHaveLength(2)
        expect(panel()).toHaveTextContent('dave challenges!')
        expect(screen.queryByTestId('hand-result')).toBeNull()
        expect(screen.queryByText('Foul found: Team B takes the hand')).toBeNull()
        after(1199)
        expect(screen.getAllByTestId('trick-card')).toHaveLength(2)
        // the outcome: the partial trick fades where it lies (the sweep layer), off the trick region
        after(1)
        expect(panel()).toHaveTextContent('Foul found: Team B takes the hand')
        expect(screen.queryAllByTestId('trick-card')).toHaveLength(0)
        expect(document.querySelectorAll('.board-sweep-card')).toHaveLength(2)
        expect(screen.queryByTestId('hand-result')).toBeNull()
        after(1999)
        expect(screen.queryByTestId('hand-result')).toBeNull()
        after(1)
        expect(banner()).toBeNull()
        const sheet = screen.getByTestId('hand-result')
        expect(within(sheet).getByRole('heading', { name: 'Foul found: Team B takes the hand' })).toBeInTheDocument()
        // carol is in team A: Mi 0, Vi 162 from the scores the board saw change
        expect(within(sheet).getAllByText(/^(0|162)$/).map((el) => el.textContent)).toEqual(['0', '162'])
        // the server's 10-s window started with the challenge
        expect(within(sheet).getByText('Next hand in 7 s')).toBeInTheDocument()
        expect(screen.getAllByTestId('hand-card')).toHaveLength(held)
    })

    test('a snapshot of the decided hand shows no banner, so the sheet is up at once', () => {
        renderBoard({ state: tableState(challenged(table[PLAYING], 'dave', true), 'carol', 'snapshot') })
        expect(banner()).toBeNull()
        expect(within(screen.getByTestId('hand-result')).getByRole('heading', { name: 'Foul found: Team B takes the hand' })).toBeInTheDocument()
    })

    test('a snapshot during the banner ends it, and the sheet rises', () => {
        const right = challenged(table[PLAYING], 'dave', true)
        const { rerenderWith } = live('carol', right)
        expect(screen.queryByTestId('hand-result')).toBeNull()
        rerenderWith({ state: tableState(right, 'carol', 'snapshot') })
        expect(banner()).toBeNull()
        expect(screen.getByTestId('hand-result')).toBeInTheDocument()
    })
})

describe('Board: a right challenge in the window (gameplay rules §1, R-4)', () => {
    /** carol's board in hand 1's open window, 3 s in; then dave's right challenge: the award taken back, team B 162, the window again at 10 s. */
    function rightInWindow() {
        const last = indexOf(table, 'hand-complete')
        const win = indexOf(table, 'window-open')
        const right = structuredClone(table[win])
        right.at += 3000
        Object.assign(right.private.carol.publicPart, {
            teamAScore: 0, teamBScore: 162, stateVersion: right.version + 1, serverNow: right.at, challengeWindowExpiresAt: right.at + 10_000,
            lastChallenge: { number: 1, playerId: 'dave', team: 'B', foulFound: true, thisHand: true },
        })
        return { last, win, right }
    }

    test('the open sheet stays as it was while the banner says who (D-8), then takes the header, the new numbers and the restarted countdown', () => {
        vi.useFakeTimers()
        const { last, win, right } = rightInWindow()
        vi.setSystemTime(table[last - 1].at)
        const { rerenderWith } = renderBoard({ state: tableState(table[last - 1]) })
        rerenderWith({ state: tableState(table[last]) })
        rerenderWith({ state: tableState(table[win]) })
        after(900)
        const open = screen.getByTestId('hand-result')
        // carol is in team A: Mi 11, Vi 171 as the hand was played
        expect(within(open).getAllByText(/^(11|171)$/).map((el) => el.textContent)).toEqual(['11', '171'])
        const countdown = open.querySelector('.board-window')
        vi.setSystemTime(right.at)
        rerenderWith({ state: tableState(right) })
        // the sheet already open stays open under the banner, the same element, and gives nothing away while it says who:
        // its header, its numbers, its countdown and its Challenge as before, the Challenge disabled (the window is
        // decided, R-3: a press would be refused)
        expect(panel()).toHaveTextContent('dave challenges!')
        expect(screen.getByTestId('hand-result')).toBe(open)
        expect(within(open).getByRole('heading', { name: 'Hand finished' })).toBeInTheDocument()
        expect(within(open).queryByText('Foul found: Team B takes the hand')).toBeNull()
        expect(within(open).getAllByText(/^(11|171)$/).map((el) => el.textContent)).toEqual(['11', '171'])
        // the old window's countdown runs on, the same element: not restarted yet
        expect(open.querySelector('.board-window')).toBe(countdown)
        expect(within(open).getByRole('button', { name: 'Challenge' })).toBeDisabled()
        after(1199)
        expect(within(open).getByRole('heading', { name: 'Hand finished' })).toBeInTheDocument()
        // the outcome: now the sheet says it too, with the new numbers and the window restarted with the challenge
        after(1)
        expect(panel()).toHaveTextContent('Foul found: Team B takes the hand')
        expect(screen.getByTestId('hand-result')).toBe(open)
        expect(within(open).getByRole('heading', { name: 'Foul found: Team B takes the hand' })).toBeInTheDocument()
        expect(within(open).getAllByText(/^(0|162)$/).map((el) => el.textContent)).toEqual(['0', '162'])
        expect(open.querySelector('.board-window')).not.toBe(countdown)
        expect(within(open).getByText('Next hand in 9 s')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /^Challenge/ })).toBeNull()
        after(2000)
        expect(banner()).toBeNull()
        expect(screen.getByTestId('hand-result')).toBe(open)
        expect(within(open).getByRole('heading', { name: 'Foul found: Team B takes the hand' })).toBeInTheDocument()
    })

    test('a snapshot of the decided window (a reconnect) shows the final header and numbers at once, with no banner', () => {
        vi.useFakeTimers()
        const { right } = rightInWindow()
        vi.setSystemTime(right.at)
        renderBoard({ state: tableState(right, 'carol', 'snapshot') })
        expect(banner()).toBeNull()
        const open = screen.getByTestId('hand-result')
        // (its numbers come from the stored hand, which this test doesn't serve)
        expect(within(open).getByRole('heading', { name: 'Foul found: Team B takes the hand' })).toBeInTheDocument()
        expect(within(open).getByText('Next hand in 10 s')).toBeInTheDocument()
    })

    test('a snapshot during the banner ends it, and the sheet shows the final state at once', () => {
        vi.useFakeTimers()
        const { last, win, right } = rightInWindow()
        vi.setSystemTime(table[last - 1].at)
        const { rerenderWith } = renderBoard({ state: tableState(table[last - 1]) })
        rerenderWith({ state: tableState(table[last]) })
        rerenderWith({ state: tableState(table[win]) })
        after(900)
        vi.setSystemTime(right.at)
        rerenderWith({ state: tableState(right) })
        expect(within(screen.getByTestId('hand-result')).getByRole('heading', { name: 'Hand finished' })).toBeInTheDocument()
        after(300)
        rerenderWith({ state: { ...tableState(right, 'carol', 'snapshot'), receivedAt: right.at + 300 } })
        expect(banner()).toBeNull()
        expect(within(screen.getByTestId('hand-result')).getByRole('heading', { name: 'Foul found: Team B takes the hand' })).toBeInTheDocument()
        expect(within(screen.getByTestId('hand-result')).getByText('Next hand in 10 s')).toBeInTheDocument()
    })

    test('the banner over the docked sheet is opaque: nothing under it shows through', () => {
        expect(css).toMatch(/\.board-banner__panel\[data-place="top"\] \{[^}]*background: var\(--ink\);/)
    })
})

describe('Board: the step before, while the banner says who (gameplay rules §6, D-8)', () => {
    // a desktop, so Bela Blok is the column beside the board
    const DESKTOP = { width: 1440, height: 900 }
    const CHALLENGE = /^Challenge( used)?$/

    /** The stored hands by fan-out `upTo`, as a refetch brings them. */
    function storedHands(fanOuts: readonly FanOut[], upTo: number): MatchHands {
        const hands = devHands(fanOuts, upTo)
        const v = fanOuts[upTo].public
        return { hands, ended: endedHand(hands, { a: v.teamAScore, b: v.teamBScore }), loading: false, error: null, refresh: vi.fn() }
    }

    /** A Challenge button inside `root`: its label, or null. */
    const challengeIn = (root: HTMLElement | null) => (root ? within(root).queryByRole('button', { name: CHALLENGE })?.textContent ?? null : null)

    /** Everything on the board a challenge's outcome changes, besides the hand-result sheet (which keeps its own rule). */
    function shown() {
        return {
            scores: [screen.getByTestId('score-a').textContent, screen.getByTestId('score-b').textContent],
            phase: screen.getByTestId('game-phase').textContent,
            hudChallenge: challengeIn(document.querySelector<HTMLElement>('.board-hud')),
            tags: PLAYERS.filter((id) => within(screen.getByTestId(`seat-${id}`)).queryByText('No challenge') !== null),
            countdowns: screen.queryAllByTestId('turn-countdown').map((el) => el.closest('.board-seat')!.getAttribute('data-testid')),
            yourTurn: screen.queryByTestId('your-turn') !== null,
            trick: screen.queryAllByTestId('trick-card').map((el) => el.getAttribute('data-card')),
            blok: screen.getByTestId('bela-blok').textContent,
        }
    }

    /** The open hand result's header and numbers, and its Challenge. */
    function sheetShown() {
        const sheet = screen.queryByTestId('hand-result')
        if (!sheet) return null
        return { header: within(sheet).getByRole('heading').textContent, numbers: sheet.querySelector('.board-result')?.textContent ?? null, challenge: challengeIn(sheet) }
    }

    /** What `me` sees of fan-out `f` from a snapshot (a reconnect): the outcome, all of it at once. */
    function finalOf(f: FanOut, me: string, hands: MatchHands) {
        vi.useFakeTimers()
        vi.setSystemTime(f.at)
        renderBoard({ state: tableState(f, me, 'snapshot'), me, hands, viewport: DESKTOP })
        const final = { shown: shown(), sheet: sheetShown() }
        cleanup()
        vi.useRealTimers()
        return final
    }

    /** `me`'s board live at fan-out `from` (the step before), with the hands stored by then. */
    function liveFrom(t: FanOut[], from: number, me: string, source: 'live' | 'snapshot' = 'live') {
        vi.useFakeTimers()
        vi.setSystemTime(t[from].at)
        const moves = actions()
        const result = renderBoard({ state: tableState(t[from], me, source), me, hands: storedHands(t, from), viewport: DESKTOP, actions: moves })
        /** The next fan-out, live, at its own time. */
        const step = (i: number, hands = storedHands(t, i - 1)) => {
            vi.setSystemTime(t[i].at)
            result.rerenderWith({ state: tableState(t[i], me), hands })
        }
        return { ...result, moves, step }
    }

    test('a right challenge during play: until WHO_MS the board is the step before (scores, phase, Challenge, countdown, Your turn, the trick, Blok); at WHO_MS the outcome', () => {
        const t = playTable({ challenge: { by: 'dave', after: 2, foul: true } })
        const said = indexOf(t, 'challenge:')
        // the seat to act sees its countdown and "Your turn"; the hand's two cards are on the table
        const me = t[said - 1].public.currentPlayerId!
        expect(me).not.toBe('dave')
        expect(t[said + 1].label).toBe('window-open')
        const final = finalOf(t[said + 2], me, storedHands(t, said + 2))
        const { step } = liveFrom(t, said - 1, me)
        const before = shown()
        expect(before.phase).toBe('Playing')
        expect(before.hudChallenge).toBe('Challenge')
        expect(before.countdowns).toEqual([`seat-${me}`])
        expect(before.yourTurn).toBe(true)
        expect(before.trick).toHaveLength(2)
        expect(final.shown).not.toEqual(before)
        step(said)
        // the window opens, and the refetch brings the hand's stored result: none of it shows while the banner says who
        step(said + 1)
        step(said + 2, storedHands(t, said + 2))
        expect(panel()).toHaveTextContent('dave challenges!')
        expect(shown()).toEqual(before)
        after(WHO_MS - 1)
        expect(panel()).toHaveTextContent('dave challenges!')
        expect(shown()).toEqual(before)
        // the frozen Challenge is the step before's, shown disabled
        expect(within(document.querySelector<HTMLElement>('.board-hud')!).getByRole('button', { name: 'Challenge' })).toBeDisabled()
        after(1)
        expect(panel()).toHaveTextContent('Foul found: Team B takes the hand')
        expect(shown()).toEqual(final.shown)
        // the sheet still waits for the banner (D-8: who, the outcome, then the sheet)
        expect(sheetShown()).toBeNull()
    })

    test('a right challenge in the window: until WHO_MS the HUD, Blok and the open sheet are the step before; at WHO_MS the outcome', () => {
        const t = playTable({ challenge: { by: 'dave', after: 'window', foul: true } })
        const said = indexOf(t, 'challenge:')
        const final = finalOf(t[said], 'carol', storedHands(t, said))
        const { step, rerenderWith } = liveFrom(t, said - 1, 'carol', 'snapshot')
        const before = shown()
        const sheet = sheetShown()!
        expect(sheet.header).toBe('Hand 1')
        expect(sheet.challenge).toBe('Challenge')
        expect(before.hudChallenge).toBeNull()
        expect(final.shown).not.toEqual(before)
        expect(final.sheet).not.toEqual(sheet)
        // the challenge, and the refetch with the corrected hand: the HUD, Blok and the sheet give nothing away yet
        step(said)
        rerenderWith({ hands: storedHands(t, said) })
        after(WHO_MS - 1)
        expect(panel()).toHaveTextContent('dave challenges!')
        expect(shown()).toEqual(before)
        expect(sheetShown()).toEqual(sheet)
        expect(within(screen.getByTestId('hand-result')).getByRole('button', { name: 'Challenge' })).toBeDisabled()
        after(1)
        expect(panel()).toHaveTextContent('Foul found: Team B takes the hand')
        expect(shown()).toEqual(final.shown)
        expect(sheetShown()).toEqual(final.sheet)
        expect(sheetShown()!.challenge).toBeNull()
    })

    test('a wrong challenge: until WHO_MS no "No challenge" tag, and my own Challenge is not yet "Challenge used"; at WHO_MS both', () => {
        const t = playTable({ challenge: { by: 'bob', after: 2, foul: false } })
        const said = indexOf(t, 'challenge:')
        for (const me of ['bob', 'carol']) {
            const final = finalOf(t[said], me, storedHands(t, said))
            const { step } = liveFrom(t, said - 1, me)
            const before = shown()
            expect(before.tags).toEqual([])
            expect(before.hudChallenge, me).toBe('Challenge')
            step(said)
            expect(panel(), me).toHaveTextContent(me === 'bob' ? 'You challenge!' : 'bob challenges!')
            after(WHO_MS - 1)
            expect(shown(), me).toEqual(before)
            expect(screen.getByRole('button', { name: 'Challenge' }), me).toBeDisabled()
            after(1)
            expect(shown(), me).toEqual(final.shown)
            expect(shown().tags, me).toEqual(['bob'])
            expect(shown().hudChallenge, me).toBe(me === 'bob' ? 'Challenge used' : 'Challenge')
            cleanup()
            vi.useRealTimers()
        }
    })

    test('a press on the frozen Challenge sends nothing; from the outcome a press acts on the newest model', () => {
        // carol's own challenge is still there after bob's wrong one: frozen, it is inert all the same
        const wrong = playTable({ challenge: { by: 'bob', after: 2, foul: false } })
        const said = indexOf(wrong, 'challenge:')
        const { step, moves } = liveFrom(wrong, said - 1, 'carol')
        step(said)
        fireEvent.click(screen.getByRole('button', { name: 'Challenge' }))
        expect(moves.challenge).not.toHaveBeenCalled()
        after(WHO_MS)
        expect(screen.getByRole('button', { name: 'Challenge' })).toBeEnabled()
        fireEvent.click(screen.getByRole('button', { name: 'Challenge' }))
        expect(moves.challenge).toHaveBeenCalledTimes(1)
        cleanup()
        vi.useRealTimers()
        // a right one decided the hand: the server would refuse a press ("You can't challenge now")
        const right = playTable({ challenge: { by: 'dave', after: 2, foul: true } })
        const decided = indexOf(right, 'challenge:')
        const board = liveFrom(right, decided - 1, 'carol')
        board.step(decided)
        fireEvent.click(screen.getByRole('button', { name: 'Challenge' }))
        expect(board.moves.challenge).not.toHaveBeenCalled()
        after(WHO_MS)
        expect(screen.queryByRole('button', { name: CHALLENGE })).toBeNull()
        expect(board.moves.challenge).not.toHaveBeenCalled()
    })

    test('the partial trick stays on its slots while the banner says who, even when the view has taken it off the table', () => {
        const right = challenged(table[PLAYING], 'dave', true)
        Object.values(right.private).forEach((priv) => { priv.publicPart.currentTrick = { leadPlayerId: '_NO_LEAD_', trump: null, plays: {} } })
        vi.useFakeTimers()
        renderBoard({ state: tableState(table[PLAYING]) })
        const slots = screen.getAllByTestId('trick-card').map((el) => [el.getAttribute('data-card'), el.style.left, el.style.top])
        cleanup()
        live('carol', right)
        expect(screen.getAllByTestId('trick-card').map((el) => [el.getAttribute('data-card'), el.style.left, el.style.top])).toEqual(slots)
        after(WHO_MS)
        expect(screen.queryAllByTestId('trick-card')).toHaveLength(0)
    })

    test('a new deal while the banner says who (a wrong challenge late in the window) shows the new hand: the step before is a finished hand', () => {
        const t = playTable({ challenge: { by: 'bob', after: 'window', foul: false } })
        const said = indexOf(t, 'challenge:')
        const deal = indexOf(t, 'next-deal', said)
        const { step } = liveFrom(t, said - 1, 'carol', 'snapshot')
        step(said)
        expect(shown().phase).toBe('Hand finished')
        expect(shown().tags).toEqual([])
        // no timer has run: the banner still says who when the window closes and the next hand is dealt
        for (let i = said + 1; i <= deal; i++) step(i)
        expect(panel()).toHaveTextContent('bob challenges!')
        expect(shown().phase).toBe('Bidding')
        expect(shown().tags).toEqual(['bob'])
    })

    test('a snapshot while the banner says who shows the final state at once', () => {
        const t = playTable({ challenge: { by: 'dave', after: 2, foul: true } })
        const said = indexOf(t, 'challenge:')
        const final = finalOf(t[said], 'carol', storedHands(t, said))
        const { rerenderWith } = liveFrom(t, said - 1, 'carol')
        vi.setSystemTime(t[said].at)
        rerenderWith({ state: tableState(t[said], 'carol'), hands: storedHands(t, said) })
        after(300)
        expect(shown()).not.toEqual(final.shown)
        rerenderWith({ state: { ...tableState(t[said], 'carol', 'snapshot'), receivedAt: t[said].at + 300 } })
        expect(banner()).toBeNull()
        expect(shown()).toEqual(final.shown)
        expect(sheetShown()).toEqual(final.sheet)
    })
})

describe('Board: the banner shows above an open hand result on a short landscape screen (S4\'s open item)', () => {
    const SIZES = [{ width: 812, height: 375 }, { width: 375, height: 812 }, { width: 1440, height: 900 }]
    const spotIn = (viewport: { width: number; height: number }, sheetOpen: boolean) => bannerSpot(layoutFor({ ...viewport, dpr: window.devicePixelRatio || 1 }), sheetOpen)

    test('a right challenge in the window: under the HUD in landscape, where the trick goes elsewhere; "Team B" stays on one line', () => {
        expect(css).toMatch(/\.board-banner__panel\[data-place="top"\] \{[^}]*translate: -50% 0;/)
        // the fixture's own: dave's right challenge in hand 1's window, stepped into from the open window
        const t = playTable({ challenge: { by: 'dave', after: 'window', foul: true } })
        const said = indexOf(t, 'challenge:')
        for (const viewport of SIZES) {
            vi.useFakeTimers()
            vi.setSystemTime(t[said - 1].at)
            const { rerenderWith } = renderBoard({ state: tableState(t[said - 1], 'carol', 'snapshot'), viewport })
            vi.setSystemTime(t[said].at)
            rerenderWith({ state: tableState(t[said]) })
            const where = `${viewport.width}x${viewport.height}`
            expect(screen.getByTestId('hand-result'), where).toBeInTheDocument()
            const spot = spotIn(viewport, true)
            expect(spot.top, where).toBe(viewport.width === 812)
            expect(panel()!.style.top, where).toBe(`${spot.y}px`)
            expect(panel()!.dataset.place, where).toBe(spot.top ? 'top' : undefined)
            after(1200)
            // the banner is for the eye: the team's letter never starts a line alone when it wraps on a phone
            expect(panel()!.textContent, where).toBe('Foul found: Team\u00a0B takes the hand')
            expect(panel()!.style.top, where).toBe(`${spot.y}px`)
            cleanup()
            vi.useRealTimers()
        }
    })

    test('a right challenge during play holds the sheet, so the banner stays where the trick goes at every size', () => {
        const t = playTable({ challenge: { by: 'dave', after: 2, foul: true } })
        const said = indexOf(t, 'challenge:')
        for (const viewport of SIZES) {
            vi.useFakeTimers()
            vi.setSystemTime(t[said - 1].at)
            const { rerenderWith } = renderBoard({ state: tableState(t[said - 1]), viewport })
            vi.setSystemTime(t[said].at)
            rerenderWith({ state: tableState(t[said]) })
            const where = `${viewport.width}x${viewport.height}`
            expect(screen.queryByTestId('hand-result'), where).toBeNull()
            expect(panel()!.style.top, where).toBe(`${spotIn(viewport, false).y}px`)
            expect(panel()!.dataset.place, where).toBeUndefined()
            cleanup()
            vi.useRealTimers()
        }
    })
})

describe("Board: an older backend's challenges (no lastChallenge) keep their live-region lines, without toasts", () => {
    test("another seat's failed challenge, and mine", () => {
        const flagged = (by: string) => {
            const f = older(table[PLAYING])
            f.version += 1
            Object.entries(f.private).forEach(([id, priv]) => {
                priv.publicPart.challengeUsedByPlayer[by] = true
                priv.publicPart.stateVersion = f.version
                if (id === by) priv.challengeUsed = true
            })
            return f
        }
        const { rerenderWith } = renderBoard({ state: tableState(older(table[PLAYING])) })
        rerenderWith({ state: tableState(flagged('bob')) })
        expect(logged('bob challenged: no foul found')).toBe(1)
        expect(banner()).toBeNull()
        expect(toast()).toBe('')
        cleanup()
        const mine = renderBoard({ state: tableState(older(table[PLAYING])) })
        mine.rerenderWith({ state: tableState(flagged('carol')) })
        expect(logged('No foul found')).toBe(1)
        expect(toast()).toBe('')
    })

    test('a challenge upheld mid-trick: the live region, the partial trick leaves, then a new deal', () => {
        const { rerenderWith } = renderBoard({ state: tableState(older(table[PLAYING])) })
        expect(screen.getAllByTestId('trick-card')).toHaveLength(2)
        rerenderWith({ state: tableState(older(table[NEXT_DEAL])) })
        expect(logged('Challenge upheld: Team B takes the hand')).toBe(1)
        expect(toast()).toBe('')
        expect(screen.queryAllByTestId('trick-card')).toHaveLength(0)
        expect(screen.getAllByTestId('hand-card')).toHaveLength(6)
    })
})

describe('Board: the live region', () => {
    test('says each event once: the play, then whose turn it is', () => {
        const { rerenderWith } = renderBoard({ state: tableState(table[indexOf(table, 'play:alice:PIK-SEDMICA')]) })
        rerenderWith({ state: tableState(table[PLAYING]) })
        expect([...screen.getByRole('log').children].map((line) => line.textContent)).toEqual(['bob played Baba Pik', 'Your turn'])
        rerenderWith({ state: tableState(table[PLAYING + 1]) })
        expect([...screen.getByRole('log').children].map((line) => line.textContent)).toEqual(['bob played Baba Pik', 'Your turn'])
    })
})
