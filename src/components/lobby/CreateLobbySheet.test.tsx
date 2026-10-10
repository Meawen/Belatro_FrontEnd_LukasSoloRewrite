import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { CreateLobbySheet } from './CreateLobbySheet'
import { lobbyService } from '../../services/lobbyService'
import { ApiError } from '../../services/api'
import type { LobbyDTO } from '../../types/lobby'

const onClose = vi.fn()

function LobbyAt() {
    return <p>lobby page {useParams().lobbyId}</p>
}

function renderSheet() {
    render(
        <MemoryRouter initialEntries={['/lobbies']}>
            <Routes>
                <Route path="/lobbies" element={<CreateLobbySheet open onClose={onClose} />} />
                <Route path="/lobby/:lobbyId" element={<LobbyAt />} />
            </Routes>
        </MemoryRouter>,
    )
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(lobbyService, 'createLobby').mockResolvedValue({ id: 'l9' } as LobbyDTO)
})
afterEach(() => vi.restoreAllMocks())

describe('CreateLobbySheet (spec §4.6)', () => {
    test('sends only name, privacy and password - the server makes the caller the host', async () => {
        const user = userEvent.setup()
        renderSheet()
        expect(screen.getByRole('dialog', { name: 'Create lobby' })).toBeInTheDocument()
        await user.type(screen.getByLabelText('Lobby name'), '  Friday ')
        await user.click(screen.getByRole('button', { name: 'Create' }))
        expect(lobbyService.createLobby).toHaveBeenCalledWith({ name: 'Friday', privateLobby: false, password: null })
        // X-5: the host is a member already, so straight into the new lobby
        expect(await screen.findByText('lobby page l9')).toBeInTheDocument()
    })

    test('is plainly casual: no mode select and no Ranked option', () => {
        renderSheet()
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
        expect(screen.queryByText(/ranked/i)).not.toBeInTheDocument()
        expect(screen.getByText("Lobby games are casual: they don't change your rating.")).toBeInTheDocument()
    })

    test('"Private lobby" reveals the password, which is sent with it', async () => {
        const user = userEvent.setup()
        renderSheet()
        expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
        await user.click(screen.getByRole('switch', { name: 'Private lobby' }))
        expect(screen.getByText('Private lobbies require a password to join')).toBeInTheDocument()
        await user.type(screen.getByLabelText('Lobby name'), 'Petak')
        await user.type(screen.getByLabelText('Password'), 'pw-1')
        await user.click(screen.getByRole('button', { name: 'Create' }))
        expect(lobbyService.createLobby).toHaveBeenCalledWith({ name: 'Petak', privateLobby: true, password: 'pw-1' })
    })

    test('a missing name or password is refused with today\'s messages and nothing is sent', async () => {
        const user = userEvent.setup()
        renderSheet()
        await user.click(screen.getByRole('switch', { name: 'Private lobby' }))
        await user.click(screen.getByRole('button', { name: 'Create' }))
        expect(screen.getByText('Lobby name is required')).toBeInTheDocument()
        expect(screen.getByText('Password is required for private lobbies')).toBeInTheDocument()
        expect(screen.getByLabelText('Lobby name')).toHaveAttribute('aria-invalid', 'true')
        expect(lobbyService.createLobby).not.toHaveBeenCalled()
    })

    test('the name takes at most 50 characters and the password 20', async () => {
        const user = userEvent.setup()
        renderSheet()
        expect(screen.getByLabelText('Lobby name')).toHaveAttribute('maxlength', '50')
        await user.click(screen.getByRole('switch', { name: 'Private lobby' }))
        expect(screen.getByLabelText('Password')).toHaveAttribute('maxlength', '20')
    })

    test('a refused create shows the server message and the sheet stays open', async () => {
        const user = userEvent.setup()
        vi.mocked(lobbyService.createLobby).mockRejectedValue(new ApiError({ status: 400, message: 'Lobby password must be at most 72 bytes' }))
        renderSheet()
        await user.type(screen.getByLabelText('Lobby name'), 'Friday')
        await user.click(screen.getByRole('button', { name: 'Create' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Lobby password must be at most 72 bytes')
        expect(screen.getByRole('dialog', { name: 'Create lobby' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled()
    })

    test('Cancel closes it', async () => {
        renderSheet()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }))
        expect(onClose).toHaveBeenCalled()
    })
})
