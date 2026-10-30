import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { CreateLobbySheet } from './CreateLobbySheet'
import { lobbyService } from '../../services/lobbyService'
import { ApiError } from '../../services/api'
import type { LobbyDTO } from '../../types/lobby'
import { setLang } from '../../i18n/lang'

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
        expect(screen.getByRole('dialog', { name: 'Create table' })).toBeInTheDocument()
        await user.type(screen.getByLabelText('Table name'), '  Friday ')
        await user.click(screen.getByRole('button', { name: 'Create' }))
        expect(lobbyService.createLobby).toHaveBeenCalledWith({ name: 'Friday', privateLobby: false, password: null })
        // X-5: the host is a member already, so straight into the new lobby
        expect(await screen.findByText('lobby page l9')).toBeInTheDocument()
    })

    test('is plainly casual: no mode select and no Ranked option', () => {
        renderSheet()
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
        expect(screen.queryByText(/ranked/i)).not.toBeInTheDocument()
        expect(screen.getByText("Table games are casual: they don't change your rating.")).toBeInTheDocument()
    })

    test('"Private lobby" reveals the password, which is sent with it', async () => {
        const user = userEvent.setup()
        renderSheet()
        expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
        await user.click(screen.getByRole('switch', { name: 'Private table' }))
        expect(screen.getByText('Private tables require a password to join')).toBeInTheDocument()
        await user.type(screen.getByLabelText('Table name'), 'Petak')
        await user.type(screen.getByLabelText('Password'), 'pw-1')
        await user.click(screen.getByRole('button', { name: 'Create' }))
        expect(lobbyService.createLobby).toHaveBeenCalledWith({ name: 'Petak', privateLobby: true, password: 'pw-1' })
    })

    test('a missing name or password is refused with today\'s messages and nothing is sent', async () => {
        const user = userEvent.setup()
        renderSheet()
        await user.click(screen.getByRole('switch', { name: 'Private table' }))
        await user.click(screen.getByRole('button', { name: 'Create' }))
        expect(screen.getByText('Table name is required')).toBeInTheDocument()
        expect(screen.getByText('Password is required for private tables')).toBeInTheDocument()
        expect(screen.getByLabelText('Table name')).toHaveAttribute('aria-invalid', 'true')
        expect(lobbyService.createLobby).not.toHaveBeenCalled()
    })

    test('the name takes at most 50 characters and the password 20', async () => {
        const user = userEvent.setup()
        renderSheet()
        expect(screen.getByLabelText('Table name')).toHaveAttribute('maxlength', '50')
        await user.click(screen.getByRole('switch', { name: 'Private table' }))
        expect(screen.getByLabelText('Password')).toHaveAttribute('maxlength', '20')
    })

    test('a refused create shows the server message and the sheet stays open', async () => {
        const user = userEvent.setup()
        vi.mocked(lobbyService.createLobby).mockRejectedValue(new ApiError({ status: 400, message: 'Lobby password must be at most 72 bytes' }))
        renderSheet()
        await user.type(screen.getByLabelText('Table name'), 'Friday')
        await user.click(screen.getByRole('button', { name: 'Create' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Lobby password must be at most 72 bytes')
        expect(screen.getByRole('dialog', { name: 'Create table' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled()
    })

    test('Cancel closes it', async () => {
        renderSheet()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }))
        expect(onClose).toHaveBeenCalled()
    })
})

describe('CreateLobbySheet in Croatian (open beta §1.1, §1.4)', () => {
    afterEach(() => setLang('en'))

    test('Otvori stol and Stol za ekipu, in Croatian', async () => {
        const user = userEvent.setup()
        setLang('hr')
        renderSheet()
        expect(screen.getByRole('dialog', { name: 'Otvori stol' })).toBeInTheDocument()
        expect(screen.getByLabelText('Ime stola')).toBeInTheDocument()
        expect(screen.getByText('Partije za stolom su nerangirane: ne mijenjaju tvoj rejting.')).toBeInTheDocument()
        await user.click(screen.getByRole('switch', { name: 'Stol za ekipu' }))
        expect(screen.getByText('Sjesti može samo tko zna lozinku.')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Otvori' }))
        expect(screen.getByText('Upiši ime stola.')).toBeInTheDocument()
        expect(screen.getByText('Stol za ekipu treba lozinku.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Odustani' })).toBeInTheDocument()
        expect(lobbyService.createLobby).not.toHaveBeenCalled()
    })
})
