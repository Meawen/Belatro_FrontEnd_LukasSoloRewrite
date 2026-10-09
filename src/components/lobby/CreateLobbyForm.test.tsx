import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateLobbyForm } from './CreateLobbyForm'
import { useLobbies } from '../../hooks/useLobby'

vi.mock('../../hooks/useLobby', () => ({ useLobbies: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' } }) }))

const createLobby = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    createLobby.mockResolvedValue({})
    vi.mocked(useLobbies).mockReturnValue({ createLobby, isCreating: false } as never)
})

describe('CreateLobbyForm', () => {
    test('sends only name, privacy and password - the server makes the caller the host', async () => {
        const user = userEvent.setup()
        const onSuccess = vi.fn()
        render(<CreateLobbyForm onSuccess={onSuccess} onCancel={vi.fn()} />)
        await user.type(screen.getByLabelText('Lobby Name'), 'Friday')
        await user.click(screen.getByRole('button', { name: 'Create Lobby' }))
        expect(createLobby).toHaveBeenCalledWith({ name: 'Friday', privateLobby: false, password: null })
        expect(onSuccess).toHaveBeenCalled()
    })

    test('is plainly casual: no mode select and no Ranked option', () => {
        render(<CreateLobbyForm onSuccess={vi.fn()} onCancel={vi.fn()} />)
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
        expect(screen.queryByText(/ranked/i)).not.toBeInTheDocument()
        expect(screen.getByText("Lobby games are casual: they don't change your rating.")).toBeInTheDocument()
    })
})
