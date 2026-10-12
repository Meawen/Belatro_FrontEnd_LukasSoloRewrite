import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { act, cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { actions, renderBoard, tableState } from './testing'
import { find, indexOf, playTable, type FanOut } from '../../test/fixtures/views/table'

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
    test('a quiet "No challenge" tag on the spent seat for every viewer, said "bob: no challenge left", still there after the next deal', () => {
        for (const me of PLAYERS) {
            const { rerenderWith } = live(me, challenged(table[PLAYING], 'bob', false))
            const check = (when: string) => {
                const seat = screen.getByTestId('seat-bob')
                expect(within(seat).getByText('No challenge'), `${me} ${when}`).toBeInTheDocument()
                expect(within(seat).getByText(me === 'bob' ? 'You: no challenge left' : 'bob: no challenge left'), `${me} ${when}`).toHaveClass('sr-only')
                for (const other of PLAYERS.filter((id) => id !== 'bob')) {
                    expect(screen.getByTestId(`seat-${other}`), `${me} ${when}`).not.toHaveTextContent(/no challenge/i)
                }
            }
            check('at once')
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
        // a newer state is (here another seat's wrong challenge: mine is still there)
        rerenderWith({ state: tableState(challenged(table[PLAYING], 'bob', false)) })
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

    test('hidden in the window a right challenge decided (R-3), in the HUD and in the sheet', () => {
        const right = challenged(table[PLAYING], 'dave', true)
        for (const me of ['carol', 'dave']) {
            const { rerenderWith } = renderBoard({ state: tableState(table[PLAYING], me), me })
            rerenderWith({ state: tableState(right, me) })
            expect(screen.getByTestId('hand-result'), me).toBeInTheDocument()
            expect(screen.queryByRole('button', { name: /^Challenge/ }), me).toBeNull()
            expect(screen.queryByTestId('challenge-hint'), me).toBeNull()
            cleanup()
        }
    })
})

describe('Board: the hand result after a right challenge (gameplay rules §6, D-8)', () => {
    test('the sheet rises at once, the table clear: its header names the challengers, the new numbers and the countdown; the cards stay in hand', () => {
        vi.useFakeTimers()
        const right = challenged(table[PLAYING], 'dave', true)
        vi.setSystemTime(table[PLAYING].at)
        const { rerenderWith } = renderBoard({ state: tableState(table[PLAYING]) })
        expect(screen.getAllByTestId('trick-card')).toHaveLength(2)
        const held = screen.getAllByTestId('hand-card').length
        vi.setSystemTime(right.at)
        rerenderWith({ state: tableState(right) })
        // the partial trick leaves the table with the hand; nothing is held, so the sheet is up at once
        expect(screen.queryAllByTestId('trick-card')).toHaveLength(0)
        const sheet = screen.getByTestId('hand-result')
        expect(within(sheet).getByRole('heading', { name: 'Foul found: Team B takes the hand' })).toBeInTheDocument()
        // carol is in team A: Mi 0, Vi 162 from the scores the board saw change
        expect(within(sheet).getAllByText(/^(0|162)$/).map((el) => el.textContent)).toEqual(['0', '162'])
        expect(within(sheet).getByText('Next hand in 10 s')).toBeInTheDocument()
        expect(screen.getAllByTestId('hand-card')).toHaveLength(held)
        // the banner is up above it, then gone; the sheet stays for its window
        expect(panel()).toHaveTextContent('dave challenges!')
        after(1200)
        expect(panel()).toHaveTextContent('Foul found: Team B takes the hand')
        after(2000)
        expect(banner()).toBeNull()
        expect(screen.getByTestId('hand-result')).toBeInTheDocument()
    })
})

describe('Board: a right challenge in the window (gameplay rules §1, R-4)', () => {
    test('the open sheet takes the header and the new numbers, its countdown restarts, and no Challenge is left in it', () => {
        vi.useFakeTimers()
        const last = indexOf(table, 'hand-complete')
        const win = indexOf(table, 'window-open')
        vi.setSystemTime(table[last - 1].at)
        const { rerenderWith } = renderBoard({ state: tableState(table[last - 1]) })
        rerenderWith({ state: tableState(table[last]) })
        rerenderWith({ state: tableState(table[win]) })
        after(900)
        // carol is in team A: Mi 11, Vi 171 as the hand was played
        expect(within(screen.getByTestId('hand-result')).getAllByText(/^(11|171)$/).map((el) => el.textContent)).toEqual(['11', '171'])
        // dave's right challenge takes the award back: team B 162, team A nothing, the window again at 10 s
        const right = structuredClone(table[win])
        right.at += 3000
        Object.assign(right.private.carol.publicPart, {
            teamAScore: 0, teamBScore: 162, stateVersion: right.version + 1, serverNow: right.at, challengeWindowExpiresAt: right.at + 10_000,
            lastChallenge: { number: 1, playerId: 'dave', team: 'B', foulFound: true, thisHand: true },
        })
        vi.setSystemTime(right.at)
        rerenderWith({ state: tableState(right) })
        const sheet = screen.getByTestId('hand-result')
        expect(within(sheet).getByRole('heading', { name: 'Foul found: Team B takes the hand' })).toBeInTheDocument()
        expect(within(sheet).getAllByText(/^(0|162)$/).map((el) => el.textContent)).toEqual(['0', '162'])
        expect(within(sheet).getByText('Next hand in 10 s')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /^Challenge/ })).toBeNull()
        expect(panel()).toHaveTextContent('dave challenges!')
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
