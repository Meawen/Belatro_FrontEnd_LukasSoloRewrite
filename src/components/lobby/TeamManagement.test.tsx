import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeamManagement } from './TeamManagment'
import { useLobbies } from '../../hooks/useLobby'
import { ApiError } from '../../services/api'
import type { LobbyDTO } from '../../types/lobby'

vi.mock('../../hooks/useLobby', () => ({ useLobbies: vi.fn() }))

const ana = { id: 'u1', username: 'ana' }
const bob = { id: 'u2', username: 'bob' }
const switchTeam = vi.fn()

function lobby(overrides: Partial<LobbyDTO> = {}): LobbyDTO {
    return {
        id: 'l1', name: 'Friday', gameMode: 'CASUAL', status: 'WAITING', createdAt: null, hostUser: bob,
        teamAPlayers: [bob], teamBPlayers: [], unassignedPlayers: [ana], privateLobby: false, password: null,
        ...overrides,
    }
}

beforeEach(() => {
    vi.clearAllMocks()
    switchTeam.mockResolvedValue({})
    vi.mocked(useLobbies).mockReturnValue({ switchTeam, isSwitchingTeam: false } as never)
})

describe('TeamManagement', () => {
    test('joining team B sends the lobby id and the backend team code', async () => {
        const user = userEvent.setup()
        render(<TeamManagement lobby={lobby()} currentUser={ana} onUpdate={vi.fn()} />)
        await user.click(screen.getByRole('button', { name: 'Join Team B' }))
        expect(switchTeam).toHaveBeenCalledWith('l1', { lobbyId: 'l1', targetTeam: 'B' })
    })

    test('leaving a team sends U, the backend code for unassigned', async () => {
        const user = userEvent.setup()
        render(<TeamManagement lobby={lobby({ teamAPlayers: [bob, ana], unassignedPlayers: [] })} currentUser={ana} onUpdate={vi.fn()} />)
        await user.click(screen.getByRole('button', { name: 'Leave Team' }))
        expect(switchTeam).toHaveBeenCalledWith('l1', { lobbyId: 'l1', targetTeam: 'U' })
    })

    test('a refused switch shows the server message', async () => {
        const user = userEvent.setup()
        switchTeam.mockRejectedValue(new ApiError({ status: 409, message: 'Team B is full' }))
        render(<TeamManagement lobby={lobby()} currentUser={ana} onUpdate={vi.fn()} />)
        await user.click(screen.getByRole('button', { name: 'Join Team B' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Team B is full')
    })
})
