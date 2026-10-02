import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LobbyControls } from './LobbyControls'
import { useLobbies, useLobby } from '../../hooks/useLobby'
import { ApiError } from '../../services/api'
import type { LobbyDTO } from '../../types/lobby'

vi.mock('../../hooks/useLobby', () => ({ useLobbies: vi.fn(), useLobby: vi.fn() }))

const ana = { id: 'u1', username: 'ana' }
const bob = { id: 'u2', username: 'bob' }
const leaveLobby = vi.fn()
const kickPlayer = vi.fn()

function lobby(host: { id: string; username: string }): LobbyDTO {
    return {
        id: 'l1', name: 'Friday', gameMode: 'CASUAL', status: 'WAITING', createdAt: null, hostUser: host,
        teamAPlayers: [ana, bob], teamBPlayers: [], unassignedPlayers: [], privateLobby: false, password: null,
    }
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(useLobbies).mockReturnValue({ leaveLobby, kickPlayer, isLeaving: false, isKicking: false } as never)
    vi.mocked(useLobby).mockReturnValue({ deleteLobby: vi.fn(), isDeleting: false } as never)
})

describe('LobbyControls', () => {
    test('leaving sends only the lobby id', async () => {
        leaveLobby.mockRejectedValue(new ApiError({ status: 409, message: 'Lobby host must delete the lobby instead of leaving.' }))
        render(<LobbyControls lobby={lobby(bob)} currentUser={ana} onUpdate={vi.fn()} />)
        await userEvent.setup().click(screen.getByRole('button', { name: /leave lobby/i }))
        expect(leaveLobby).toHaveBeenCalledWith('l1')
        expect(await screen.findByRole('alert')).toHaveTextContent('Lobby host must delete the lobby instead of leaving.')
    })

    test('the host kicks by username only; a refusal is shown', async () => {
        const user = userEvent.setup()
        kickPlayer.mockRejectedValue(new ApiError({ status: 403, message: 'Only the lobby host can kick players.' }))
        render(<LobbyControls lobby={lobby(ana)} currentUser={ana} onUpdate={vi.fn()} />)
        await user.click(screen.getByRole('button', { name: /kick player/i }))
        // Select renders its label without htmlFor, so query the only <select> on screen
        await user.selectOptions(screen.getByRole('combobox'), 'u2')
        await user.click(screen.getAllByRole('button', { name: /kick player/i }).at(-1)!)
        expect(kickPlayer).toHaveBeenCalledWith('l1', { usernameToKick: 'bob' })
        expect(await screen.findByRole('alert')).toHaveTextContent('Only the lobby host can kick players.')
    })

    test('the host is offered delete, not leave - the server refuses a leaving host', () => {
        render(<LobbyControls lobby={lobby(ana)} currentUser={ana} onUpdate={vi.fn()} />)
        expect(screen.getByRole('button', { name: /delete lobby/i })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /leave lobby/i })).not.toBeInTheDocument()
    })
})
