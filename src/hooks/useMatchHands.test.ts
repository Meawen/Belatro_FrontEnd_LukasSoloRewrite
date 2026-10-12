import { describe, test, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { matchService } from '../services/matchService'
import { useMatchHands } from './useMatchHands'
import type { PublicGameView } from '../types/game'
import type { HandDTO, HandSummary } from '../types/match'

afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
})

const summary = (finalScoreA: number, finalScoreB: number): HandSummary => ({
    teamAPoints: 0, teamBPoints: 0, teamADeclPoints: 0, teamBDeclPoints: 0, teamATricksWon: 4, teamBTricksWon: 4,
    padanje: false, capot: false, finalScoreA, finalScoreB,
})
let order = 0
const tricks = (cards: number) => Array.from({ length: Math.ceil(cards / 4) }, (_, t) => ({
    trickNo: t + 1, winnerId: 'bob', points: 0, lastTrickBonus: false,
    moves: ['alice', 'bob', 'carol', 'dave'].slice(0, Math.min(4, cards - t * 4)).map((player) => ({ order: ++order, player, card: 'AS of HERC', legal: null })),
}))
const hand = (handNo: number, cards: number, s: HandSummary | null): HandDTO =>
    ({ handNo, trumpCalls: [{ order: 0, player: 'bob', trump: 'HERC' }], tricks: tricks(cards), challenges: [], handSummary: s })
const view = (gameState: PublicGameView['gameState'], teamAScore = 0, teamBScore = 0) => ({ gameState, teamAScore, teamBScore }) as PublicGameView

/** A fetch the test answers by hand. */
function deferred() {
    const calls: { resolve: (hands: HandDTO[]) => void; reject: (e: unknown) => void }[] = []
    const spy = vi.spyOn(matchService, 'getStructuredMoves').mockImplementation(() => new Promise((resolve, reject) => { calls.push({ resolve, reject }) }))
    return { calls, spy }
}

describe('useMatchHands (spec §5.2, §5.3.3)', () => {
    test('fetches on mount; a refresh while one is in flight runs one more after it, never two at once', async () => {
        const { calls, spy } = deferred()
        const { result } = renderHook(() => useMatchHands('g1', view('PLAYING')))
        expect(spy).toHaveBeenCalledWith('g1')
        expect(result.current.loading).toBe(true)
        act(() => {
            result.current.refresh()
            result.current.refresh()
        })
        expect(spy).toHaveBeenCalledTimes(1)
        const answer = [hand(1, 12, null)]
        await act(async () => calls[0].resolve(answer))
        expect(result.current.hands).toBe(answer)
        expect(spy).toHaveBeenCalledTimes(2)
        await act(async () => calls[1].resolve([]))
        expect(spy).toHaveBeenCalledTimes(2)
        expect(result.current.loading).toBe(false)
    })

    test('entering HAND_COMPLETE expects the hand just ended: retries every 500 ms, at most 3 times, until the store has it whole', async () => {
        vi.useFakeTimers()
        const done = [hand(1, 32, summary(162, 0)), hand(2, 32, summary(250, 74))]
        const lagging = [hand(1, 32, summary(162, 0)), hand(2, 31, summary(250, 74))]
        const answers = [[hand(1, 32, summary(162, 0)), hand(2, 28, null)], lagging, lagging, done]
        const spy = vi.spyOn(matchService, 'getStructuredMoves').mockImplementation(async () => answers.shift() ?? done)
        const { result, rerender } = renderHook(({ v }) => useMatchHands('g1', v), { initialProps: { v: view('PLAYING', 162, 0) } })
        await act(async () => {})
        expect(spy).toHaveBeenCalledTimes(1)
        rerender({ v: view('HAND_COMPLETE', 250, 74) })
        await act(async () => {})
        expect(spy).toHaveBeenCalledTimes(2)
        expect(result.current.ended).toBeNull()
        await act(async () => { vi.advanceTimersByTime(500) })
        expect(spy).toHaveBeenCalledTimes(3)
        await act(async () => { vi.advanceTimersByTime(500) })
        expect(spy).toHaveBeenCalledTimes(4)
        expect(result.current.ended?.handNo).toBe(2)
        await act(async () => { vi.advanceTimersByTime(5000) })
        expect(spy).toHaveBeenCalledTimes(4)
    })

    test('gives up after 3 retries; the hand-result then shows the score change instead', async () => {
        vi.useFakeTimers()
        const spy = vi.spyOn(matchService, 'getStructuredMoves').mockResolvedValue([hand(1, 31, summary(162, 0))])
        const { result } = renderHook(() => useMatchHands('g1', view('HAND_COMPLETE', 162, 0)))
        for (let i = 0; i < 6; i++) await act(async () => { vi.advanceTimersByTime(500) })
        // the mount fetch, the expected hand's fetch, and its 3 retries
        expect(spy).toHaveBeenCalledTimes(5)
        expect(result.current.ended).toBeNull()
    })

    test('an error is shown, and cleared by the next answer; a late answer after unmount is ignored', async () => {
        const { calls } = deferred()
        const { result, unmount } = renderHook(() => useMatchHands('g1', view('PLAYING')))
        await act(async () => calls[0].reject(new Error('Match not found')))
        expect(result.current.error).toBe('Match not found')
        act(() => result.current.refresh())
        await act(async () => calls[1].resolve([]))
        expect(result.current.error).toBeNull()
        act(() => result.current.refresh())
        unmount()
        await act(async () => calls[2].resolve([hand(1, 4, null)]))
        expect(result.current.hands).toEqual([])
    })
})
