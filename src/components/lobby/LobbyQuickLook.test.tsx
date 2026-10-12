import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { LobbyQuickLook } from './LobbyQuickLook'
import { lobbyService } from '../../services/lobbyService'
import { ApiError } from '../../services/api'
import type { LobbyDTO } from '../../types/lobby'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' } }) }))

const ana = { id: 'u1', username: 'ana' }
const bob = { id: 'u2', username: 'bob' }
const cy = { id: 'u3', username: 'cy' }
const dan = { id: 'u4', username: 'dan' }
const onClose = vi.fn()

function lobby(overrides: Partial<LobbyDTO> = {}): LobbyDTO {
    return {
        id: 'l1', name: 'Friday', gameMode: 'CASUAL', status: 'WAITING', createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
        hostUser: bob, teamAPlayers: [bob], teamBPlayers: [], unassignedPlayers: [], privateLobby: false, password: null,
        ...overrides,
    }
}

function LobbyAt() {
    return <p>lobby page {useParams().lobbyId}</p>
}

function renderQuickLook(value: LobbyDTO, gone = false) {
    render(
        <MemoryRouter initialEntries={['/lobbies']}>
            <Routes>
                <Route path="/lobbies" element={<LobbyQuickLook lobby={value} gone={gone} onClose={onClose} />} />
                <Route path="/lobby/:lobbyId" element={<LobbyAt />} />
            </Routes>
        </MemoryRouter>,
    )
}

async function joinWithPassword(password: string) {
    const user = userEvent.setup()
    renderQuickLook(lobby({ privateLobby: true }))
    await user.type(screen.getByLabelText('Password'), password)
    await user.click(screen.getByRole('button', { name: 'Join lobby' }))
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(lobbyService, 'joinLobby').mockResolvedValue(lobby())
})
afterEach(() => vi.restoreAllMocks())

describe('LobbyQuickLook (spec §4.6)', () => {
    test('joins with the lobby id and the password only - the caller joins themselves', async () => {
        await joinWithPassword('pw-1')
        expect(lobbyService.joinLobby).toHaveBeenCalledWith('l1', { lobbyId: 'l1', password: 'pw-1' })
        expect(await screen.findByText('lobby page l1')).toBeInTheDocument()
    })

    test('a refused join shows the server message', async () => {
        vi.mocked(lobbyService.joinLobby).mockRejectedValue(new ApiError({ status: 403, message: 'Invalid lobby password' }))
        await joinWithPassword('wrong')
        expect(await screen.findByRole('alert')).toHaveTextContent('Invalid lobby password')
        expect(screen.getByLabelText('Password')).toHaveValue('')
        expect(screen.getByRole('dialog', { name: 'Friday' })).toBeInTheDocument()
    })

    test('titled with the lobby: its mini table, host, age and privacy', () => {
        renderQuickLook(lobby({ privateLobby: true }))
        const sheet = screen.getByRole('dialog', { name: 'Friday' })
        expect(sheet).toContainElement(screen.getByTestId('lobby-table'))
        expect(screen.getByText('Host')).toBeInTheDocument()
        expect(screen.getByText('bob', { selector: 'strong' })).toBeInTheDocument()
        expect(screen.getByText('Created 5 minutes ago')).toBeInTheDocument()
        expect(screen.getByText('Private')).toBeInTheDocument()
        // the mini table is a picture of the seats, not controls
        expect(screen.queryByRole('button', { name: /team A|team B/ })).not.toBeInTheDocument()
    })

    test('a public lobby joins with no password and goes straight in (AC 3, D-19)', async () => {
        renderQuickLook(lobby())
        expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Join lobby' }))
        expect(lobbyService.joinLobby).toHaveBeenCalledWith('l1', { lobbyId: 'l1', password: null })
        expect(await screen.findByText('lobby page l1')).toBeInTheDocument()
    })

    test('a private lobby asks for the password first, and Enter submits it (AC 4)', async () => {
        const user = userEvent.setup()
        renderQuickLook(lobby({ privateLobby: true }))
        await user.type(screen.getByLabelText('Password'), 'pw-2{Enter}')
        expect(lobbyService.joinLobby).toHaveBeenCalledWith('l1', { lobbyId: 'l1', password: 'pw-2' })
    })

    test('a member enters the lobby without joining again', async () => {
        renderQuickLook(lobby({ unassignedPlayers: [ana] }))
        expect(screen.queryByRole('button', { name: 'Join lobby' })).not.toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Enter lobby' }))
        expect(lobbyService.joinLobby).not.toHaveBeenCalled()
        expect(await screen.findByText('lobby page l1')).toBeInTheDocument()
    })

    test('a full lobby offers only a disabled "Lobby full" to an outsider', () => {
        renderQuickLook(lobby({ teamAPlayers: [bob, cy], teamBPlayers: [dan], unassignedPlayers: [{ id: 'u5', username: 'eve' }] }))
        expect(screen.getByRole('button', { name: 'Lobby full' })).toBeDisabled()
        expect(screen.queryByRole('button', { name: 'Join lobby' })).not.toBeInTheDocument()
    })

    test('a lobby that left the open list says so and offers only Close', async () => {
        renderQuickLook(lobby(), true)
        expect(screen.getByText('This lobby is no longer open')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Join lobby' })).not.toBeInTheDocument()
        expect(screen.queryByTestId('lobby-table')).not.toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Close' }))
        expect(onClose).toHaveBeenCalled()
    })
})
