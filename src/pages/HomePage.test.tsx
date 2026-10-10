import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { HomePage } from './HomePage'
import { useUser } from '../hooks/useUser'
import { userService } from '../services/userService'
import { matchHistoryService } from '../services/matchHistoryService'
import { ACTIVE_GAME_POLL_MS } from '../components/layout/ActiveGameBanner'
import type { PlayerMatchSummaryDTO } from '../types/user'

// Tailwind's own colour scale (bg-amber-600, text-emerald-950, …): the design uses tokens only (spec §3.2)
const RAW_PALETTE = /\b(?:bg|text|border|from|to|via)-(?:amber|emerald|slate|red|purple|gray|blue|yellow|green|orange|teal|lime|pink)-\d/

vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'u1', username: 'ana' }, isAuthenticated: true, isLoading: false, token: 'tok-1' }),
}))
// The player's numbers come from GET /user/{id} through useUser
vi.mock('../hooks/useUser', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../hooks/useUser')>()),
    useUser: vi.fn(),
}))
vi.mock('../services/userService', () => ({ userService: { getActiveGame: vi.fn() } }))
vi.mock('../services/matchHistoryService', () => ({ matchHistoryService: { getMatchSummary: vi.fn() } }))

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
    vi.mocked(useUser).mockReturnValue({
        user: { id: 'u1', username: 'ana', eloRating: 1450, level: 0, gamesPlayed: 42 },
        isLoading: false, error: null, refetch: vi.fn(),
    } as never)
    vi.mocked(userService.getActiveGame).mockResolvedValue(null)
    vi.mocked(matchHistoryService.getMatchSummary).mockResolvedValue([])
})
afterEach(() => vi.useRealTimers())

describe('Home (spec §4.4; D-26)', () => {
    test('greets the player in the page’s only h1, and the tab is titled Home', async () => {
        renderHome()
        await settle()
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
        expect(screen.getByRole('heading', { level: 1, name: 'Hi, ana' })).toBeInTheDocument()
        expect(document.title).toBe('Home · Stiglja')
    })

    test('"Play ranked" shows the player’s Elo and leads to /play', async () => {
        renderHome()
        await settle()
        const play = screen.getByRole('button', { name: 'Play ranked' })
        expect(within(play.closest('section') as HTMLElement).getByText('1450')).toBeInTheDocument()
        await userEvent.setup().click(play)
        expect(screen.getByText('at /play')).toBeInTheDocument()
    })

    test('Lobbies: "Open lobbies" leads to /lobbies, "Create lobby" opens the create sheet there', async () => {
        const user = userEvent.setup()
        const { unmount } = renderHome()
        await settle()
        await user.click(screen.getByRole('button', { name: 'Open lobbies' }))
        expect(screen.getByText('at /lobbies')).toBeInTheDocument()
        unmount()
        renderHome()
        await settle()
        await user.click(screen.getByRole('button', { name: 'Create lobby' }))
        expect(screen.getByText('at /lobbies?create=1')).toBeInTheDocument()
    })

    test('the stats strip is Elo, Games and Level; nothing on Home uses the raw palette', async () => {
        const { container } = renderHome()
        await settle()
        const strip = screen.getByTestId('dashboard-elo').closest('dl') as HTMLElement
        expect(within(strip).getAllByRole('term').map((term) => term.textContent)).toEqual(['Elo', 'Games', 'Level'])
        expect(container.innerHTML).not.toMatch(RAW_PALETTE)
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
