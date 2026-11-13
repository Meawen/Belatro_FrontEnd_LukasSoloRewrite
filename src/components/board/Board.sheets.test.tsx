import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { actions, privateFor, renderBoard, stateOf, tableState, view } from './testing'
import { endedHand } from './model/hands'
import { devHands } from '../../dev/devTable'
import { indexOf, playTable, type FanOut } from '../../test/fixtures/views/table'
import type { MatchHands } from '../../hooks/useMatchHands'
import type { RematchState } from '../../hooks/useRematch'
import type { PublicGameView } from '../../types/game'
import type { HandDTO } from '../../types/match'
import { setLang } from '../../i18n/lang'

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
const ended = (overrides: Partial<PublicGameView>) => stateOf(privateFor(view(overrides), false))
const rematch = (overrides: Partial<RematchState> = {}): RematchState => ({
    votes: 0, voted: false, cancelledBy: null, expired: false, playAgain: vi.fn(), leave: vi.fn(), ...overrides,
})
/** The structured moves as the server would have stored them by this fan-out. */
function storedHands(fanOuts: readonly FanOut[], upTo: number): MatchHands {
    const hands = devHands(fanOuts, upTo)
    const v = fanOuts[upTo].public
    return { hands, ended: endedHand(hands, { a: v.teamAScore, b: v.teamBScore }), loading: false, error: null, refresh: vi.fn() }
}

