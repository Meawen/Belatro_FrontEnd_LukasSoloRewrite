import { describe, test, expect, vi, afterEach } from 'vitest'
import { apiClient } from './api'
import { lobbyService } from './lobbyService'

afterEach(() => vi.restoreAllMocks())

describe('lobbyService routes match LobbyController', () => {
    test('start uses POST /lobbies/{id}/start-match', async () => {
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ id: 'm1' })
        await expect(lobbyService.startMatch('l1')).resolves.toEqual({ id: 'm1' })
        expect(post).toHaveBeenCalledWith('/lobbies/l1/start-match')
    })

    test('switch team uses POST /lobbies/switchTeam with the lobby id in the body', async () => {
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
        await lobbyService.switchTeam('l1', { lobbyId: 'l1', targetTeam: 'B' })
        expect(post).toHaveBeenCalledWith('/lobbies/switchTeam', { lobbyId: 'l1', targetTeam: 'B' })
    })

    test('kick sends only the target; leave sends no body', async () => {
        const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({})
        await lobbyService.kickPlayer('l1', { usernameToKick: 'bob' })
        expect(patch).toHaveBeenCalledWith('/lobbies/l1/kick', { usernameToKick: 'bob' })
        await lobbyService.leaveLobby('l1')
        expect(patch.mock.calls[1]).toEqual(['/lobbies/l1/leave'])
    })

    test('update is PUT /lobbies with the id in the body', async () => {
        const put = vi.spyOn(apiClient, 'put').mockResolvedValue({})
        await lobbyService.updateLobby('l1', { name: 'Friday' })
        expect(put).toHaveBeenCalledWith('/lobbies', { name: 'Friday', id: 'l1' })
    })
})
