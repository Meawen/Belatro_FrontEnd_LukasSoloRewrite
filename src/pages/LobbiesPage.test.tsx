import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { LobbiesPage } from './LobbiesPage'
import { lobbyService } from '../services/lobbyService'
import { ApiError } from '../services/api'
import type { LobbyDTO } from '../types/lobby'
import { setLang } from '../i18n/lang'

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' } }) }))
// The one-click bot game (spec §6): its request is botGame.test's; here a stub
const bots = vi.hoisted(() => ({ startBotGame: vi.fn() }))
vi.mock('../services/botGame', () => ({ startBotGame: bots.startBotGame }))

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

function GameAt() {
    return <p>game page {useParams().gameId}</p>
}

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/lobbies" element={<LobbiesPage />} />
                <Route path="/lobby/:lobbyId" element={<LobbyAt />} />
                <Route path="/game/:gameId" element={<GameAt />} />
            </Routes>
        </MemoryRouter>,
    )
}

/** The empty Birtija: the list answers no table. */
const noTables = () => vi.mocked(lobbyService.getAllOpenLobbies).mockResolvedValue([])
/** The empty state's box: its title, its line and its ways on. */
const emptyState = async () => (await screen.findByText('No open tables.')).parentElement as HTMLElement

beforeEach(() => {
    bots.startBotGame.mockReset()
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

describe('the empty Birtija (spec §8)', () => {
    test('the empty Birtija offers a Stol za ekipu and a bot game, the first its one primary action (spec §8)', async () => {
        noTables()
        renderAt('/lobbies')
        const state = await emptyState()
        expect(within(state).getByText('Create one and invite friends.')).toBeInTheDocument()
        expect(within(state).getAllByRole('button').map((button) => button.textContent)).toEqual(['Private table', 'Play against bots'])
        const primary = state.querySelectorAll('.ui-btn--primary')
        expect(primary).toHaveLength(1)
        expect(primary[0]).toHaveTextContent('Private table')
    })

    test("its Private table opens the create sheet with Private on and the name ana's table (spec §5)", async () => {
        noTables()
        renderAt('/lobbies')
        await userEvent.setup().click(within(await emptyState()).getByRole('button', { name: 'Private table' }))
        const dialog = screen.getByRole('dialog', { name: 'Create table' })
        expect(within(dialog).getByRole('switch', { name: 'Private table' })).toBeChecked()
        expect(await within(dialog).findByDisplayValue("ana's table")).toBe(within(dialog).getByLabelText('Table name'))
    })

    test('its Play against bots starts a game against three bots and opens it (spec §6)', async () => {
        noTables()
        bots.startBotGame.mockResolvedValue({ gameId: 'g7', lobbyId: 'l7' })
        renderAt('/lobbies')
        await userEvent.setup().click(within(await emptyState()).getByRole('button', { name: 'Play against bots' }))
        expect(await screen.findByText('game page g7')).toBeInTheDocument()
        expect(bots.startBotGame).toHaveBeenCalledTimes(1)
    })

    test("a bot game that can't start says why, and the buttons stay (spec §8)", async () => {
        const user = userEvent.setup()
        noTables()
        bots.startBotGame
            .mockRejectedValueOnce(new ApiError({ status: 503, message: 'Service Unavailable' }))
            .mockRejectedValueOnce(new ApiError({ status: 429, message: 'Too many requests, try again later', code: 'RATE_LIMITED' }))
            .mockRejectedValueOnce(new ApiError({ status: 409, message: 'You already have a game in progress', code: 'ALREADY_IN_GAME' }))
            .mockRejectedValueOnce(new ApiError({ status: 0, message: 'Failed to fetch' }))
        renderAt('/lobbies')
        const state = await emptyState()
        for (const line of [
            "Bots aren't available right now. Try again later.",
            'Too many tries. Wait a little, then try again.',
            'You already have a game in progress. Go back to it first.',
            "Bots aren't available right now. Try again later.",
        ]) {
            await user.click(within(state).getByRole('button', { name: 'Play against bots' }))
            expect(await within(state).findByText(line)).toBeInTheDocument()
            expect(within(state).getByRole('button', { name: 'Play against bots' })).toBeEnabled()
            expect(within(state).getByRole('button', { name: 'Private table' })).toBeInTheDocument()
        }
        expect(bots.startBotGame).toHaveBeenCalledTimes(4)
    })

    test("?create=private also fills the name; ?create=1 and the header's Create table don't", async () => {
        for (const [path, name] of [['/lobbies?create=private', "ana's table"], ['/lobbies?create=1', '']] as const) {
            const { unmount } = renderAt(path)
            const field = within(screen.getByRole('dialog', { name: 'Create table' })).getByLabelText('Table name')
            if (name) expect(await screen.findByDisplayValue(name)).toBe(field)
            else {
                await act(async () => {})
                expect(field).toHaveValue('')
            }
            unmount()
        }
        renderAt('/lobbies')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Create table' }))
        await act(async () => {})
        expect(within(screen.getByRole('dialog', { name: 'Create table' })).getByLabelText('Table name')).toHaveValue('')
    })

    test('a list with tables shows neither button', async () => {
        renderAt('/lobbies')
        expect(await screen.findByText('2 tables open')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Private table' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Play against bots' })).not.toBeInTheDocument()
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

    test('the empty Birtija in Croatian', async () => {
        const user = userEvent.setup()
        setLang('hr')
        noTables()
        bots.startBotGame.mockRejectedValue(new ApiError({ status: 503, message: 'Service Unavailable' }))
        renderAt('/lobbies')
        const state = (await screen.findByText('Nema otvorenih stolova.')).parentElement as HTMLElement
        expect(within(state).getAllByRole('button').map((button) => button.textContent)).toEqual(['Stol za ekipu', 'Igraj protiv botova'])
        await user.click(within(state).getByRole('button', { name: 'Igraj protiv botova' }))
        expect(await within(state).findByText('Botovi trenutno nisu dostupni. Pokušaj malo kasnije.')).toBeInTheDocument()
        await user.click(within(state).getByRole('button', { name: 'Stol za ekipu' }))
        const dialog = screen.getByRole('dialog', { name: 'Otvori stol' })
        expect(await within(dialog).findByDisplayValue('Kod ana')).toBe(within(dialog).getByLabelText('Ime stola'))
    })
})
