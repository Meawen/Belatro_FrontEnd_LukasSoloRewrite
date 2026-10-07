import { describe, test, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { matchHistoryService } from '../services/matchHistoryService'
import { useMatchSummary } from './useMatchHistory'
import type { PlayerMatchSummaryDTO } from '../types/user'

const row = (matchId: string): PlayerMatchSummaryDTO =>
    ({ matchId, endTime: null, result: null, yourOutcome: null, gameMode: 'CASUAL' })

afterEach(() => vi.restoreAllMocks())

describe('useMatchSummary paging (US-26)', () => {
    test('a page change within the cache window fetches the new page and shows it', async () => {
        const get = vi.spyOn(matchHistoryService, 'getMatchSummary')
            .mockImplementation(async (_id, page) => [row(`page-${page}`)])
        const { result, rerender } = renderHook(({ page }) => useMatchSummary('u1', page, 10), { initialProps: { page: 0 } })
        await waitFor(() => expect(result.current.matchSummary).toEqual([row('page-0')]))

        rerender({ page: 1 })

        await waitFor(() => expect(result.current.matchSummary).toEqual([row('page-1')]))
        expect(get.mock.calls.map(([, page]) => page)).toEqual([0, 1])
    })
})
