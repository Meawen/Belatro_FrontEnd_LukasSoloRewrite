import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { LobbiesPage } from './LobbiesPage'
import { lobbyService } from '../services/lobbyService'
import type { LobbyDTO } from '../types/lobby'
import { setLang } from '../i18n/lang'

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
        expect(screen.getByRole('heading', { level: 1, name: 'Tables' })).toBeInTheDocument()
        expect(document.title).toBe('Tables · Stiglja')
        expect(await screen.findByText('2 tables open')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Create table' })).toBeInTheDocument()
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
        expect(screen.getByRole('dialog', { name: 'Create table' })).toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }))
        expect(screen.queryByRole('dialog', { name: 'Create table' })).not.toBeInTheDocument()
        unmount()

        renderAt('/lobbies')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Create table' }))
        expect(screen.getByRole('dialog', { name: 'Create table' })).toBeInTheDocument()
    })

    test("?create=private opens the create sheet with Private table on (Doma's Stol za ekipu)", () => {
        for (const [create, on] of [['private', true], ['1', false]] as const) {
            const { unmount } = render(
                <MemoryRouter initialEntries={[`/lobbies?create=${create}`]}>
                    <Routes>
                        <Route path="/lobbies" element={<LobbiesPage />} />
                    </Routes>
                </MemoryRouter>,
            )
            const dialog = screen.getByRole('dialog', { name: 'Create table' })
            const privateTable = within(dialog).getByRole('switch', { name: 'Private table' })
            if (on) {
                expect(privateTable).toBeChecked()
                expect(within(dialog).getByLabelText('Password')).toBeInTheDocument()
            } else {
                expect(privateTable).not.toBeChecked()
                expect(within(dialog).queryByLabelText('Password')).not.toBeInTheDocument()
            }
            unmount()
        }
    })

    test('a guest opens a row, joins in the quick-look and lands in the lobby (US-8)', async () => {
        const user = userEvent.setup()
        renderAt('/lobbies')
        await user.click(await screen.findByRole('button', { name: 'Kod Mire, host mira_z, 1 of 4' }))
        await user.click(screen.getByRole('button', { name: 'Join table' }))
        expect(lobbyService.joinLobby).toHaveBeenCalledWith('l1', { lobbyId: 'l1', password: null })
        expect(await screen.findByText('lobby page l1')).toBeInTheDocument()
    })
})

describe('/lobbies in Croatian (open beta §1.1, §1.4)', () => {
    afterEach(() => setLang('en'))

    test('Birtija in Croatian (§1.4)', async () => {
        const user = userEvent.setup()
        setLang('hr')
        renderAt('/lobbies')
        expect(screen.getByRole('heading', { level: 1, name: 'Birtija' })).toBeInTheDocument()
        expect(document.title).toBe('Birtija · Stiglja')
        expect(await screen.findByText('2 otvorena stola')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Otvori stol' })).toBeInTheDocument()
        expect(screen.getByRole('list', { name: 'Otvoreni stolovi' })).toBeInTheDocument()
        expect(screen.getByRole('searchbox', { name: 'Traži stolove' })).toBeInTheDocument()
        const sort = screen.getByRole('combobox', { name: 'Poredaj po' })
        expect(within(sort).getAllByRole('option').map((option) => option.textContent)).toEqual(['Najnoviji', 'Ime', 'Najviše igrača'])
        await user.click(screen.getByRole('button', { name: 'Kod Mire, domaćin mira_z, 1 od 4' }))
        const sheet = screen.getByRole('dialog', { name: 'Kod Mire' })
        expect(within(sheet).getByText('Domaćin')).toBeInTheDocument()
        // the fixture's age grows with the clock: 21 days reads "dan"
        expect(within(sheet).getByText(/^Otvoren prije \d+ dana?$/)).toBeInTheDocument()
        expect(within(sheet).getByText('Otvoren za sve')).toBeInTheDocument()
        await user.click(within(sheet).getByRole('button', { name: 'Sjedni za stol' }))
        expect(lobbyService.joinLobby).toHaveBeenCalledWith('l1', { lobbyId: 'l1', password: null })
        expect(await screen.findByText('lobby page l1')).toBeInTheDocument()
    })
})
