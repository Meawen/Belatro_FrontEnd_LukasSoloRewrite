import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, act, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigationType, useParams } from 'react-router-dom'
import { JSDOM } from 'jsdom'
import { LobbyRoom } from './LobbyRoom'
import { Toaster } from '../ui'
import { matchService } from '../../services/matchService'
import { lobbyService } from '../../services/lobbyService'
import { ApiError } from '../../services/api'
import type { LobbyDTO } from '../../types/lobby'
import type { MatchDTO } from '../../types/match'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' } }) }))
vi.mock('../../services/matchService', () => ({ matchService: { getMatchByLobbyId: vi.fn() } }))

const ana = { id: 'u1', username: 'ana', bot: false }
const bob = { id: 'u2', username: 'bob', bot: false }
const cy = { id: 'u3', username: 'cy', bot: false }
const dan = { id: 'u4', username: 'dan', bot: false }
const botAna = { id: 'b1', username: 'Bot-Ana', bot: true }
const botTin = { id: 'b2', username: 'Bot-Tin', bot: true }
const botNika = { id: 'b3', username: 'Bot-Nika', bot: true }

function lobby(overrides: Partial<LobbyDTO> = {}): LobbyDTO {
    return {
        id: 'l1', name: 'Friday', gameMode: 'CASUAL', status: 'WAITING', createdAt: null, hostUser: ana,
        teamAPlayers: [ana, bob], teamBPlayers: [cy, dan], unassignedPlayers: [], privateLobby: false, password: null,
        ...overrides,
    }
}

// What apiClient raises for GET /lobbies/{id} once the lobby is gone: the backend maps its
// ResourceNotFoundException("Lobby not found") to 404 {"error": "Lobby not found"}.
const lobbyGone = () => new ApiError({ status: 404, message: 'Lobby not found' })
const unavailable = () => new ApiError({ status: 503, message: 'Service Unavailable' })

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
                <Route path="/lobby/:lobbyId" element={<LobbyRoom lobbyId="l1" />} />
                <Route path="/game/:gameId" element={<GamePage />} />
                <Route path="/lobbies" element={<p>the lobby list</p>} />
            </Routes>
            <Toaster />
        </MemoryRouter>,
    )
}

/** The lobby as GET /lobbies/{id} answers it, from now on. */
const serve = (value: LobbyDTO) => vi.mocked(lobbyService.getLobby).mockResolvedValue(value)
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(0) })
const wait = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const sheet = (name: string) => screen.getByRole('dialog', { name })

beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(lobbyService, 'getLobby').mockResolvedValue(lobby())
    vi.spyOn(lobbyService, 'switchTeam').mockResolvedValue(lobby())
    vi.spyOn(lobbyService, 'joinLobby').mockResolvedValue(lobby())
    vi.spyOn(lobbyService, 'leaveLobby').mockResolvedValue({})
    vi.spyOn(lobbyService, 'kickPlayer').mockResolvedValue(lobby())
    vi.spyOn(lobbyService, 'deleteLobby').mockResolvedValue({})
    vi.spyOn(lobbyService, 'startMatch').mockResolvedValue({ id: 'm2' } as MatchDTO)
    vi.spyOn(lobbyService, 'addBot').mockResolvedValue(lobby())
    vi.spyOn(lobbyService, 'fillBots').mockResolvedValue(lobby())
})
afterEach(() => vi.useRealTimers())
afterEach(() => vi.restoreAllMocks())
afterEach(() => {
    delete (document as { visibilityState?: unknown }).visibilityState
})

describe('LobbyRoom: start and follow (spec §4.7 Data)', () => {
    test('a member follows the closed lobby into its match', async () => {
        serve(lobby({ status: 'CLOSED', hostUser: bob }))
        vi.mocked(matchService.getMatchByLobbyId).mockResolvedValue({ id: 'm1' } as never)
        renderLobby()
        expect(await screen.findByText('game page m1')).toBeInTheDocument()
        expect(matchService.getMatchByLobbyId).toHaveBeenCalledWith('l1')
        expect(screen.getByText('navigation REPLACE')).toBeInTheDocument()
    })

    test('the lobby closes before the match is stored: a 404 is retried', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        serve(lobby({ status: 'CLOSED', hostUser: bob }))
        vi.mocked(matchService.getMatchByLobbyId)
            .mockRejectedValueOnce(new ApiError({ status: 404, message: 'Not Found' }))
            .mockResolvedValueOnce({ id: 'm3' } as never)
        renderLobby()
        await settle()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(screen.getByText('Opening the match…')).toBeInTheDocument()
        await wait(2000)
        expect(await screen.findByText('game page m3')).toBeInTheDocument()
        expect(screen.getByText('navigation REPLACE')).toBeInTheDocument()
    })

    test('a match lookup that fails for another reason than "not yet" says so and keeps trying', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        serve(lobby({ status: 'CLOSED', hostUser: bob }))
        vi.mocked(matchService.getMatchByLobbyId)
            .mockRejectedValueOnce(new ApiError({ status: 500, message: 'Internal Server Error' }))
            .mockResolvedValueOnce({ id: 'm4' } as never)
        renderLobby()
        expect(await screen.findByRole('alert')).toHaveTextContent('Could not open the match: Internal Server Error')
        expect(screen.getByRole('heading', { name: 'Friday' })).toBeInTheDocument()
        await wait(2000)
        expect(await screen.findByText('game page m4')).toBeInTheDocument()
        expect(screen.getByText('navigation REPLACE')).toBeInTheDocument()
    })

    test('the host starts the match and goes straight to it', async () => {
        renderLobby()
        await userEvent.setup().click(await screen.findByRole('button', { name: /start match/i }))
        expect(lobbyService.startMatch).toHaveBeenCalledWith('l1')
        expect(await screen.findByText('game page m2')).toBeInTheDocument()
        expect(screen.getByText('navigation REPLACE')).toBeInTheDocument()
    })

    test('a refused start shows the server message', async () => {
        vi.mocked(lobbyService.startMatch).mockRejectedValue(new ApiError({ status: 409, message: 'Cannot start match: each team must have exactly 2 players.' }))
        renderLobby()
        await userEvent.setup().click(await screen.findByRole('button', { name: /start match/i }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Cannot start match: each team must have exactly 2 players.')
        expect(screen.getByRole('button', { name: 'Start match' })).toBeEnabled()
    })

    test('Start is disabled until 2 + 2 with nobody unassigned, and the reason line says why (AC 4)', async () => {
        serve(lobby({ teamBPlayers: [cy] }))
        renderLobby()
        expect(await screen.findByText('Waiting for 1 more player.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Start match' })).toBeDisabled()
    })
})

