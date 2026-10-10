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
    votes: 0, cancelledBy: null, expired: false, playAgain: vi.fn(), leave: vi.fn(), ...overrides,
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
        expect(screen.getByRole('heading', { name: 'Game over' })).toBeInTheDocument()
        expect(screen.getByText('Team A wins')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Back to lobbies' }))
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
})

describe('Board: Play again after the game (GameTable cases, R-45)', () => {
    test('game over offers Play again and Leave, with how many want a rematch', async () => {
        const user = userEvent.setup()
        const state = rematch({ votes: 2 })
        renderBoard({ state: ended({ gameState: 'COMPLETED', winnerTeamId: 'A' }), rematch: state })
        expect(screen.getByTestId('rematch-votes').textContent).toBe('2/4 want a rematch')
        expect(screen.queryByRole('button', { name: 'Back to lobbies' })).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Play again' }))
        expect(state.playAgain).toHaveBeenCalledTimes(1)
        await user.click(screen.getByRole('button', { name: 'Leave' }))
        expect(state.leave).toHaveBeenCalledTimes(1)
    })

    test('a ranked forfeit offers it too; a plain cancel offers only the way back', () => {
        renderBoard({ state: ended({ gameState: 'CANCELLED', endReason: 'FORFEIT', forfeitTeamId: 'B' }), rematch: rematch() })
        expect(screen.getByRole('button', { name: 'Play again' })).toBeEnabled()
        cleanup()
        renderBoard({ state: ended({ gameState: 'CANCELLED', endReason: 'CANCELLED' }), rematch: rematch() })
        expect(screen.queryByRole('button', { name: 'Play again' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Back to lobbies' })).toBeInTheDocument()
    })

    test('someone left: their name, and Play again is off', () => {
        renderBoard({ state: ended({ gameState: 'COMPLETED', winnerTeamId: 'B' }), rematch: rematch({ votes: 1, cancelledBy: 'bob' }) })
        expect(screen.getByText('bob left — no rematch')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Play again' })).toBeDisabled()
    })

    test('two minutes without a start: Rematch expired, and Play again is off', () => {
        renderBoard({ state: ended({ gameState: 'COMPLETED', winnerTeamId: 'A' }), rematch: rematch({ votes: 3, expired: true }) })
        expect(screen.getByText('Rematch expired')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Play again' })).toBeDisabled()
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
        const end = screen.getByRole('region', { name: 'Game over' })
        expect(within(end).getByText('Team B wins')).toBeInTheDocument()
        // the live region says it too (spec §5.8)
        expect(within(screen.getByRole('log')).getByText('Team B wins')).toBeInTheDocument()
        expect(screen.queryByTestId('end-reason')).not.toBeInTheDocument()
        expect(screen.getByTestId('rematch-votes').textContent).toBe('1/4 want a rematch')
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
