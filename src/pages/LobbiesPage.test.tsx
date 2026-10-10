import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { LobbiesPage } from './LobbiesPage'
import { lobbyService } from '../services/lobbyService'
import type { LobbyDTO } from '../types/lobby'

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' } }) }))

const mira = { id: 'u9', username: 'mira_z' }

function lobby(id: string, name: string): LobbyDTO {
    return {
        id, name, gameMode: 'CASUAL', status: 'WAITING', createdAt: '2026-10-09T18:00:00Z', hostUser: mira,
        teamAPlayers: [mira], teamBPlayers: [], unassignedPlayers: [], privateLobby: false, password: null,
    }
}

function LobbyAt() {
    return <p>lobby page {useParams().lobbyId}</p>
}

function renderAt(path: string) {
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/lobbies" element={<LobbiesPage />} />
                <Route path="/lobby/:lobbyId" element={<LobbyAt />} />
            </Routes>
        </MemoryRouter>,
    )
}

beforeEach(() => {
    vi.spyOn(lobbyService, 'getAllOpenLobbies').mockResolvedValue([lobby('l1', 'Kod Mire'), lobby('l2', 'Petak')])
    vi.spyOn(lobbyService, 'joinLobby').mockResolvedValue(lobby('l1', 'Kod Mire'))
})
afterEach(() => vi.restoreAllMocks())

describe('/lobbies (spec §4.6)', () => {
    test('"Lobbies" with its count, Create lobby and Refresh', async () => {
        renderAt('/lobbies')
        expect(screen.getByRole('heading', { level: 1, name: 'Lobbies' })).toBeInTheDocument()
        expect(document.title).toBe('Lobbies · Stiglja')
        expect(await screen.findByText('2 lobbies open')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Create lobby' })).toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Refresh' }))
        expect(lobbyService.getAllOpenLobbies).toHaveBeenCalledTimes(2)
    })

    test('?create=1 opens the create sheet (AC 7), and so does "Create lobby"', async () => {
        const { unmount } = render(
            <MemoryRouter initialEntries={['/lobbies?create=1']}>
                <Routes>
                    <Route path="/lobbies" element={<LobbiesPage />} />
                </Routes>
            </MemoryRouter>,
        )
        expect(screen.getByRole('dialog', { name: 'Create lobby' })).toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }))
        expect(screen.queryByRole('dialog', { name: 'Create lobby' })).not.toBeInTheDocument()
        unmount()

        renderAt('/lobbies')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Create lobby' }))
        expect(screen.getByRole('dialog', { name: 'Create lobby' })).toBeInTheDocument()
    })

    test('a guest opens a row, joins in the quick-look and lands in the lobby (US-8)', async () => {
        const user = userEvent.setup()
        renderAt('/lobbies')
        await user.click(await screen.findByRole('button', { name: 'Kod Mire, host mira_z, 1 of 4' }))
        await user.click(screen.getByRole('button', { name: 'Join lobby' }))
        expect(lobbyService.joinLobby).toHaveBeenCalledWith('l1', { lobbyId: 'l1', password: null })
        expect(await screen.findByText('lobby page l1')).toBeInTheDocument()
    })
})
