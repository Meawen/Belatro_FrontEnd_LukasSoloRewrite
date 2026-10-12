import { describe, test, expect, vi, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { ApiError } from '../../services/api'
import { matchService } from '../../services/matchService'
import { useMatchDetails } from './useMatchDetails'
import type { HandDTO, MatchDTO, MoveDTO } from '../../types/match'

afterEach(() => vi.restoreAllMocks())

const MATCH: MatchDTO = {
    id: 'm1', gameMode: 'CASUAL', result: 'Team A wins 1001–650', originLobby: null,
    teamA: [{ id: 'u1', username: 'ana' }, { id: 'u2', username: 'bob' }],
    teamB: [{ id: 'u3', username: 'cy' }, { id: 'u4', username: 'dan' }],
    startTime: null, endTime: null,
}
const HAND: HandDTO = { handNo: 1, trumpCalls: [], tricks: [], challenges: [], handSummary: null }
const MOVE: MoveDTO = { order: 1, player: 'ana', card: 'AS of HERC', legal: true }

/** Each service call answers the next value of its list (the last one repeats); an Error rejects. */
function serve(answers: { match?: unknown[]; hands?: unknown[]; moves?: unknown[] } = {}) {
    const next = (list: unknown[]) => () => {
        const value = list.length > 1 ? list.shift() : list[0]
        return (value instanceof Error ? Promise.reject(value) : Promise.resolve(value)) as never
    }
    return {
        getMatch: vi.spyOn(matchService, 'getMatch').mockImplementation(next(answers.match ?? [MATCH])),
        getStructuredMoves: vi.spyOn(matchService, 'getStructuredMoves').mockImplementation(next(answers.hands ?? [[HAND]])),
        getMoves: vi.spyOn(matchService, 'getMoves').mockImplementation(next(answers.moves ?? [[MOVE]])),
    }
}

/** Lets pending answers land. */
const settle = () => act(async () => {})

describe('useMatchDetails (spec §4.9 details: Data, States)', () => {
    test('asks for the match and its structured moves at once; no raw moves while there are hands', async () => {
        const calls = serve()
        const { result } = renderHook(() => useMatchDetails('m1'))
        expect(result.current.loading).toBe(true)
        expect(calls.getMatch).toHaveBeenCalledWith('m1')
        expect(calls.getStructuredMoves).toHaveBeenCalledWith('m1')
        await settle()
        expect(result.current).toMatchObject({ match: MATCH, hands: [HAND], loading: false, notFound: false, failed: false, handsFailed: false, moves: null })
        expect(calls.getMatch).toHaveBeenCalledTimes(1)
        expect(calls.getStructuredMoves).toHaveBeenCalledTimes(1)
        expect(calls.getMoves).not.toHaveBeenCalled()
    })

    test('without structured hands the raw moves are asked once, for the fallback', async () => {
        const calls = serve({ hands: [[]] })
        const { result } = renderHook(() => useMatchDetails('m1'))
        await settle()
        expect(result.current.hands).toEqual([])
        expect(result.current.moves).toEqual([MOVE])
        expect(calls.getMoves).toHaveBeenCalledTimes(1)
        expect(calls.getMoves).toHaveBeenCalledWith('m1')
    })

    test('a 404, or an answer without a match, is a missing match, not a failure', async () => {
        serve({ match: [new ApiError({ message: 'Not Found', status: 404 })] })
        const missing = renderHook(() => useMatchDetails('m1'))
        await settle()
        expect(missing.result.current).toMatchObject({ match: null, loading: false, notFound: true, failed: false })

        serve({ match: [{}] })
        const empty = renderHook(() => useMatchDetails('m2'))
        await settle()
        expect(empty.result.current).toMatchObject({ match: null, loading: false, notFound: true, failed: false })
    })

    test('any other failure is an error; retry asks for the match again', async () => {
        const calls = serve({ match: [new ApiError({ message: 'Internal Server Error', status: 500 }), MATCH] })
        const { result } = renderHook(() => useMatchDetails('m1'))
        await settle()
        expect(result.current).toMatchObject({ match: null, loading: false, notFound: false, failed: true })
        act(() => result.current.retry())
        expect(result.current).toMatchObject({ loading: true, failed: false })
        await settle()
        expect(result.current).toMatchObject({ match: MATCH, loading: false, failed: false })
        expect(calls.getMatch).toHaveBeenCalledTimes(2)
        expect(calls.getStructuredMoves).toHaveBeenCalledTimes(1)
    })

    test('only the hands failing keeps the match; retryHands asks for the hands alone', async () => {
        const calls = serve({ hands: [new ApiError({ message: 'Bad Gateway', status: 502 }), [HAND]] })
        const { result } = renderHook(() => useMatchDetails('m1'))
        await settle()
        expect(result.current).toMatchObject({ match: MATCH, loading: false, hands: null, handsFailed: true, handsLoading: false })
        act(() => result.current.retryHands())
        expect(result.current).toMatchObject({ loading: false, handsFailed: false, handsLoading: true })
        await settle()
        expect(result.current).toMatchObject({ hands: [HAND], handsFailed: false, handsLoading: false })
        expect(calls.getMatch).toHaveBeenCalledTimes(1)
        expect(calls.getStructuredMoves).toHaveBeenCalledTimes(2)
    })
})
