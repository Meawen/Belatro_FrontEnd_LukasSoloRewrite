import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, act, within } from '@testing-library/react'
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

const ana = { id: 'u1', username: 'ana' }
const bob = { id: 'u2', username: 'bob' }
const cy = { id: 'u3', username: 'cy' }
const dan = { id: 'u4', username: 'dan' }

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
        expect(await screen.findByText('You are looking at this lobby. Join to pick a seat.')).toBeInTheDocument()
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