describe('LobbyRoom: polling (spec §4.7 Data, States)', () => {
    test('the lobby is polled every two seconds without blanking the page', async () => {
        vi.useFakeTimers()
        serve(lobby({ teamBPlayers: [cy] }))
        renderLobby()
        await settle()
        expect(lobbyService.getLobby).toHaveBeenCalledTimes(1)
        await wait(2000)
        expect(lobbyService.getLobby).toHaveBeenCalledTimes(2)
        await wait(2000)
        expect(lobbyService.getLobby).toHaveBeenCalledTimes(3)
        expect(screen.getByRole('heading', { name: 'Friday' })).toBeInTheDocument()
    })

    test('a poll in flight keeps the lobby on screen: the spinner is for the first load only', async () => {
        vi.useFakeTimers()
        serve(lobby({ teamBPlayers: [cy] }))
        renderLobby()
        await settle()
        expect(screen.getByRole('heading', { name: 'Friday' })).toBeInTheDocument()

        vi.mocked(lobbyService.getLobby).mockImplementation(() => new Promise<LobbyDTO>(() => {}))
        await wait(2000)
        expect(screen.getByRole('heading', { name: 'Friday' })).toBeInTheDocument()
        expect(screen.queryByText('Loading lobby...')).not.toBeInTheDocument()
    })

    test('a failed poll keeps the last good lobby on screen and says so without blocking it', async () => {
        vi.useFakeTimers()
        serve(lobby({ teamBPlayers: [cy] }))
        renderLobby()
        await settle()
        expect(screen.getByRole('heading', { name: 'Friday' })).toBeInTheDocument()

        vi.mocked(lobbyService.getLobby).mockRejectedValue(unavailable())
        await wait(2000)
        expect(screen.getByRole('heading', { name: 'Friday' })).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent('Could not refresh the lobby: Service Unavailable')
        expect(screen.queryByText("Couldn't load this lobby")).not.toBeInTheDocument()

        serve(lobby({ teamBPlayers: [cy] }))
        await wait(2000)
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    test('a failed first load shows the full error state', async () => {
        vi.useFakeTimers()
        vi.mocked(lobbyService.getLobby).mockRejectedValue(new ApiError({ status: 500, message: 'Internal Server Error' }))
        renderLobby()
        await settle()
        expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load this lobby")
        expect(screen.getByText('Internal Server Error')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Back to lobbies' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Friday' })).not.toBeInTheDocument()
    })

    test('a failed first load keeps its error state: nothing polls while there is no lobby', async () => {
        vi.useFakeTimers()
        vi.mocked(lobbyService.getLobby).mockRejectedValue(unavailable())
        renderLobby()
        await settle()
        expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load this lobby")

        vi.mocked(lobbyService.getLobby).mockImplementation(() => new Promise<LobbyDTO>(() => {}))
        await wait(2000)
        expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load this lobby")
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
        expect(screen.queryByText('Loading lobby...')).not.toBeInTheDocument()
        expect(lobbyService.getLobby).toHaveBeenCalledTimes(1)
    })

    // The session ended on the server (expiry, logout elsewhere): the next poll gets 401. Before,
    // the page stayed "signed in" and polled on without a token, showing "Forbidden" every 3 s.
    test('a dead session on the mounted page reloads into the login page', async () => {
        vi.mocked(lobbyService.getLobby).mockRestore()
        const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window
        const assign = vi.fn()
        vi.stubGlobal('localStorage', jsdomStorage)
        vi.stubGlobal('location', { ...window.location, assign })
        try {
            jsdomStorage.setItem('authToken', 'tok-1')
            jsdomStorage.setItem('user', JSON.stringify(ana))
            vi.useFakeTimers()
            const answer = (status: number, body: unknown) => ({
                ok: status === 200, status, statusText: `status-${status}`, headers: { get: () => null },
                json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)),
            } as unknown as Response)
            const fetch = vi.fn().mockResolvedValue(answer(200, lobby()))
            vi.stubGlobal('fetch', fetch)
            renderLobby()
            await settle()
            expect(screen.getByRole('heading', { name: 'Friday' })).toBeInTheDocument()

            fetch.mockResolvedValue(answer(401, { error: 'Session expired, please sign in again' }))
            await wait(2000)
            expect(assign).toHaveBeenCalledWith('/login?reason=session-ended')
            expect(jsdomStorage.getItem('authToken')).toBeNull()
        } finally {
            vi.unstubAllGlobals()
        }
    })

    test('loading, a failed first load, closed and removed each have one h1, Lobby (spec §3.9)', async () => {
        vi.useFakeTimers()
        const h1s = () => screen.getAllByRole('heading', { level: 1 }).map((heading) => heading.textContent)
        vi.mocked(lobbyService.getLobby).mockImplementation(() => new Promise<LobbyDTO>(() => {}))
        renderLobby()
        expect(screen.getByText('Loading lobby...')).toBeInTheDocument()
        expect(h1s()).toEqual(['Lobby'])
        cleanup()
        vi.mocked(lobbyService.getLobby).mockRejectedValue(new ApiError({ status: 500, message: 'Internal Server Error' }))
        renderLobby()
        await settle()
        expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load this lobby")
        expect(h1s()).toEqual(['Lobby'])
        cleanup()
        serve(lobby({ teamBPlayers: [cy] }))
        renderLobby()
        await settle()
        vi.mocked(lobbyService.getLobby).mockRejectedValue(lobbyGone())
        await wait(2000)
        expect(screen.getByText('This lobby was closed.')).toBeInTheDocument()
        expect(h1s()).toEqual(['Lobby'])
        cleanup()
        serve(lobby({ hostUser: bob, teamAPlayers: [bob], unassignedPlayers: [ana] }))
        renderLobby()
        await settle()
        serve(lobby({ hostUser: bob, teamAPlayers: [bob], unassignedPlayers: [] }))
        await wait(2000)
        expect(screen.getByText('You were removed from this lobby.')).toBeInTheDocument()
        expect(h1s()).toEqual(['Lobby'])
    })

    test('a 404 poll shows "This lobby was closed." with the way back (AC 6)', async () => {
        vi.useFakeTimers()
        renderLobby()
        await settle()
        vi.mocked(lobbyService.getLobby).mockRejectedValue(lobbyGone())
        await wait(2000)
        expect(screen.getByText('This lobby was closed.')).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Friday' })).not.toBeInTheDocument()
        vi.useRealTimers()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Back to lobbies' }))
        expect(screen.getByText('the lobby list')).toBeInTheDocument()
    })

    test('a poll without you, after you were a member, shows the removed state, and polling stops (AC 7)', async () => {
        vi.useFakeTimers()
        serve(lobby({ hostUser: bob, teamAPlayers: [bob], unassignedPlayers: [ana] }))
        renderLobby()
        await settle()
        serve(lobby({ hostUser: bob, teamAPlayers: [bob], unassignedPlayers: [] }))
        await wait(2000)
        expect(screen.getByText('You were removed from this lobby.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Back to lobbies' })).toBeInTheDocument()
        await wait(3 * 2000)
        expect(lobbyService.getLobby).toHaveBeenCalledTimes(2)
    })

    test('polling pauses while the tab is hidden (AC 8)', async () => {
        vi.useFakeTimers()
        renderLobby()
        await settle()
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
        document.dispatchEvent(new Event('visibilitychange'))
        await wait(3 * 2000)
        expect(lobbyService.getLobby).toHaveBeenCalledTimes(1)
    })
})

