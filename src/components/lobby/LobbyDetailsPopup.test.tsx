import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LobbyDetailsPopup } from './LobbyDetailsPopup'
import { useLobbies } from '../../hooks/useLobby'
import { ApiError } from '../../services/api'
import type { LobbyDTO } from '../../types/lobby'

vi.mock('../../hooks/useLobby', () => ({ useLobbies: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' } }) }))

const joinLobby = vi.fn()
const bob = { id: 'u2', username: 'bob' }
const privateLobby: LobbyDTO = {
    id: 'l1', name: 'Friday', gameMode: 'CASUAL', status: 'WAITING', createdAt: null, hostUser: bob,
    teamAPlayers: [bob], teamBPlayers: [], unassignedPlayers: [], privateLobby: true, password: null,
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useLobbies).mockReturnValue({ joinLobby, isJoining: false } as never)
})

async function joinWithPassword(password: string) {
    const user = userEvent.setup()
    render(<LobbyDetailsPopup lobby={privateLobby} isOpen onClose={vi.fn()} />, { wrapper: MemoryRouter })
    await user.click(screen.getByRole('button', { name: 'Join Private Game' }))
    await user.type(screen.getByPlaceholderText('Game password...'), password)
    await user.click(screen.getByRole('button', { name: 'Join Game' }))
}

describe('LobbyDetailsPopup join', () => {
    test('joins with the lobby id and the password only - the caller joins themselves', async () => {
        joinLobby.mockResolvedValue({})
        await joinWithPassword('pw-1')
        expect(joinLobby).toHaveBeenCalledWith('l1', { lobbyId: 'l1', password: 'pw-1' })
    })

    test('a refused join shows the server message', async () => {
        joinLobby.mockRejectedValue(new ApiError({ status: 403, message: 'Invalid lobby password' }))
        await joinWithPassword('wrong')
        expect(await screen.findByRole('alert')).toHaveTextContent('Invalid lobby password')
    })
})
