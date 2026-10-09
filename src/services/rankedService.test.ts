import { describe, test, expect, vi, afterEach } from 'vitest'
import { apiClient } from './api'
import { rankedService } from './rankedService'

afterEach(() => vi.restoreAllMocks())

describe('rankedService', () => {
    test('declineMatch posts to /ranked/matches/{gameId}/decline', async () => {
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
        await rankedService.declineMatch('g1')
        expect(post).toHaveBeenCalledWith('/ranked/matches/g1/decline')
    })
})