describe('Board: the end of the game (GameTable cases, R-20, R-25, R-31)', () => {
    test('a finished game names the winner and offers the way back', async () => {
        const user = userEvent.setup()
        const { props } = renderBoard({ state: ended({ gameState: 'COMPLETED', winnerTeamId: 'A', teamAScore: 1001, teamBScore: 640 }) })
        expect(screen.getByRole('heading', { name: 'You won!' })).toBeInTheDocument()
        expect(screen.getByText('Team A wins')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Home' }))
        expect(props.onLeave).toHaveBeenCalledTimes(1)
    })

    test.each([
        ['FORFEIT by A', { endReason: 'FORFEIT', forfeitTeamId: 'A' }, 'Team A forfeited — Team B wins'],
        ['FORFEIT by B', { endReason: 'FORFEIT', forfeitTeamId: 'B' }, 'Team B forfeited — Team A wins'],
        ['ABANDONED by A', { endReason: 'ABANDONED', forfeitTeamId: 'A' }, 'Team A left — the game was abandoned (no result)'],
        ['ABANDONED by both teams', { endReason: 'ABANDONED', forfeitTeamId: null }, 'Everyone left — the game was abandoned (no result)'],
        ['DECLINED', { endReason: 'DECLINED', forfeitTeamId: null }, "A player declined — you're back in the queue"],
        ['CANCELLED', { endReason: 'CANCELLED', forfeitTeamId: null }, 'The game was cancelled'],
    ] as const)('an end by %s says why', (_label, ending, sentence) => {
        renderBoard({ state: ended({ gameState: 'CANCELLED', ...ending }) })
        expect(screen.getByTestId('end-reason').textContent).toBe(sentence)
    })

    test('a forfeit is a game over with a winner, not a cancelled match', () => {
        renderBoard({ state: ended({ gameState: 'CANCELLED', endReason: 'FORFEIT', forfeitTeamId: 'B' }) })
        expect(screen.getByRole('heading', { name: 'Game over' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Match cancelled' })).not.toBeInTheDocument()
    })

    test("a guest's end sheet leaves out Match details, a member-only page (spec §3.3)", () => {
        renderBoard({ state: ended({ gameState: 'COMPLETED', winnerTeamId: 'A', teamAScore: 1001, teamBScore: 640 }), guest: true })
        expect(screen.queryByRole('link', { name: 'Match details' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    })

    test('one primary action in each ending: Play again when a rematch may follow, else the way out (spec §8)', () => {
        const primaries = () => [...document.querySelectorAll('.board-end .ui-btn--primary')].map((button) => button.textContent)
        renderBoard({ state: ended({ gameState: 'COMPLETED', winnerTeamId: 'A' }), rematch: rematch() })
        expect(primaries()).toEqual(['Play again'])
        cleanup()
        renderBoard({ state: ended({ gameState: 'CANCELLED', endReason: 'CANCELLED' }) })
        expect(primaries()).toEqual(['Home'])
    })

    test("a guest's end: Play again, Play with people and Back; with no rematch, Back and Play with people (spec §6)", async () => {
        const user = userEvent.setup()
        const buttons = () => within(document.querySelector<HTMLElement>('.board-end')!).getAllByRole('button').map((button) => button.textContent)
        const onSignUp = vi.fn()
        const { props } = renderBoard({ state: ended({ gameState: 'COMPLETED', winnerTeamId: 'A' }), rematch: rematch(), guest: true, onSignUp })
        expect(buttons()).toEqual(['Play again', 'Play with people', 'Back'])
        expect(screen.queryByRole('button', { name: 'Home' })).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Play with people' }))
        expect(onSignUp).toHaveBeenCalledTimes(1)
        await user.click(screen.getByRole('button', { name: 'Back' }))
        expect(props.onLeave).toHaveBeenCalledTimes(1)
        cleanup()
        renderBoard({ state: ended({ gameState: 'CANCELLED', endReason: 'CANCELLED' }), guest: true, onSignUp })
        expect(buttons()).toEqual(['Back', 'Play with people'])
        expect([...document.querySelectorAll('.board-end .ui-btn--primary')].map((button) => button.textContent)).toEqual(['Back'])
    })

    test('a member never sees Play with people, even when the page passes it', () => {
        renderBoard({ state: ended({ gameState: 'COMPLETED', winnerTeamId: 'A' }), rematch: rematch(), onSignUp: vi.fn() })
        expect(screen.queryByRole('button', { name: 'Play with people' })).not.toBeInTheDocument()
        cleanup()
        renderBoard({ state: ended({ gameState: 'CANCELLED', endReason: 'CANCELLED' }), onSignUp: vi.fn() })
        expect(screen.queryByRole('button', { name: 'Play with people' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
    })

    test("the guest's end in Croatian (§1.4, §6)", () => {
        setLang('hr')
        try {
            renderBoard({ state: ended({ gameState: 'COMPLETED', winnerTeamId: 'A' }), rematch: rematch(), guest: true, onSignUp: vi.fn() })
            expect(within(document.querySelector<HTMLElement>('.board-end')!).getAllByRole('button').map((button) => button.textContent))
                .toEqual(['Ajmo još jednu!', 'Igraj s ljudima', 'Natrag'])
        } finally {
            setLang('en')
        }
    })
})

describe('Board: Play again after the game (GameTable cases, R-45)', () => {
    test('game over offers Play again and Home, with how many want a rematch', async () => {
        const user = userEvent.setup()
        const state = rematch({ votes: 2 })
        const { props } = renderBoard({ state: ended({ gameState: 'COMPLETED', winnerTeamId: 'A' }), rematch: state })
        expect(screen.getByTestId('rematch-votes').textContent).toBe('2/4 want to play again')
        expect(screen.queryByRole('button', { name: 'Back to tables' })).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Play again' }))
        expect(state.playAgain).toHaveBeenCalledTimes(1)
        await user.click(screen.getByRole('button', { name: 'Home' }))
        expect(props.onLeave).toHaveBeenCalledTimes(1)
        // the page declines the rematch on the way out (GamePageConnected)
        expect(state.leave).not.toHaveBeenCalled()
    })

    test('a ranked forfeit offers it too; a plain cancel offers only the way back', () => {
        renderBoard({ state: ended({ gameState: 'CANCELLED', endReason: 'FORFEIT', forfeitTeamId: 'B' }), rematch: rematch() })
        expect(screen.getByRole('button', { name: 'Play again' })).toBeEnabled()
        cleanup()
        renderBoard({ state: ended({ gameState: 'CANCELLED', endReason: 'CANCELLED' }), rematch: rematch() })
        expect(screen.queryByRole('button', { name: 'Play again' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
    })

    test('someone left: their name, and Play again is off', () => {
        renderBoard({ state: ended({ gameState: 'COMPLETED', winnerTeamId: 'B' }), rematch: rematch({ votes: 1, cancelledBy: 'bob' }) })
        expect(screen.getByText('bob left — no new game')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Play again' })).toBeDisabled()
    })

    test('after my vote, Play again is off until the outcome: a second tap sends no second vote (R29)', async () => {
        const user = userEvent.setup()
        const state = rematch({ votes: 1, voted: true })
        renderBoard({ state: ended({ gameState: 'COMPLETED', winnerTeamId: 'A' }), rematch: state })
        expect(screen.getByRole('button', { name: 'Play again' })).toBeDisabled()
        await user.click(screen.getByRole('button', { name: 'Play again' }))
        expect(state.playAgain).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: 'Home' })).toBeEnabled()
    })

    test('two minutes without a start: Rematch expired, and Play again is off', () => {
        renderBoard({ state: ended({ gameState: 'COMPLETED', winnerTeamId: 'A' }), rematch: rematch({ votes: 3, expired: true }) })
        expect(screen.getByText('Too late to play again')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Play again' })).toBeDisabled()
    })

    test('the end in Croatian: win, loss, forfeit (§1.4, §6)', () => {
        setLang('hr')
        try {
            renderBoard({ state: ended({ gameState: 'COMPLETED', winnerTeamId: 'A' }), rematch: rematch({ votes: 2 }) })
            expect(screen.getByRole('heading', { name: 'Kaj ste dobri, pajdaši!' })).toBeInTheDocument()
            expect(screen.getByText('Ekipa A je pobijedila')).toBeInTheDocument()
            expect(screen.getByTestId('rematch-votes').textContent).toBe('2/4 za još jednu')
            expect(screen.getByRole('button', { name: 'Ajmo još jednu!' })).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Doma' })).toBeInTheDocument()
            expect(screen.getByRole('link', { name: 'Detalji partije' })).toHaveAttribute('href', '/matches/g1')
            cleanup()
            renderBoard({ state: ended({ gameState: 'COMPLETED', winnerTeamId: 'B' }) })
            expect(screen.getByRole('heading', { name: 'Bu bolje drugi put.' })).toBeInTheDocument()
            expect(screen.getByText('Ekipa B je pobijedila')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Doma' })).toBeInTheDocument()
            cleanup()
            renderBoard({ state: ended({ gameState: 'CANCELLED', endReason: 'FORFEIT', forfeitTeamId: 'B' }) })
            expect(screen.getByRole('heading', { name: 'Kraj partije' })).toBeInTheDocument()
            expect(screen.getByTestId('end-reason').textContent).toBe('Ekipa B je predala — pobijedila je ekipa A')
            cleanup()
            renderBoard({ state: ended({ gameState: 'COMPLETED', winnerTeamId: 'B' }), rematch: rematch({ votes: 1, cancelledBy: 'bob' }) })
            expect(screen.getByText('bob odlazi — nema nove partije')).toBeInTheDocument()
            cleanup()
            renderBoard({ state: ended({ gameState: 'COMPLETED', winnerTeamId: 'A' }), rematch: rematch({ votes: 3, expired: true }) })
            expect(screen.getByText('Prekasno je za još jednu')).toBeInTheDocument()
        } finally {
            setLang('en')
        }
    })
})

describe('Board: the hand result and the end sheet on real views (spec §5.4, R-48, US-33, US-38)', () => {
    test('after the 8th trick sweeps, the hand result rises; "Next hand shortly" until the window opens, then its bar', () => {
        vi.useFakeTimers()
        const last = indexOf(table, 'hand-complete')
        const { rerenderWith } = renderBoard({ state: tableState(table[last - 1]) })
        rerenderWith({ state: tableState(table[last]) })
        expect(screen.queryByTestId('hand-result')).not.toBeInTheDocument()
        act(() => { vi.advanceTimersByTime(900) })
        const sheet = screen.getByTestId('hand-result')
        expect(sheet).toHaveAttribute('role', 'region')
        expect(within(sheet).getByRole('heading', { name: 'Hand finished' })).toBeInTheDocument()
        expect(within(sheet).getByText('Next hand shortly')).toBeInTheDocument()
        // carol is in team A: Mi 11, Vi 171 from the scores the board saw change
        expect(within(sheet).getAllByText(/^(11|171)$/).map((el) => el.textContent)).toEqual(['11', '171'])
        rerenderWith({ state: tableState(table[last + 1]), hands: storedHands(table, last + 1) })
        expect(within(screen.getByTestId('hand-result')).getByRole('heading', { name: 'Hand 1' })).toBeInTheDocument()
        expect(screen.getByText(/^Next hand in \d+ s$/)).toBeInTheDocument()
        expect(screen.queryByText('Next hand shortly')).not.toBeInTheDocument()
    })

    test('while the last trick is held, Challenge and its hint stay in the HUD; then they move into the sheet (spec §5.3.5 rule 5)', () => {
        vi.useFakeTimers()
        const last = indexOf(table, 'hand-complete')
        const { rerenderWith } = renderBoard({ state: tableState(table[last - 1]) })
        rerenderWith({ state: tableState(table[indexOf(table, 'window-open')]) })
        expect(screen.queryByTestId('hand-result')).not.toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: 'Challenge' })).toHaveLength(1)
        expect(screen.getAllByTestId('challenge-hint')).toHaveLength(1)
        act(() => { vi.advanceTimersByTime(900) })
        const sheet = screen.getByTestId('hand-result')
        expect(screen.getAllByRole('button', { name: 'Challenge' })).toHaveLength(1)
        expect(within(sheet).getByRole('button', { name: 'Challenge' })).toBeInTheDocument()
        expect(screen.getAllByTestId('challenge-hint')).toHaveLength(1)
    })

    test('Challenge and its hint sit in the hand-result sheet in HAND_COMPLETE, not in the HUD', async () => {
        const user = userEvent.setup()
        const moves = actions()
        renderBoard({ state: tableState(table[indexOf(table, 'window-open')]), actions: moves })
        const sheet = screen.getByTestId('hand-result')
        expect(within(sheet).getByTestId('challenge-hint')).toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: 'Challenge' })).toHaveLength(1)
        await user.click(within(sheet).getByRole('button', { name: 'Challenge' }))
        expect(moves.challenge).toHaveBeenCalledTimes(1)
    })

    test('the deciding hand: its window, then the end sheet with the winner and the final score, and Match details', async () => {
        const decider = playTable({ scores: [990, 900] })
        const window = indexOf(decider, 'window-open')
        const { rerenderWith } = renderBoard({ state: tableState(decider[window]), rematch: rematch({ votes: 1 }) })
        expect(screen.getByTestId('hand-result')).toBeInTheDocument()
        expect(screen.getByText(/^Next hand in \d+ s$/)).toBeInTheDocument()
        rerenderWith({ state: tableState(decider[indexOf(decider, 'window-close')]) })
        rerenderWith({ state: tableState(decider[indexOf(decider, 'game-over')]) })
        // the hand result goes back down as the end sheet rises
        await waitFor(() => expect(screen.queryByTestId('hand-result')).not.toBeInTheDocument())
        const end = screen.getByRole('region', { name: 'Next time.' })
        expect(within(end).getByText('Team B wins')).toBeInTheDocument()
        // the live region says it too (spec §5.8)
        expect(within(screen.getByRole('log')).getByText('Team B wins')).toBeInTheDocument()
        expect(screen.queryByTestId('end-reason')).not.toBeInTheDocument()
        expect(screen.getByTestId('rematch-votes').textContent).toBe('1/4 want to play again')
        expect(screen.getByRole('link', { name: 'Match details' })).toHaveAttribute('href', '/matches/g1')
        expect(screen.getByTestId('score-a').textContent).toBe('1001')
        expect(within(end).getByText('1001')).toHaveClass('t-score-xl')
    })

    test('each kept test id at most once through the deciding hand and the end', () => {
        const decider = playTable({ scores: [990, 900] })
        const singular = ['game-phase', 'your-turn', 'trump', 'score-a', 'score-b', 'end-reason', 'dealer-must-call', 'bela-prompt',
            'challenge-hint', 'rematch-votes', 'turn-countdown', 'your-team', 'hand', 'dealer-chip', 'arena', 'pile-a', 'pile-b', 'hand-result']
        const { rerenderWith } = renderBoard({ state: tableState(decider[indexOf(decider, 'hand-complete') - 1]), rematch: rematch() })
        for (const fanOut of decider.slice(indexOf(decider, 'hand-complete'))) {
            rerenderWith({ state: tableState(fanOut) })
            const count = new Map<string, number>()
            document.querySelectorAll('[data-testid]').forEach((el) => {
                const id = el.getAttribute('data-testid')!
                count.set(id, (count.get(id) ?? 0) + 1)
            })
            for (const id of singular) expect(count.get(id) ?? 0, `${fanOut.label}: ${id}`).toBeLessThanOrEqual(1)
        }
    })
})

describe('Board: the hand result says padanje, štiglja and the zvanja (§1.4)', () => {
    // carol (team A) called and fell; team B took all eight tricks (capot) and declared 20
    const hand: HandDTO = {
        handNo: 1, trumpCalls: [{ order: 0, player: 'carol', trump: 'HERC' }], tricks: [], challenges: [],
        handSummary: {
            teamAPoints: 0, teamBPoints: 252, teamADeclPoints: 0, teamBDeclPoints: 20, teamATricksWon: 0, teamBTricksWon: 8,
            padanje: true, capot: true, finalScoreA: 0, finalScoreB: 272,
        },
    }
    const result = (me = 'carol') => renderBoard({
        state: stateOf(privateFor(view({ gameState: 'HAND_COMPLETE', teamAScore: 0, teamBScore: 272 }), false)),
        hands: { hands: [hand], ended: hand, loading: false, error: null, refresh: vi.fn() },
        me,
    })

    test('in English: "Fell! You fell." on my row, "They fell." on theirs, Capot and the zvanja', () => {
        result()
        const sheet = screen.getByTestId('hand-result')
        expect(within(sheet).getByRole('heading', { name: 'Hand 1' })).toBeInTheDocument()
        expect(within(sheet).getByText('Fell! You fell.')).toBeInTheDocument()
        expect(within(sheet).getByText('Capot')).toBeInTheDocument()
        expect(within(sheet).getByText('incl. 20 from declarations')).toBeInTheDocument()
        expect(within(sheet).getByText('Next hand shortly')).toBeInTheDocument()
        expect(within(sheet).queryByText('They fell.')).not.toBeInTheDocument()
        cleanup()
        result('bob')
        expect(within(screen.getByTestId('hand-result')).getByText('They fell.')).toBeInTheDocument()
        expect(screen.queryByText('Fell! You fell.')).not.toBeInTheDocument()
    })

    test('in Croatian: "Pad! Pali ste.", "Pad! Pali su.", "Štiglja!"', () => {
        setLang('hr')
        try {
            result()
            const sheet = screen.getByTestId('hand-result')
            expect(within(sheet).getByRole('heading', { name: 'Dijeljenje 1' })).toBeInTheDocument()
            expect(within(sheet).getByText('Pad! Pali ste.')).toBeInTheDocument()
            expect(within(sheet).getByText('Štiglja!')).toBeInTheDocument()
            expect(within(sheet).getByText('od toga zvanja 20')).toBeInTheDocument()
            expect(within(sheet).getByText('Sljedeće dijeljenje uskoro')).toBeInTheDocument()
            expect(within(sheet).getByRole('button', { name: 'Prijavi prekršaj' })).toBeInTheDocument()
            cleanup()
            result('bob')
            expect(within(screen.getByTestId('hand-result')).getByText('Pad! Pali su.')).toBeInTheDocument()
        } finally {
            setLang('en')
        }
    })

    test('a team that fell shows no declarations beside its 0, in either language (R1-44)', () => {
        // carol's team A declared 50 and fell: the server's summary still carries the 50 (BelotGame's hand end)
        const fell: HandDTO = { ...hand, handSummary: { ...hand.handSummary!, teamADeclPoints: 50, teamBDeclPoints: 0, capot: false } }
        const shown = () => renderBoard({
            state: stateOf(privateFor(view({ gameState: 'HAND_COMPLETE', teamAScore: 0, teamBScore: 272 }), false)),
            hands: { hands: [fell], ended: fell, loading: false, error: null, refresh: vi.fn() },
            me: 'carol',
        })
        shown()
        const sheet = screen.getByTestId('hand-result')
        expect(within(sheet).getByText('Fell! You fell.')).toBeInTheDocument()
        expect(within(sheet).queryByText(/^incl\. /)).not.toBeInTheDocument()
        cleanup()
        setLang('hr')
        try {
            shown()
            expect(within(screen.getByTestId('hand-result')).getByText('Pad! Pali ste.')).toBeInTheDocument()
            expect(within(screen.getByTestId('hand-result')).queryByText(/^od toga zvanja/)).not.toBeInTheDocument()
        } finally {
            setLang('en')
        }
    })

    test("in the window: the bar's seconds in Croatian", () => {
        setLang('hr')
        try {
            renderBoard({ state: stateOf(privateFor(view({ gameState: 'HAND_COMPLETE', challengeWindowExpiresAt: Date.now() + 8_000 }), false)) })
            expect(within(screen.getByTestId('hand-result')).getByText(/^Sljedeće dijeljenje za \d+ s$/)).toBeInTheDocument()
        } finally {
            setLang('en')
        }
    })
})
