import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { HomePage } from './HomePage'
import { notifyMeChanged, useUser } from '../hooks/useUser'
import { userService } from '../services/userService'
import { lobbyService } from '../services/lobbyService'
import { matchHistoryService } from '../services/matchHistoryService'
import { ApiError } from '../services/api'
import { ACTIVE_GAME_POLL_MS } from '../components/layout/ActiveGameBanner'
import type { PlayerMatchSummaryDTO, UserDto } from '../types/user'
import type { LobbyDTO } from '../types/lobby'
import { rankedUser } from '../test/fixtures/ranks'
import { setLang } from '../i18n/lang'
import { LONG_NAMES } from '../dev/devTable'

// Tailwind's own colour scale (bg-amber-600, text-emerald-950, …): the design uses tokens only (spec §3.2)
const RAW_PALETTE = /\b(?:bg|text|border|from|to|via)-(?:amber|emerald|slate|red|purple|gray|blue|yellow|green|orange|teal|lime|pink)-\d/

const home = vi.hoisted(() => ({ username: 'ana' }))
vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'u1', username: home.username }, isAuthenticated: true, isLoading: false, token: 'tok-1' }),
}))
// The player's numbers come from GET /user/{id} through useUser
vi.mock('../hooks/useUser', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../hooks/useUser')>()),
    useUser: vi.fn(),
}))
vi.mock('../services/userService', () => ({ userService: { getActiveGame: vi.fn(), getMe: vi.fn(), resendEmailConfirmation: vi.fn() } }))
vi.mock('../services/lobbyService', () => ({ lobbyService: { getAllOpenLobbies: vi.fn() } }))
vi.mock('../services/matchHistoryService', () => ({ matchHistoryService: { getMatchSummary: vi.fn() } }))
// The one-click bot game (spec §6): its request is botGame.test's; here a stub
const bots = vi.hoisted(() => ({ startBotGame: vi.fn() }))
vi.mock('../services/botGame', () => ({ startBotGame: bots.startBotGame }))

const VERIFIED: UserDto = {
    id: 'u1', username: 'ana', email: 'ana@example.com', pendingEmail: null, emailVerified: true, roles: ['ROLE_USER'], deletionRequested: false,
}

function row(matchId: string, yourOutcome: string): PlayerMatchSummaryDTO {
    return { matchId, endTime: null, result: 'Team A wins 1001–650', yourOutcome, gameMode: 'RANKED' }
}

/** Where a button or link led. */
function Where() {
    const { pathname, search } = useLocation()
    return <p>at {pathname + search}</p>
}

function renderHome() {
    return render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
                <Route path="/dashboard" element={<HomePage />} />
                <Route path="*" element={<Where />} />
            </Routes>
        </MemoryRouter>,
    )
}

/** Lets pending answers land. */
async function settle() {
    await act(async () => {})
}

beforeEach(() => {
    vi.clearAllMocks()
    home.username = 'ana'
    vi.mocked(useUser).mockReturnValue({
        user: { id: 'u1', username: 'ana', eloRating: 1450, level: 0, gamesPlayed: 42 },
        isLoading: false, error: null, refetch: vi.fn(),
    } as never)
    vi.mocked(userService.getActiveGame).mockResolvedValue(null)
    vi.mocked(userService.getMe).mockResolvedValue(VERIFIED)
    vi.mocked(lobbyService.getAllOpenLobbies).mockResolvedValue([{ id: 'l1' }, { id: 'l2' }] as LobbyDTO[])
    vi.mocked(matchHistoryService.getMatchSummary).mockResolvedValue([])
    bots.startBotGame.mockReset()
})
afterEach(() => {
    vi.useRealTimers()
    setLang('en')
})

