import { describe, test, expect, vi, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { userService } from '../services/userService'
import { ApiError } from '../services/api'
import { isNotFound, RATINGS_STALE_MS, useLadder, useRatingHistory } from './useRatings'
import { LADDER, history } from '../test/fixtures/ranks'

function becomeVisible() {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
}

afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    delete (document as { visibilityState?: unknown }).visibilityState
})

// spec §4.3: the chart routes' hooks, in the style of useUser (useApi, its staleTime rule)
describe('useLadder', () => {
    test('answers the ladder', async () => {
        vi.spyOn(userService, 'getLadder').mockResolvedValue(LADDER)
        const { result } = renderHook(() => useLadder())
        await waitFor(() => expect(result.current.data).toEqual(LADDER))
    })

    test('asks nothing while disabled', async () => {
        const getLadder = vi.spyOn(userService, 'getLadder').mockResolvedValue(LADDER)
        renderHook(() => useLadder(false))
        await act(async () => {})
        expect(getLadder).not.toHaveBeenCalled()
    })

    test('the tab coming back into view refetches once the data is stale, and not before', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        const getLadder = vi.spyOn(userService, 'getLadder').mockResolvedValue(LADDER)
        const { result } = renderHook(() => useLadder())
        await waitFor(() => expect(result.current.data).toEqual(LADDER))
        expect(getLadder).toHaveBeenCalledTimes(1)

        vi.setSystemTime(Date.now() + RATINGS_STALE_MS - 1000)
        await act(async () => becomeVisible())
        expect(getLadder).toHaveBeenCalledTimes(1)

        vi.setSystemTime(Date.now() + 2000)
        await act(async () => becomeVisible())
        await waitFor(() => expect(getLadder).toHaveBeenCalledTimes(2))
    })
})

describe('useRatingHistory', () => {
    test('asks for that player', async () => {
        const getRatingHistory = vi.spyOn(userService, 'getRatingHistory').mockResolvedValue(history())
        const { result } = renderHook(() => useRatingHistory('u1'))
        await waitFor(() => expect(result.current.data?.rating).toBe(1452))
        expect(getRatingHistory).toHaveBeenCalledWith('u1')
    })

    test('without a player id asks nothing', async () => {
        const getRatingHistory = vi.spyOn(userService, 'getRatingHistory').mockResolvedValue(history())
        renderHook(() => useRatingHistory(undefined))
        await act(async () => {})
        expect(getRatingHistory).not.toHaveBeenCalled()
    })

    test('a 404 is told apart from other failures (an old backend, spec §4.2)', async () => {
        vi.spyOn(userService, 'getRatingHistory').mockRejectedValue(new ApiError({ message: 'Not Found', status: 404 }))
        const { result } = renderHook(() => useRatingHistory('u1'))
        await waitFor(() => expect(result.current.error).not.toBeNull())
        expect(isNotFound(result.current.error)).toBe(true)
        expect(isNotFound(new ApiError({ message: 'boom', status: 500 }))).toBe(false)
        expect(isNotFound(null)).toBe(false)
    })
})
