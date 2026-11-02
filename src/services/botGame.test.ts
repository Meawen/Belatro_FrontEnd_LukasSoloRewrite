import { describe, test, expect, vi, afterEach } from 'vitest'
import { apiClient } from './api'
import { startBotGame } from './botGame'

afterEach(() => vi.restoreAllMocks())

describe('startBotGame', () => {
    test('startBotGame posts to /lobbies/bot-game and answers the game and its table (spec §6)', async () => {
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ gameId: 'g7', lobbyId: 'l7' })
        await expect(startBotGame()).resolves.toEqual({ gameId: 'g7', lobbyId: 'l7' })
        expect(post).toHaveBeenCalledWith('/lobbies/bot-game')
    })
})