describe('LobbyRoom: seats (spec §4.7 Actions)', () => {
    test('joining team B sends the lobby id and the backend team code', async () => {
        serve(lobby({ hostUser: bob, teamAPlayers: [bob], teamBPlayers: [], unassignedPlayers: [ana] }))
        renderLobby()
        await userEvent.setup().click((await screen.findAllByRole('button', { name: 'Sit here, team B' }))[0])
        expect(lobbyService.switchTeam).toHaveBeenCalledWith('l1', { lobbyId: 'l1', targetTeam: 'B' })
    })

    test('leaving a team sends U, the backend code for unassigned', async () => {
        const user = userEvent.setup()
        serve(lobby({ hostUser: bob, teamAPlayers: [bob, ana], teamBPlayers: [], unassignedPlayers: [] }))
        renderLobby()
        await user.click(await screen.findByRole('button', { name: 'ana (you), team A' }))
        await user.click(within(sheet('Your seat')).getByRole('button', { name: 'Stand up' }))
        expect(lobbyService.switchTeam).toHaveBeenCalledWith('l1', { lobbyId: 'l1', targetTeam: 'U' })
    })

    test('a refused switch shows the server message', async () => {
        vi.mocked(lobbyService.switchTeam).mockRejectedValue(new ApiError({ status: 409, message: 'Team B is full' }))
        serve(lobby({ hostUser: bob, teamAPlayers: [bob], teamBPlayers: [], unassignedPlayers: [ana] }))
        renderLobby()
        await userEvent.setup().click((await screen.findAllByRole('button', { name: 'Sit here, team B' }))[0])
        expect(await screen.findByRole('alert')).toHaveTextContent('Team B is full')
    })

    test('while a seat change runs, the tapped seat is aria-busy, reads "Joining…", and nothing else is sent', async () => {
        const user = userEvent.setup()
        vi.mocked(lobbyService.switchTeam).mockImplementation(() => new Promise<LobbyDTO>(() => {}))
        serve(lobby({ hostUser: bob, teamAPlayers: [bob], teamBPlayers: [], unassignedPlayers: [ana] }))
        renderLobby()
        await user.click((await screen.findAllByRole('button', { name: 'Sit here, team B' }))[0])
        expect(screen.getByRole('button', { name: 'Joining…' })).toHaveAttribute('aria-busy', 'true')
        await user.click(screen.getByRole('button', { name: 'Sit here, team A' }))
        expect(lobbyService.switchTeam).toHaveBeenCalledTimes(1)
    })

    test('a member\'s seats, Not seated and the hint', async () => {
        serve(lobby({ hostUser: bob, teamAPlayers: [bob], teamBPlayers: [cy], unassignedPlayers: [ana, dan] }))
        renderLobby()
        expect(await screen.findByRole('button', { name: 'bob, team A, host' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'cy, team B' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Sit here, team A' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Sit here, team B' })).toBeInTheDocument()
        expect(screen.getByText('Not seated')).toBeInTheDocument()
        expect(screen.getByText('· you')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'dan' })).not.toBeInTheDocument()
        expect(screen.getByText('Pick a seat. Partners sit opposite each other.')).toBeInTheDocument()
        expect(screen.getByText('Tap an open seat.')).toBeInTheDocument()
    })
})

