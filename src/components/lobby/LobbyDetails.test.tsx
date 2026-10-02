import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigationType, useParams } from 'react-router-dom'
import { LobbyDetails } from './LobbyDetails'
import { useLobby, useLobbies } from '../../hooks/useLobby'
import { matchService } from '../../services/matchService'
import { lobbyService } from '../../services/lobbyService'
import { ApiError } from '../../services/api'
import type { LobbyDTO } from '../../types/lobby'

vi.mock('../../hooks/useLobby', () => ({ useLobby: vi.fn(), useLobbies: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' } }) }))
vi.mock('../../services/matchService', () => ({ matchService: { getMatchByLobbyId: vi.fn() } }))

const ana = { id: 'u1', username: 'ana' }
const bob = { id: 'u2', username: 'bob' }
const cy = { id: 'u3', username: 'cy' }
const dan = { id: 'u4', username: 'dan' }
const refetch = vi.fn()
const startMatch = vi.fn()

function lobby(overrides: Partial<LobbyDTO> = {}): LobbyDTO {
    return {
        id: 'l1', name: 'Friday', gameMode: 'CASUAL', status: 'WAITING', createdAt: null, hostUser: ana,
        teamAPlayers: [ana, bob], teamBPlayers: [cy, dan], unassignedPlayers: [], privateLobby: false, password: null,
        ...overrides,
    }
}

function mockLobby(value: LobbyDTO) {
    vi.mocked(useLobby).mockReturnValue({
        lobby: value, isLoading: false, error: null, refetch, startMatch, isStartingMatch: false,
        deleteLobby: vi.fn(), isDeleting: false,
    } as never)
}

// The real hook, so a failed fetch goes through useApi's own state handling;
// only the HTTP call underneath it is stubbed.
async function withRealLobbyHook() {
    const actual = await vi.importActual<typeof import('../../hooks/useLobby')>('../../hooks/useLobby')
    vi.mocked(useLobby).mockImplementation(actual.useLobby)
}

// What apiClient raises for GET /lobbies/{id} once the lobby is gone: the backend maps its
// ResourceNotFoundException("Lobby not found") to 404 {"error": "Lobby not found"}.
const lobbyGone = () => new ApiError({ status: 404, message: 'Lobby not found' })

// Shows how the lobby got here: REPLACE means Back from the game skips the lobby page.
function GamePage() {
    const { gameId } = useParams()
    const navigationType = useNavigationType()
    return (
        <>
            <div>game page {gameId}</div>
            <div>navigation {navigationType}</div>
        </>
    )
}

function renderLobby() {
    render(
        <MemoryRouter initialEntries={['/lobby/l1']}>
            <Routes>
                <Route path="/lobby/:lobbyId" element={<LobbyDetails lobbyId="l1" />} />
                <Route path="/game/:gameId" element={<GamePage />} />
            </Routes>
        </MemoryRouter>,
    )
}

beforeEach(() => {
    vi.clearAllMocks()
    refetch.mockResolvedValue(undefined)
    vi.mocked(useLobbies).mockReturnValue({
        switchTeam: vi.fn(), isSwitchingTeam: false, leaveLobby: vi.fn(), kickPlayer: vi.fn(), isLeaving: false, isKicking: false,
    } as never)
})
afterEach(() => vi.useRealTimers())
afterEach(() => vi.restoreAllMocks())

describe('LobbyDetails', () => {
    test('a member follows the closed lobby into its match', async () => {
        mockLobby(lobby({ status: 'CLOSED', hostUser: bob }))
        vi.mocked(matchService.getMatchByLobbyId).mockResolvedValue({ id: 'm1' } as never)
        renderLobby()
        expect(await screen.findByText('game page m1')).toBeInTheDocument()
        expect(matchService.getMatchByLobbyId).toHaveBeenCalledWith('l1')
        expect(screen.getByText('navigation REPLACE')).toBeInTheDocument()
    })

    test('the lobby closes before the match is stored: a 404 is retried', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        mockLobby(lobby({ status: 'CLOSED', hostUser: bob }))
        vi.mocked(matchService.getMatchByLobbyId)
            .mockRejectedValueOnce(new ApiError({ status: 404, message: 'Not Found' }))
            .mockResolvedValueOnce({ id: 'm3' } as never)
        renderLobby()
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
        expect(await screen.findByText('game page m3')).toBeInTheDocument()
        expect(screen.getByText('navigation REPLACE')).toBeInTheDocument()
    })

    test('a match lookup that fails for another reason than "not yet" says so and keeps trying', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        mockLobby(lobby({ status: 'CLOSED', hostUser: bob }))
        vi.mocked(matchService.getMatchByLobbyId)
            .mockRejectedValueOnce(new ApiError({ status: 500, message: 'Internal Server Error' }))
            .mockResolvedValueOnce({ id: 'm4' } as never)
        renderLobby()
        expect(await screen.findByRole('alert')).toHaveTextContent('Could not open the match: Internal Server Error')
        expect(screen.getByRole('heading', { name: 'Friday' })).toBeInTheDocument()
        await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
        expect(await screen.findByText('game page m4')).toBeInTheDocument()
        expect(screen.getByText('navigation REPLACE')).toBeInTheDocument()
    })

    test('the host starts the match and goes straight to it', async () => {
        mockLobby(lobby())
        startMatch.mockResolvedValue({ id: 'm2' })
        renderLobby()
        await userEvent.setup().click(screen.getByRole('button', { name: /start match/i }))
        expect(await screen.findByText('game page m2')).toBeInTheDocument()
        expect(screen.getByText('navigation REPLACE')).toBeInTheDocument()
    })

    test('a refused start shows the server message', async () => {
        mockLobby(lobby())
        startMatch.mockRejectedValue(new ApiError({ status: 409, message: 'Cannot start match: each team must have exactly 2 players.' }))
        renderLobby()
        await userEvent.setup().click(screen.getByRole('button', { name: /start match/i }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Cannot start match: each team must have exactly 2 players.')
    })

    test('the lobby is polled every three seconds without blanking the page', () => {
        vi.useFakeTimers()
        mockLobby(lobby({ teamBPlayers: [cy] }))
        renderLobby()
        expect(refetch).not.toHaveBeenCalled()
        act(() => { vi.advanceTimersByTime(3000) })
        expect(refetch).toHaveBeenCalledTimes(1)
        act(() => { vi.advanceTimersByTime(3000) })
        expect(refetch).toHaveBeenCalledTimes(2)
        expect(screen.getByText('Friday')).toBeInTheDocument()
    })

    test('a poll in flight keeps the lobby on screen: the spinner is for the first load only', async () => {
        vi.useFakeTimers()
        await withRealLobbyHook()
        const getLobby = vi.spyOn(lobbyService, 'getLobby').mockResolvedValue(lobby({ teamBPlayers: [cy] }))
        renderLobby()
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(screen.getByRole('heading', { name: 'Friday' })).toBeInTheDocument()

        getLobby.mockImplementation(() => new Promise<LobbyDTO>(() => {}))
        await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
        expect(screen.getByRole('heading', { name: 'Friday' })).toBeInTheDocument()
        expect(screen.queryByText('Loading lobby...')).not.toBeInTheDocument()
    })

    test('a failed poll keeps the last good lobby on screen and says so without blocking it', async () => {
        vi.useFakeTimers()
        await withRealLobbyHook()
        const getLobby = vi.spyOn(lobbyService, 'getLobby').mockResolvedValue(lobby({ teamBPlayers: [cy] }))
        renderLobby()
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(screen.getByRole('heading', { name: 'Friday' })).toBeInTheDocument()

        getLobby.mockRejectedValue(lobbyGone())
        await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
        expect(screen.getByRole('heading', { name: 'Friday' })).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent('Could not refresh the lobby: Lobby not found')
        expect(screen.queryByText('Error Loading Lobby')).not.toBeInTheDocument()

        getLobby.mockResolvedValue(lobby({ teamBPlayers: [cy] }))
        await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    test('a failed first load shows the full error card', async () => {
        vi.useFakeTimers()
        await withRealLobbyHook()
        vi.spyOn(lobbyService, 'getLobby').mockRejectedValue(new ApiError({ status: 500, message: 'Internal Server Error' }))
        renderLobby()
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(screen.getByRole('heading', { name: 'Error Loading Lobby' })).toBeInTheDocument()
        expect(screen.getByText('Internal Server Error')).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Friday' })).not.toBeInTheDocument()
    })

    test('a failed first load keeps its error card: nothing polls while there is no lobby', async () => {
        vi.useFakeTimers()
        await withRealLobbyHook()
        const getLobby = vi.spyOn(lobbyService, 'getLobby').mockRejectedValue(lobbyGone())
        renderLobby()
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(screen.getByRole('heading', { name: 'Error Loading Lobby' })).toBeInTheDocument()

        getLobby.mockImplementation(() => new Promise<LobbyDTO>(() => {}))
        await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
        expect(screen.getByRole('heading', { name: 'Error Loading Lobby' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
        expect(screen.queryByText('Loading lobby...')).not.toBeInTheDocument()
        expect(getLobby).toHaveBeenCalledTimes(1)
    })
})