describe('Doma (spec §5, option B)', () => {
    test('greets the player in the page’s only h1, and the tab is titled Home', async () => {
        renderHome()
        await settle()
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
        expect(screen.getByRole('heading', { level: 1, name: 'Hi, ana! What are we playing?' })).toBeInTheDocument()
        expect(document.title).toBe('Home · Stiglja')
    })

    test('the stats strip is Elo, Games and Level; nothing on Home uses the raw palette', async () => {
        const { container } = renderHome()
        await settle()
        const strip = screen.getByTestId('dashboard-elo').closest('dl') as HTMLElement
        expect(within(strip).getAllByRole('term').map((term) => term.textContent)).toEqual(['Elo', 'Games', 'Level'])
        expect(container.innerHTML).not.toMatch(RAW_PALETTE)
    })

    test('the game card sits above the two halves (spec §5)', async () => {
        vi.mocked(userService.getActiveGame).mockResolvedValue('g1')
        renderHome()
        const card = await screen.findByRole('region', { name: 'Game in progress' })
        const bots = screen.getByRole('region', { name: 'Against bots' })
        expect(card.compareDocumentPosition(bots) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    test('two halves, each with one primary action: Play now and Play ranked (spec §5, §8)', async () => {
        renderHome()
        await settle()
        for (const [half, action] of [['Against bots', 'Play now'], ['Against people', 'Play ranked']]) {
            const region = screen.getByRole('region', { name: half })
            const primary = region.querySelectorAll('.ui-btn--primary')
            expect(primary, half).toHaveLength(1)
            expect(primary[0]).toHaveTextContent(action)
        }
    })

    test('with a game running, Return to your game is the main button and Play now secondary; without one, Play now is (Ruling 71)', async () => {
        vi.mocked(userService.getActiveGame).mockResolvedValue('g1')
        const { unmount } = renderHome()
        const card = await screen.findByRole('region', { name: 'Game in progress' })
        expect(within(card).getByRole('button', { name: 'Return to your game' })).toHaveClass('ui-btn--primary')
        expect(screen.getByRole('button', { name: 'Play now' })).toHaveClass('ui-btn--secondary')
        expect(screen.getByRole('region', { name: 'Against bots' }).querySelectorAll('.ui-btn--primary')).toHaveLength(0)
        unmount()

        vi.mocked(userService.getActiveGame).mockResolvedValue(null)
        renderHome()
        await settle()
        expect(screen.queryByRole('region', { name: 'Game in progress' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Play now' })).toHaveClass('ui-btn--primary')
    })

    test("Against bots: you and three bots, and it says your rating doesn't change", async () => {
        renderHome()
        await settle()
        const half = screen.getByRole('region', { name: 'Against bots' })
        const seats = within(half).getByRole('list', { name: 'Seats at the table' })
        expect(within(seats).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['You', 'Bot', 'Bot', 'Bot'])
        expect(half).toHaveTextContent("Three bots, and the game starts at once. It doesn't change your rating.")
    })

    test('Play now starts a game against three bots and opens it (spec §6)', async () => {
        bots.startBotGame.mockResolvedValue({ gameId: 'g7', lobbyId: 'l7' })
        renderHome()
        await settle()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Play now' }))
        expect(await screen.findByText('at /game/g7')).toBeInTheDocument()
        expect(bots.startBotGame).toHaveBeenCalledTimes(1)
    })

    test("Play now refused: the bots' 503, and ALREADY_IN_GAME with the way back", async () => {
        const user = userEvent.setup()
        bots.startBotGame.mockRejectedValueOnce(new ApiError({ status: 503, message: 'Service Unavailable' }))
        const { unmount } = renderHome()
        await settle()
        await user.click(screen.getByRole('button', { name: 'Play now' }))
        expect(await screen.findByRole('alert')).toHaveTextContent("Bots aren't available right now. Try again later.")
        expect(screen.getByRole('button', { name: 'Play now' })).toBeEnabled()
        unmount()

        vi.mocked(userService.getActiveGame).mockReset().mockResolvedValueOnce(null).mockResolvedValue('g1')
        bots.startBotGame.mockRejectedValueOnce(new ApiError({ status: 409, message: 'You already have a game in progress', code: 'ALREADY_IN_GAME' }))
        renderHome()
        await settle()
        expect(screen.queryByRole('region', { name: 'Game in progress' })).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Play now' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('You already have a game in progress. Go back to it first.')
        const card = await screen.findByRole('region', { name: 'Game in progress' })
        expect(within(card).getByRole('button', { name: 'Return to your game' })).toBeInTheDocument()
        expect(userService.getActiveGame).toHaveBeenCalledTimes(2)
    })

    test('Play now refused by the limit (429) or with no answer: the line, and Play now again (spec §8)', async () => {
        const user = userEvent.setup()
        bots.startBotGame
            .mockRejectedValueOnce(new ApiError({ status: 429, message: 'Too many requests, try again later', code: 'RATE_LIMITED' }))
            .mockRejectedValueOnce(new ApiError({ status: 0, message: 'Failed to fetch' }))
        renderHome()
        await settle()
        for (const line of ['Too many tries. Wait a little, then try again.', "Bots aren't available right now. Try again later."]) {
            await user.click(screen.getByRole('button', { name: 'Play now' }))
            expect(await screen.findByText(line)).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Play now' })).toBeEnabled()
        }
    })

    test('Against people: Play ranked opens /play, Private table opens the create sheet with Private on, Tables (n) opens the Birtija', async () => {
        const user = userEvent.setup()
        for (const [name, path] of [['Play ranked', '/play'], ['Private table', '/lobbies?create=private'], ['Tables (2)', '/lobbies']]) {
            const { unmount } = renderHome()
            await settle()
            await user.click(within(screen.getByRole('region', { name: 'Against people' })).getByRole('button', { name }))
            expect(screen.getByText(`at ${path}`), name).toBeInTheDocument()
            unmount()
        }
        expect(lobbyService.getAllOpenLobbies).toHaveBeenCalledTimes(3)

        vi.mocked(lobbyService.getAllOpenLobbies).mockRejectedValue(new ApiError({ status: 503, message: 'Service Unavailable' }))
        renderHome()
        await settle()
        expect(within(screen.getByRole('region', { name: 'Against people' })).getByRole('button', { name: 'Tables' })).toBeInTheDocument()
    })

    test('an unverified address locks Play ranked, says why, and offers to resend the email (spec §5, §8)', async () => {
        vi.mocked(userService.getMe).mockResolvedValue({ ...VERIFIED, emailVerified: false, pendingEmail: 'ana@example.com', email: null, verifyBy: '2026-11-06T10:00:00Z' })
        renderHome()
        await settle()
        const half = screen.getByRole('region', { name: 'Against people' })
        const ranked = within(half).getByRole('button', { name: 'Play ranked' })
        expect(ranked).toBeDisabled()
        // spec §2.1 (US-26): the day the account goes, on the first screen after signing up (the banner gives way here)
        expect(within(half).getByText(/Confirm ana@example\.com to play ranked/)).toHaveTextContent(
            'Confirm ana@example.com to play ranked: use the link if one arrived, or ask for a new one. If no email address is confirmed by November 6, 2026, the account will be removed.')
        expect(ranked).toHaveAccessibleDescription(/Confirm ana@example\.com to play ranked/)
        expect(within(half).getByRole('button', { name: 'Resend confirmation email' })).toBeInTheDocument()
        await userEvent.setup().click(ranked)
        expect(screen.queryByText('at /play')).not.toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 1, name: 'Hi, ana! What are we playing?' })).toBeInTheDocument()
    })

    test('no address at all: the lock leads to Settings', async () => {
        vi.mocked(userService.getMe).mockResolvedValue({ ...VERIFIED, emailVerified: false, email: null, pendingEmail: null })
        renderHome()
        await settle()
        const half = screen.getByRole('region', { name: 'Against people' })
        expect(within(half).getByText('Add an email address to play ranked.')).toBeInTheDocument()
        expect(within(half).getByRole('link', { name: 'Open settings' })).toHaveAttribute('href', '/settings')
        expect(within(half).getByRole('button', { name: 'Play ranked' })).toBeDisabled()
    })

    test('an address confirmed meanwhile unlocks Play ranked: Doma asks GET /user/me again when this tab says it changed (Ruling 48)', async () => {
        vi.mocked(userService.getMe).mockResolvedValueOnce({ ...VERIFIED, emailVerified: false, pendingEmail: 'ana@example.com', email: null })
        renderHome()
        await settle()
        const half = screen.getByRole('region', { name: 'Against people' })
        expect(within(half).getByRole('button', { name: 'Play ranked' })).toBeDisabled()
        // what a resend that finds nothing to confirm, or Settings, fires (useUser's notifyMeChanged)
        await act(async () => notifyMeChanged())
        await settle()
        expect(userService.getMe).toHaveBeenCalledTimes(2)
        expect(within(half).getByRole('button', { name: 'Play ranked' })).toBeEnabled()
        expect(within(half).queryByRole('button', { name: 'Resend confirmation email' })).not.toBeInTheDocument()
    })

    test("a verified member's Play ranked is enabled", async () => {
        renderHome()
        await settle()
        const half = screen.getByRole('region', { name: 'Against people' })
        expect(within(half).getByRole('button', { name: 'Play ranked' })).toBeEnabled()
        expect(within(half).queryByRole('button', { name: 'Resend confirmation email' })).not.toBeInTheDocument()
    })

    test('New to bela? leads to Bela school (/learn)', async () => {
        renderHome()
        await settle()
        expect(screen.getByRole('heading', { level: 2, name: 'New to bela?' })).toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Bela school' }))
        expect(screen.getByText('at /learn')).toBeInTheDocument()
    })

    test('Doma in Croatian (§1.4, §5)', async () => {
        setLang('hr')
        renderHome()
        await settle()
        expect(screen.getByRole('heading', { level: 1, name: 'Bok, ana! Što igramo?' })).toBeInTheDocument()
        for (const name of ['Protiv botova', 'Protiv ljudi', 'Prvi put igraš belu?']) expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
        for (const name of ['Igraj odmah', 'Igraj rangirano', 'Stol za ekipu', 'Birtija (2)', 'Škola bele']) expect(screen.getByRole('button', { name })).toBeInTheDocument()
        const seats = screen.getByRole('list', { name: 'Mjesta za stolom' })
        expect(within(seats).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Ti', 'Bot', 'Bot', 'Bot'])
        expect(document.title).toBe('Doma · Stiglja')
    })

    test('a 20-character name wraps in the greeting (long names fit)', async () => {
        home.username = LONG_NAMES.dave
        renderHome()
        await settle()
        expect(screen.getByRole('heading', { level: 1, name: `Hi, ${LONG_NAMES.dave}! What are we playing?` })).toHaveClass('break-words')
    })
})

describe('Home: recent matches (spec §4.4 item 6)', () => {
    test('the newest three from the summary, each opening its match, and "All matches"', async () => {
        vi.mocked(matchHistoryService.getMatchSummary).mockResolvedValue([row('m1', 'WIN'), row('m2', 'LOSS'), row('m3', 'WIN')])
        const user = userEvent.setup()
        const { unmount } = renderHome()
        expect(await screen.findAllByRole('link', { name: /Victory|Defeat/ })).toHaveLength(3)
        expect(matchHistoryService.getMatchSummary).toHaveBeenCalledWith('u1', 0, 3)
        await user.click(screen.getAllByRole('link', { name: /Victory/ })[0])
        expect(screen.getByText('at /matches/m1')).toBeInTheDocument()
        unmount()
        renderHome()
        await user.click(screen.getByRole('button', { name: 'All matches' }))
        expect(screen.getByText('at /matches')).toBeInTheDocument()
    })

    test('a loader while they load, then "No matches yet"', async () => {
        let answer: (rows: PlayerMatchSummaryDTO[]) => void = () => {}
        vi.mocked(matchHistoryService.getMatchSummary).mockReturnValue(new Promise((resolve) => (answer = resolve)))
        renderHome()
        await settle()
        expect(screen.getByText('Loading matches...')).toBeInTheDocument()
        await act(async () => answer([]))
        expect(screen.getByText('No matches yet')).toBeInTheDocument()
        expect(screen.queryByText('Loading matches...')).not.toBeInTheDocument()
    })

    test('a failed load is a quiet line, not an alert, and the rest of Home stays', async () => {
        vi.mocked(matchHistoryService.getMatchSummary).mockRejectedValue(new Error('down'))
        renderHome()
        expect(await screen.findByText("Couldn't load your recent matches.")).toBeInTheDocument()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Play ranked' })).toBeInTheDocument()
    })
})

describe('Home: Return to your game (spec §4.4 item 2; §2.5 R-33)', () => {
    test('a game in progress (200) shows the card, and it leads to the game', async () => {
        vi.mocked(userService.getActiveGame).mockResolvedValue('g1')
        renderHome()
        const card = await screen.findByRole('region', { name: 'Game in progress' })
        expect(card).toHaveTextContent('You have a game in progress.')
        expect(card).toHaveClass('ui-panel--accent')
        await userEvent.setup().click(within(card).getByRole('button', { name: 'Return to your game' }))
        expect(screen.getByText('at /game/g1')).toBeInTheDocument()
    })

    test('no game (204): no card', async () => {
        renderHome()
        await settle()
        expect(userService.getActiveGame).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('region', { name: 'Game in progress' })).not.toBeInTheDocument()
    })

    test('the card asks again every 30 s: a failed check keeps it, a 204 then hides it', async () => {
        vi.useFakeTimers()
        vi.mocked(userService.getActiveGame)
            .mockResolvedValueOnce('g1')
            .mockRejectedValueOnce(new Error('down'))
            .mockResolvedValue(null)
        renderHome()
        await settle()
        expect(screen.getByRole('region', { name: 'Game in progress' })).toBeInTheDocument()
        await act(async () => {
            await vi.advanceTimersByTimeAsync(ACTIVE_GAME_POLL_MS)
        })
        expect(screen.getByRole('region', { name: 'Game in progress' })).toBeInTheDocument()
        await act(async () => {
            await vi.advanceTimersByTimeAsync(ACTIVE_GAME_POLL_MS)
        })
        expect(userService.getActiveGame).toHaveBeenCalledTimes(3)
        expect(screen.queryByRole('region', { name: 'Game in progress' })).not.toBeInTheDocument()
    })
})

// ranks spec §6.4: the rank beside your Elo in the stats strip
describe('Home rank', () => {
    test('the Elo tile carries your rank tag under the number; dashboard-elo still reads the number', async () => {
        vi.mocked(useUser).mockReturnValue({ user: rankedUser({ key: 'MAJSTER', eloRating: 1650 }), isLoading: false, error: null, refetch: vi.fn() } as never)
        renderHome()
        await settle()
        expect(screen.getByTestId('dashboard-elo')).toHaveTextContent(/^1650$/)
        const tile = screen.getByTestId('dashboard-elo').closest('.ui-panel') as HTMLElement
        expect(within(tile).getByText('Majster').closest('.ui-tag')).toHaveClass('bg-rank-majster')
    })

    test('no rank (a backend before team Elo): the tile as before', async () => {
        renderHome()
        await settle()
        expect(document.querySelector('[data-rank]')).toBeNull()
        expect(screen.getByTestId('dashboard-elo')).toHaveTextContent(/^1450$/)
    })
})