describe('LobbyRoom: joining, leaving and the host (spec §4.7 Actions)', () => {
    test('a non-member sees "Join lobby"; after joining they appear Not seated (AC 1)', async () => {
        serve(lobby({ hostUser: bob, teamAPlayers: [bob], teamBPlayers: [], unassignedPlayers: [] }))
        renderLobby()
        expect(await screen.findByText('You are looking at this lobby. Join to play.')).toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: /^Open seat, team/ })).toHaveLength(3)
        serve(lobby({ hostUser: bob, teamAPlayers: [bob], teamBPlayers: [], unassignedPlayers: [ana] }))
        await userEvent.setup().click(screen.getByRole('button', { name: 'Join lobby' }))
        expect(lobbyService.joinLobby).toHaveBeenCalledWith('l1', { lobbyId: 'l1', password: null })
        expect(await screen.findByText('· you')).toBeInTheDocument()
        expect(screen.getByText('Pick a seat. Partners sit opposite each other.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Join lobby' })).not.toBeInTheDocument()
    })

    test('a private lobby asks an outsider for its password in a sheet whose submit is "Join"', async () => {
        const user = userEvent.setup()
        serve(lobby({ hostUser: bob, teamAPlayers: [bob], teamBPlayers: [], privateLobby: true }))
        renderLobby()
        await user.click(await screen.findByRole('button', { name: 'Join lobby' }))
        await user.type(within(sheet('Private lobby')).getByLabelText('Password'), 'pw-1')
        await user.click(within(sheet('Private lobby')).getByRole('button', { name: 'Join' }))
        expect(lobbyService.joinLobby).toHaveBeenCalledWith('l1', { lobbyId: 'l1', password: 'pw-1' })
    })

    test('leaving sends only the lobby id', async () => {
        const user = userEvent.setup()
        const confirm = vi.spyOn(window, 'confirm')
        vi.mocked(lobbyService.leaveLobby).mockRejectedValue(new ApiError({ status: 409, message: 'User is not part of this lobby.' }))
        serve(lobby({ hostUser: bob }))
        renderLobby()
        await user.click(await screen.findByRole('button', { name: 'Leave' }))
        expect(screen.getAllByRole('button', { name: 'Leave lobby' })).toHaveLength(1)
        await user.click(within(sheet('Leave this lobby?')).getByRole('button', { name: 'Leave lobby' }))
        expect(lobbyService.leaveLobby).toHaveBeenCalledWith('l1')
        expect(await within(sheet('Leave this lobby?')).findByRole('alert')).toHaveTextContent('User is not part of this lobby.')
        expect(confirm).not.toHaveBeenCalled()
    })

    test('a member who leaves goes back to the list; "Stay" keeps them', async () => {
        const user = userEvent.setup()
        serve(lobby({ hostUser: bob }))
        renderLobby()
        await user.click(await screen.findByRole('button', { name: 'Leave' }))
        await user.click(within(sheet('Leave this lobby?')).getByRole('button', { name: 'Stay' }))
        expect(lobbyService.leaveLobby).not.toHaveBeenCalled()
        await user.click(screen.getByRole('button', { name: 'Leave' }))
        await user.click(within(sheet('Leave this lobby?')).getByRole('button', { name: 'Leave lobby' }))
        expect(await screen.findByText('the lobby list')).toBeInTheDocument()
    })

    test('the host kicks by username only; a refusal is shown', async () => {
        const user = userEvent.setup()
        // bob left between the last poll and the click
        vi.mocked(lobbyService.kickPlayer).mockRejectedValue(new ApiError({ status: 409, message: 'User is not part of this lobby.' }))
        renderLobby()
        await user.click(await screen.findByRole('button', { name: 'bob, team A' }))
        await user.click(within(sheet('Remove bob?')).getByRole('button', { name: 'Remove bob' }))
        expect(lobbyService.kickPlayer).toHaveBeenCalledWith('l1', { usernameToKick: 'bob' })
        expect(await within(sheet('Remove bob?')).findByRole('alert')).toHaveTextContent('User is not part of this lobby.')
    })

    test('the host can remove a Not-seated member (AC 13)', async () => {
        const user = userEvent.setup()
        serve(lobby({ teamBPlayers: [cy], unassignedPlayers: [dan] }))
        renderLobby()
        await user.click(await screen.findByRole('button', { name: 'dan' }))
        serve(lobby({ teamBPlayers: [cy], unassignedPlayers: [] }))
        await user.click(within(sheet('Remove dan?')).getByRole('button', { name: 'Remove dan' }))
        expect(lobbyService.kickPlayer).toHaveBeenCalledWith('l1', { usernameToKick: 'dan' })
        expect(await screen.findByText('Waiting for 1 more player.')).toBeInTheDocument()
        expect(screen.queryByText('Not seated')).not.toBeInTheDocument()
    })

    test('a refused delete shows the server message - e.g. the lobby was already reaped', async () => {
        const user = userEvent.setup()
        vi.mocked(lobbyService.deleteLobby).mockRejectedValue(new ApiError({ status: 404, message: 'Lobby not found' }))
        renderLobby()
        await user.click(await screen.findByRole('button', { name: 'Lobby options' }))
        await user.click(within(sheet('Lobby options')).getByRole('button', { name: 'Close lobby' }))
        await user.click(within(sheet('Close this lobby?')).getByRole('button', { name: 'Close lobby' }))
        expect(lobbyService.deleteLobby).toHaveBeenCalledWith('l1')
        expect(await within(sheet('Close this lobby?')).findByRole('alert')).toHaveTextContent('Lobby not found')
    })

    test('the host is offered delete, not leave - the server refuses a leaving host', async () => {
        const user = userEvent.setup()
        renderLobby()
        await screen.findByRole('heading', { name: 'Friday' })
        expect(screen.queryByRole('button', { name: 'Leave' })).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'ana (you), team A' }))
        expect(within(sheet('Your seat')).getByRole('button', { name: 'Stand up' })).toBeInTheDocument()
        expect(within(sheet('Your seat')).queryByRole('button', { name: 'Leave lobby' })).not.toBeInTheDocument()
        await user.click(within(sheet('Your seat')).getByRole('button', { name: 'Cancel' }))
        await user.click(screen.getByRole('button', { name: 'Lobby options' }))
        expect(within(sheet('Lobby options')).getByRole('button', { name: 'Close lobby' })).toBeInTheDocument()
    })

    test('closing asks first, each confirm button has its own name, then everyone goes back to the list', async () => {
        const user = userEvent.setup()
        renderLobby()
        await user.click(await screen.findByRole('button', { name: 'Lobby options' }))
        await user.click(within(sheet('Lobby options')).getByRole('button', { name: 'Close lobby' }))
        expect(screen.getByText('Everyone goes back to the list.')).toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: 'Close lobby' })).toHaveLength(1)
        await user.click(within(sheet('Close this lobby?')).getByRole('button', { name: 'Close lobby' }))
        expect(await screen.findByText('the lobby list')).toBeInTheDocument()
    })

    test('the header: the name as the only h1, Casual / Private / host chips, and the invite link copied', async () => {
        const user = userEvent.setup()
        serve(lobby({ privateLobby: true }))
        renderLobby()
        expect(await screen.findByRole('heading', { level: 1, name: 'Friday' })).toBeInTheDocument()
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
        expect(document.title).toBe('Friday · Stiglja')
        expect(screen.getByRole('link', { name: 'Lobbies' })).toHaveAttribute('href', '/lobbies')
        expect(screen.getByText('Casual')).toBeInTheDocument()
        expect(screen.getByText('Private')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Copy invite link' }))
        expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/lobby/l1`)
        expect(screen.getByRole('status')).toHaveTextContent('Invite link copied')
    })
})

describe('LobbyRoom: bots (casual bots spec §7)', () => {
    const HOST_HINT = "Anyone who joins takes a bot's seat. To play alone, create a private lobby."
    const alone = () => lobby({ teamAPlayers: [ana], teamBPlayers: [], unassignedPlayers: [] })

    test('the host\'s "+ Bot" chip adds a bot on that seat\'s team, and the lobby refreshes', async () => {
        serve(alone())
        renderLobby()
        expect(await screen.findAllByRole('button', { name: /^Add a bot to team/ })).toHaveLength(3)
        serve(lobby({ teamAPlayers: [ana, botAna], teamBPlayers: [], unassignedPlayers: [] }))
        await userEvent.setup().click(screen.getByRole('button', { name: 'Add a bot to team A' }))
        expect(lobbyService.addBot).toHaveBeenCalledWith('l1', 'A')
        expect(await screen.findByRole('button', { name: 'Remove Bot-Ana, team A, bot' })).toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: /^Add a bot to team/ })).toHaveLength(2)
        expect(lobbyService.switchTeam).not.toHaveBeenCalled()
    })

    test('while a bot is on its way, its seat is aria-busy and reads "Adding…", and nothing else is sent', async () => {
        const user = userEvent.setup()
        vi.mocked(lobbyService.addBot).mockImplementation(() => new Promise<LobbyDTO>(() => {}))
        serve(alone())
        renderLobby()
        await user.click(await screen.findByRole('button', { name: 'Add a bot to team A' }))
        expect(screen.getByRole('button', { name: 'Adding…' })).toHaveAttribute('aria-busy', 'true')
        expect(screen.getByRole('button', { name: 'Adding…' })).toHaveTextContent('Adding…')
        await user.click(screen.getAllByRole('button', { name: 'Add a bot to team B' })[0])
        // Fill looks and announces disabled meanwhile, not only ignores a tap (R18)
        expect(screen.getByRole('button', { name: 'Fill with bots' })).toBeDisabled()
        expect(lobbyService.addBot).toHaveBeenCalledTimes(1)
        expect(lobbyService.fillBots).not.toHaveBeenCalled()
    })

    test('while the host changes seat, "Fill with bots" is disabled too, and enabled again once it lands (R18)', async () => {
        const user = userEvent.setup()
        let land: (value: LobbyDTO) => void = () => {}
        vi.mocked(lobbyService.switchTeam).mockImplementation(() => new Promise<LobbyDTO>((resolve) => { land = resolve }))
        serve(alone())
        renderLobby()
        expect(await screen.findByRole('button', { name: 'Fill with bots' })).toBeEnabled()
        await user.click(screen.getAllByRole('button', { name: 'Sit here, team B' })[0])
        expect(screen.getByRole('button', { name: 'Switching…' })).toHaveAttribute('aria-busy', 'true')
        expect(screen.getByRole('button', { name: 'Fill with bots' })).toBeDisabled()
        await act(async () => land(alone()))
        expect(await screen.findByRole('button', { name: 'Fill with bots' })).toBeEnabled()
    })

    test('a chip on a Team B seat asks for Team B; a refusal shows the server message', async () => {
        vi.mocked(lobbyService.addBot).mockRejectedValue(new ApiError({ status: 409, message: 'Lobby is full' }))
        serve(alone())
        renderLobby()
        await userEvent.setup().click((await screen.findAllByRole('button', { name: 'Add a bot to team B' }))[0])
        expect(lobbyService.addBot).toHaveBeenCalledWith('l1', 'B')
        expect(await screen.findByRole('alert')).toHaveTextContent('Lobby is full')
        expect(screen.getByRole('heading', { name: 'Friday' })).toBeInTheDocument()
    })

    // R25: the backend's 503 reaches the wire as Spring's default body; its text means nothing to a player
    test('a chip or a fill answered 5xx says bots aren\'t available, not the server\'s text', async () => {
        const user = userEvent.setup()
        vi.mocked(lobbyService.addBot).mockRejectedValue(unavailable())
        vi.mocked(lobbyService.fillBots).mockRejectedValue(new ApiError({ status: 500, message: 'Internal Server Error' }))
        serve(alone())
        renderLobby()
        await user.click(await screen.findByRole('button', { name: 'Add a bot to team A' }))
        expect(await screen.findByRole('alert')).toHaveTextContent("Bots aren't available right now. Try again later.")
        expect(screen.queryByText(/Service Unavailable/)).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Fill with bots' }))
        expect(lobbyService.fillBots).toHaveBeenCalledWith('l1')
        expect(await screen.findByRole('alert')).toHaveTextContent("Bots aren't available right now. Try again later.")
        expect(screen.queryByText(/Internal Server Error/)).not.toBeInTheDocument()
    })

    test('a bot request the server refuses (403, 409) shows the server\'s message as it is', async () => {
        const user = userEvent.setup()
        vi.mocked(lobbyService.addBot).mockRejectedValue(new ApiError({ status: 403, message: 'Only the host can add bots' }))
        vi.mocked(lobbyService.fillBots).mockRejectedValue(new ApiError({ status: 409, message: 'No seat to fill' }))
        serve(alone())
        renderLobby()
        await user.click(await screen.findByRole('button', { name: 'Add a bot to team A' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Only the host can add bots')
        await user.click(screen.getByRole('button', { name: 'Fill with bots' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('No seat to fill')
        expect(screen.queryByText(/Bots aren't available/)).not.toBeInTheDocument()
    })

    test('"Fill with bots" fills the free seats; then there is nothing left to fill, and it goes (R26)', async () => {
        serve(alone())
        renderLobby()
        const fill = await screen.findByRole('button', { name: 'Fill with bots' })
        expect(fill).toBeEnabled()
        serve(lobby({ teamAPlayers: [ana, botAna], teamBPlayers: [botTin, botNika], unassignedPlayers: [] }))
        await userEvent.setup().click(fill)
        expect(lobbyService.fillBots).toHaveBeenCalledWith('l1')
        expect(await screen.findByRole('button', { name: 'Remove Bot-Nika, team B, bot' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Fill with bots' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Start match' })).toBeEnabled()
        expect(screen.queryByRole('button', { name: /^Add a bot/ })).not.toBeInTheDocument()
    })

    test('no seat to fill, no "Fill with bots": a ready table, and a full one with someone standing (R26)', async () => {
        serve(lobby())
        renderLobby()
        expect(await screen.findByRole('button', { name: 'Start match' })).toBeEnabled()
        expect(screen.queryByRole('button', { name: 'Fill with bots' })).not.toBeInTheDocument()
        cleanup()
        serve(lobby({ teamAPlayers: [ana, bob], teamBPlayers: [cy], unassignedPlayers: [dan] }))
        renderLobby()
        expect(await screen.findByText("dan hasn't taken a seat yet.")).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Fill with bots' })).not.toBeInTheDocument()
    })

    test('"Fill with bots" sits directly under the table, before Not seated and the hint; the host\'s bar keeps options and Start (R31)', async () => {
        // the host, a bot and dan standing: Fill, "Not seated" and the host's hint all show
        serve(lobby({ teamAPlayers: [ana, botAna], teamBPlayers: [], unassignedPlayers: [dan] }))
        renderLobby()
        const fill = await screen.findByRole('button', { name: 'Fill with bots' })
        expect(fill).toHaveClass('ui-btn--secondary', 'ui-btn--sm')
        expect(fill.querySelector('svg')).not.toBeNull()
        const follows = (first: Element, second: Element) => (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
        expect(follows(screen.getByTestId('lobby-table'), fill)).toBe(true)
        expect(follows(fill, screen.getByText('Not seated'))).toBe(true)
        expect(follows(fill, screen.getByText(HOST_HINT))).toBe(true)
        const bar = screen.getByRole('region', { name: 'Lobby actions' })
        expect(within(bar).getAllByRole('button').map((button) => button.textContent)).toEqual(['', 'Start match'])
        expect(within(bar).getByRole('button', { name: 'Lobby options' })).toBeInTheDocument()
    })

    test('while a fill runs, no seat and no chip takes a tap', async () => {
        const user = userEvent.setup()
        vi.mocked(lobbyService.fillBots).mockImplementation(() => new Promise<LobbyDTO>(() => {}))
        serve(alone())
        renderLobby()
        await user.click(await screen.findByRole('button', { name: 'Fill with bots' }))
        expect(screen.getByRole('button', { name: 'Fill with bots' })).toHaveAttribute('aria-busy', 'true')
        expect(screen.getByRole('button', { name: 'Fill with bots' })).toBeDisabled()
        await user.click(screen.getByRole('button', { name: 'Add a bot to team A' }))
        await user.click(screen.getAllByRole('button', { name: 'Sit here, team B' })[0])
        expect(lobbyService.addBot).not.toHaveBeenCalled()
        expect(lobbyService.switchTeam).not.toHaveBeenCalled()
    })

    // review focus 5: the first fill took the seats on the server while this page still showed them free
    test('a second fill answered 409 "No seat to fill" says so and keeps the lobby on screen', async () => {
        const user = userEvent.setup()
        vi.mocked(lobbyService.fillBots)
            .mockResolvedValueOnce(lobby({ teamAPlayers: [ana, botAna], teamBPlayers: [botTin, botNika], unassignedPlayers: [] }))
            .mockRejectedValueOnce(new ApiError({ status: 409, message: 'No seat to fill' }))
        serve(alone())
        renderLobby()
        await user.click(await screen.findByRole('button', { name: 'Fill with bots' }))
        await user.click(await screen.findByRole('button', { name: 'Fill with bots' }))
        expect(lobbyService.fillBots).toHaveBeenCalledTimes(2)
        expect(await screen.findByRole('alert')).toHaveTextContent('No seat to fill')
        expect(screen.getByRole('heading', { name: 'Friday' })).toBeInTheDocument()
        expect(screen.getByTestId('lobby-table')).toBeInTheDocument()
        expect(screen.queryByText('the lobby list')).not.toBeInTheDocument()
        expect(screen.queryByText(/game page/)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Fill with bots' })).toBeEnabled()
    })

    test('a member and an outsider see neither the chips nor "Fill with bots"', async () => {
        serve(lobby({ hostUser: bob, teamAPlayers: [bob], teamBPlayers: [], unassignedPlayers: [ana] }))
        renderLobby()
        expect(await screen.findByText('· you')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /^Add a bot/ })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Fill with bots' })).not.toBeInTheDocument()
        cleanup()
        serve(lobby({ hostUser: bob, teamAPlayers: [bob], teamBPlayers: [], unassignedPlayers: [] }))
        renderLobby()
        expect(await screen.findByRole('button', { name: 'Join lobby' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /^Add a bot/ })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Fill with bots' })).not.toBeInTheDocument()
    })

    test('a bot\'s seat shows the robot; the host\'s seat names the action, and one tap removes the bot by username, no sheet (R37)', async () => {
        const user = userEvent.setup()
        serve(lobby({ teamAPlayers: [ana], teamBPlayers: [botAna], unassignedPlayers: [] }))
        renderLobby()
        const seat = await screen.findByRole('button', { name: 'Remove Bot-Ana, team B, bot' })
        expect(seat.querySelector('.ui-avatar svg')).not.toBeNull()
        serve(lobby({ teamAPlayers: [ana], teamBPlayers: [], unassignedPlayers: [] }))
        await user.click(seat)
        expect(lobbyService.kickPlayer).toHaveBeenCalledWith('l1', { usernameToKick: 'Bot-Ana' })
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(await screen.findAllByRole('button', { name: 'Sit here, team B' })).toHaveLength(2)
        expect(screen.queryByRole('button', { name: /Bot-Ana/ })).not.toBeInTheDocument()
    })

    test('while a bot is removed its seat is aria-busy and reads "Removing…", the rest of the table dims, nothing else is sent (R37)', async () => {
        const user = userEvent.setup()
        vi.mocked(lobbyService.kickPlayer).mockImplementation(() => new Promise<LobbyDTO>(() => {}))
        serve(lobby({ teamAPlayers: [ana, botAna], teamBPlayers: [botTin], unassignedPlayers: [] }))
        renderLobby()
        await user.click(await screen.findByRole('button', { name: 'Remove Bot-Ana, team A, bot' }))
        const seat = screen.getByRole('button', { name: 'Removing…' })
        expect(seat).toHaveAttribute('aria-busy', 'true')
        expect(seat).toHaveTextContent('Removing…')
        expect(seat).not.toHaveClass('opacity-45!')
        expect(screen.getByRole('button', { name: 'Remove Bot-Tin, team B, bot' })).toHaveClass('opacity-45!')
        await user.click(screen.getByRole('button', { name: 'Remove Bot-Tin, team B, bot' }))
        expect(lobbyService.kickPlayer).toHaveBeenCalledTimes(1)
        expect(screen.getByRole('button', { name: 'Fill with bots' })).toBeDisabled()
    })

    test('a removal that fails says so: the server\'s words, or "Failed to remove the bot" (R37)', async () => {
        const user = userEvent.setup()
        vi.mocked(lobbyService.kickPlayer)
            .mockRejectedValueOnce(new ApiError({ status: 409, message: 'User is not part of this lobby.' }))
            .mockRejectedValueOnce('no answer')
        serve(lobby({ teamAPlayers: [ana], teamBPlayers: [botAna], unassignedPlayers: [] }))
        renderLobby()
        await user.click(await screen.findByRole('button', { name: 'Remove Bot-Ana, team B, bot' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('User is not part of this lobby.')
        await user.click(screen.getByRole('button', { name: 'Remove Bot-Ana, team B, bot' }))
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Failed to remove the bot'))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    test('a person\'s seat and a Not-seated chip still ask "Remove {name}?" with today\'s text (R37)', async () => {
        const user = userEvent.setup()
        serve(lobby({ teamAPlayers: [ana, bob], teamBPlayers: [botAna], unassignedPlayers: [dan] }))
        renderLobby()
        await user.click(await screen.findByRole('button', { name: 'bob, team A' }))
        expect(within(sheet('Remove bob?')).getByText('They leave the lobby at once and can join again from the list.')).toBeInTheDocument()
        await user.click(within(sheet('Remove bob?')).getByRole('button', { name: 'Cancel' }))
        await user.click(screen.getByRole('button', { name: 'dan' }))
        expect(within(sheet('Remove dan?')).getByText('They leave the lobby at once and can join again from the list.')).toBeInTheDocument()
        expect(lobbyService.kickPlayer).not.toHaveBeenCalled()
    })

    test('the host\'s hint shows only for a public lobby with a bot', async () => {
        serve(lobby({ teamAPlayers: [ana], teamBPlayers: [botAna], unassignedPlayers: [] }))
        renderLobby()
        expect(await screen.findByText(HOST_HINT)).toBeInTheDocument()
        cleanup()
        serve(lobby({ teamAPlayers: [ana], teamBPlayers: [botAna], unassignedPlayers: [], privateLobby: true }))
        renderLobby()
        expect(await screen.findByRole('button', { name: 'Remove Bot-Ana, team B, bot' })).toBeInTheDocument()
        expect(screen.queryByText(HOST_HINT)).not.toBeInTheDocument()
        cleanup()
        serve(alone())
        renderLobby()
        expect(await screen.findByRole('button', { name: 'Fill with bots' })).toBeInTheDocument()
        expect(screen.queryByText(HOST_HINT)).not.toBeInTheDocument()
        cleanup()
        serve(lobby({ hostUser: bob, teamAPlayers: [bob, ana], teamBPlayers: [botAna], unassignedPlayers: [] }))
        renderLobby()
        expect(await screen.findByText('The host starts the match when all four seats are taken.')).toBeInTheDocument()
        expect(screen.queryByText(HOST_HINT)).not.toBeInTheDocument()
    })

    test('while Start is in flight, no "+ Bot" chip and no "Fill with bots", though a poll shows a seat free (R27)', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        vi.mocked(lobbyService.startMatch).mockImplementation(() => new Promise<MatchDTO>(() => {}))
        renderLobby()
        await user.click(await screen.findByRole('button', { name: 'Start match' }))
        // dan leaves on the server while the start runs
        serve(lobby({ teamBPlayers: [cy] }))
        await wait(2000)
        expect(screen.getByRole('button', { name: 'Sit here, team B' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /^Add a bot/ })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Fill with bots' })).not.toBeInTheDocument()
        expect(lobbyService.addBot).not.toHaveBeenCalled()
    })

    test('while Start is in flight a bot\'s seat takes no tap: no one-tap removal then (R42)', async () => {
        const user = userEvent.setup()
        vi.mocked(lobbyService.startMatch).mockImplementation(() => new Promise<MatchDTO>(() => {}))
        serve(lobby({ teamAPlayers: [ana, botAna], teamBPlayers: [botTin, botNika], unassignedPlayers: [] }))
        renderLobby()
        await user.click(await screen.findByRole('button', { name: 'Start match' }))
        await user.click(screen.getByRole('button', { name: 'Remove Bot-Ana, team A, bot' }))
        expect(lobbyService.kickPlayer).not.toHaveBeenCalled()
        expect(screen.queryByRole('button', { name: 'Removing…' })).not.toBeInTheDocument()
    })

    test('an outsider at a table of three bots is told to join to play; the join seats them in a bot\'s place', async () => {
        serve(lobby({ hostUser: bob, teamAPlayers: [bob, botAna], teamBPlayers: [botTin, botNika], unassignedPlayers: [] }))
        renderLobby()
        expect(await screen.findByText('You are looking at this lobby. Join to play.')).toBeInTheDocument()
        serve(lobby({ hostUser: bob, teamAPlayers: [bob, botAna], teamBPlayers: [botTin, ana], unassignedPlayers: [] }))
        await userEvent.setup().click(screen.getByRole('button', { name: 'Join lobby' }))
        expect(await screen.findByRole('button', { name: 'ana (you), team B' })).toBeInTheDocument()
        expect(screen.getByText('The host starts the match when all four seats are taken.')).toBeInTheDocument()
        expect(screen.queryByText('Not seated')).not.toBeInTheDocument()
    })

    test('a lobby from a backend before bots (no flag on its host) shows no chips and no "Fill with bots" (R27)', async () => {
        const host = { id: 'u1', username: 'ana' }
        serve(lobby({ hostUser: host, teamAPlayers: [host], teamBPlayers: [], unassignedPlayers: [] }))
        renderLobby()
        expect(await screen.findByRole('button', { name: 'Start match' })).toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: 'Sit here, team B' })).toHaveLength(2)
        expect(screen.queryByRole('button', { name: /^Add a bot/ })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Fill with bots' })).not.toBeInTheDocument()
    })

    test('a ranked lobby takes no bots: no chips and no "Fill with bots" (R12)', async () => {
        serve(lobby({ gameMode: 'RANKED', teamAPlayers: [ana], teamBPlayers: [], unassignedPlayers: [] }))
        renderLobby()
        expect(await screen.findByText('Ranked')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Start match' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /^Add a bot/ })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Fill with bots' })).not.toBeInTheDocument()
    })
})

describe('LobbyRoom: focus after a request at the table (R38, R43)', () => {
    const alone = () => lobby({ teamAPlayers: [ana], teamBPlayers: [], unassignedPlayers: [] })
    const seatAt = (position: string) => document.querySelector(`[data-position="${position}"] > button`)
    const chipAt = (position: string) => document.querySelector(`[data-position="${position}"] > button + button`)
    const settled = () => waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull())

    test('after a "+ Bot", focus goes to the next "+ Bot" round the table from the seat the bot took (R43)', async () => {
        const user = userEvent.setup()
        // ana at the bottom; open: right (B), top (A), left (B). The top chip seats Bot-Ana there; next round: left
        serve(alone())
        renderLobby()
        await screen.findByRole('button', { name: 'Add a bot to team A' })
        serve(lobby({ teamAPlayers: [ana, botAna], teamBPlayers: [], unassignedPlayers: [] }))
        await user.click(chipAt('top') as HTMLElement)
        await screen.findByRole('button', { name: 'Remove Bot-Ana, team A, bot' })
        await waitFor(() => expect(document.activeElement).toBe(chipAt('left')))
        expect(document.activeElement).toHaveAccessibleName('Add a bot to team B')
    })

    test('"round the table" starts at the seat the bot took, not the chip tapped: a standing host\'s top chip fills the bottom seat (R43)', async () => {
        const user = userEvent.setup()
        // ana standing: A1 bottom, B1 right, A2 top, B2 left, all open; Team A's list puts the bot in A1, at the bottom
        serve(lobby({ teamAPlayers: [], teamBPlayers: [], unassignedPlayers: [ana] }))
        renderLobby()
        await screen.findAllByRole('button', { name: 'Add a bot to team A' })
        serve(lobby({ teamAPlayers: [botAna], teamBPlayers: [], unassignedPlayers: [ana] }))
        await user.click(chipAt('top') as HTMLElement)
        await waitFor(() => expect(seatAt('bottom')).toHaveAccessibleName('Remove Bot-Ana, team A, bot'))
        await waitFor(() => expect(document.activeElement).toBe(chipAt('right')))
    })

    test('after a "+ Bot" that leaves no chip, focus goes to Start when it is enabled, otherwise to the new bot\'s seat (R43)', async () => {
        const user = userEvent.setup()
        serve(lobby({ teamAPlayers: [ana, botAna], teamBPlayers: [botTin], unassignedPlayers: [] }))
        renderLobby()
        await screen.findByRole('button', { name: 'Add a bot to team B' })
        serve(lobby({ teamAPlayers: [ana, botAna], teamBPlayers: [botTin, botNika], unassignedPlayers: [] }))
        await user.click(chipAt('left') as HTMLElement)
        await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Start match' })))
        cleanup()
        // dan stands: a bot makes four members, so no chip is left and Start stays off
        serve(lobby({ teamAPlayers: [ana], teamBPlayers: [bob], unassignedPlayers: [dan] }))
        renderLobby()
        await screen.findByRole('button', { name: 'Add a bot to team A' })
        serve(lobby({ teamAPlayers: [ana, botAna], teamBPlayers: [bob], unassignedPlayers: [dan] }))
        await user.click(chipAt('top') as HTMLElement)
        const bot = await screen.findByRole('button', { name: 'Remove Bot-Ana, team A, bot' })
        await waitFor(() => expect(document.activeElement).toBe(bot))
        expect(screen.getByRole('button', { name: 'Start match' })).toBeDisabled()
    })

    test('a "+ Bot" that fails leaves focus on that chip, for another try (R43)', async () => {
        const user = userEvent.setup()
        vi.mocked(lobbyService.addBot).mockRejectedValue(new ApiError({ status: 409, message: 'Lobby is full' }))
        serve(alone())
        renderLobby()
        await screen.findByRole('button', { name: 'Add a bot to team A' })
        await user.click(chipAt('top') as HTMLElement)
        expect(await screen.findByRole('alert')).toHaveTextContent('Lobby is full')
        await settled()
        await waitFor(() => expect(document.activeElement).toBe(chipAt('top')))
    })

    test('a sit that fails returns focus to the tapped seat (R43)', async () => {
        const user = userEvent.setup()
        vi.mocked(lobbyService.switchTeam).mockRejectedValue(new ApiError({ status: 409, message: 'Team A is full' }))
        serve(lobby({ teamAPlayers: [], teamBPlayers: [bob], unassignedPlayers: [ana] }))
        renderLobby()
        await screen.findByRole('heading', { name: 'Friday' })
        await user.click(seatAt('top') as HTMLElement)
        expect(await screen.findByRole('alert')).toHaveTextContent('Team A is full')
        await settled()
        expect(document.activeElement).toBe(seatAt('top'))
    })

    test('a sheet opened while a request runs keeps focus when it ends (I2)', async () => {
        const user = userEvent.setup()
        let land: (value: LobbyDTO) => void = () => {}
        vi.mocked(lobbyService.addBot).mockImplementation(() => new Promise<LobbyDTO>((resolve) => { land = resolve }))
        serve(alone())
        renderLobby()
        await screen.findByRole('button', { name: 'Add a bot to team A' })
        await user.click(chipAt('top') as HTMLElement)
        await user.click(screen.getByRole('button', { name: 'Lobby options' }))
        const options = sheet('Lobby options')
        expect(options).toContainElement(document.activeElement as HTMLElement)
        serve(lobby({ teamAPlayers: [ana, botAna], teamBPlayers: [], unassignedPlayers: [] }))
        await act(async () => land(alone()))
        await screen.findByRole('button', { name: 'Remove Bot-Ana, team A, bot' })
        await settled()
        expect(options).toContainElement(document.activeElement as HTMLElement)
    })

    test('one tap that removes a bot leaves focus on that seat, now open (R37)', async () => {
        const user = userEvent.setup()
        serve(lobby({ teamAPlayers: [ana, botAna], teamBPlayers: [], unassignedPlayers: [] }))
        renderLobby()
        const seat = await screen.findByRole('button', { name: 'Remove Bot-Ana, team A, bot' })
        expect(seat).toBe(seatAt('top'))
        serve(alone())
        await user.click(seat)
        await waitFor(() => expect(seatAt('top')).toHaveAccessibleName('Open seat, team A'))
        await waitFor(() => expect(document.activeElement).toBe(seatAt('top')))
    })

    test('a host who sits down has focus on their own seat, which the table turns to the bottom', async () => {
        const user = userEvent.setup()
        // ana standing, bob on B: A1 (bottom) and A2 (top) are free; she taps the top one and lands in A1
        serve(lobby({ teamAPlayers: [], teamBPlayers: [bob], unassignedPlayers: [ana] }))
        renderLobby()
        await screen.findByRole('heading', { name: 'Friday' })
        serve(lobby({ teamAPlayers: [ana], teamBPlayers: [bob], unassignedPlayers: [] }))
        await user.click(seatAt('top') as HTMLElement)
        const mine = await screen.findByRole('button', { name: 'ana (you), team A' })
        expect(mine).toBe(seatAt('bottom'))
        await waitFor(() => expect(document.activeElement).toBe(mine))
    })

    test('a fill that leaves Start enabled puts focus on Start match; one that does not leaves focus where it fell', async () => {
        const user = userEvent.setup()
        serve(alone())
        renderLobby()
        serve(lobby({ teamAPlayers: [ana, botAna], teamBPlayers: [botTin, botNika], unassignedPlayers: [] }))
        await user.click(await screen.findByRole('button', { name: 'Fill with bots' }))
        await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Start match' })))
        cleanup()
        // dan stands, so the table fills but Start stays off
        serve(lobby({ teamAPlayers: [ana], teamBPlayers: [], unassignedPlayers: [dan] }))
        renderLobby()
        serve(lobby({ teamAPlayers: [ana, botAna], teamBPlayers: [botTin], unassignedPlayers: [dan] }))
        await user.click(await screen.findByRole('button', { name: 'Fill with bots' }))
        await screen.findByRole('button', { name: 'Remove Bot-Tin, team B, bot' })
        await settled()
        expect(screen.getByRole('button', { name: 'Start match' })).toBeDisabled()
        expect(document.activeElement).toBe(document.body)
    })

    test('focus that was elsewhere when the request started and is still there stays put; on the page, it goes to the next "+ Bot"', async () => {
        serve(alone())
        renderLobby()
        const chip = await screen.findByRole('button', { name: 'Add a bot to team A' })
        const copy = screen.getByRole('button', { name: 'Copy invite link' })
        act(() => copy.focus())
        serve(lobby({ teamAPlayers: [ana, botAna], teamBPlayers: [], unassignedPlayers: [] }))
        // a tap that doesn't take focus (Safari doesn't focus a tapped button)
        fireEvent.click(chip)
        await screen.findByRole('button', { name: 'Remove Bot-Ana, team A, bot' })
        await settled()
        expect(document.activeElement).toBe(copy)
        // the same tap with focus on the page: Bot-Tin takes the right seat, and focus the next chip round, on the left
        act(() => copy.blur())
        serve(lobby({ teamAPlayers: [ana, botAna], teamBPlayers: [botTin], unassignedPlayers: [] }))
        fireEvent.click(chipAt('right') as HTMLElement)
        await screen.findByRole('button', { name: 'Remove Bot-Tin, team B, bot' })
        await waitFor(() => expect(document.activeElement).toBe(chipAt('left')))
    })
})
