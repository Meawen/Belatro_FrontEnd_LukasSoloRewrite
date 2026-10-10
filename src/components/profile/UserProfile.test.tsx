import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { UserProfile } from './UserProfile'
import { useUser, useMe, useUserHistorySummary } from '../../hooks/useUser'
import { useFriends } from '../../hooks/useFriends'
import { ApiError } from '../../services/api'
import type { PlayerMatchSummaryDTO } from '../../types/user'

// Tailwind's own colour scale (from-amber-500, text-emerald-300, …): the design uses tokens only (spec §3.2)
const RAW_PALETTE = /\b(?:bg|text|border|from|to|via)-(?:amber|emerald|slate|red|purple|gray|blue|yellow|green|orange|teal|lime|pink)-\d/

vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'u1', username: 'ana' }, isAuthenticated: true, isLoading: false }),
}))
vi.mock('../../hooks/useUser', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../hooks/useUser')>()),
    useUser: vi.fn(),
    useMe: vi.fn(),
    useUserHistorySummary: vi.fn(),
}))
vi.mock('../../hooks/useFriends', () => ({ useFriends: vi.fn() }))

const ana = { id: 'u1', username: 'ana', eloRating: 1450, level: 3, gamesPlayed: 42 }
const bob = { id: 'u2', username: 'bob', eloRating: 1250, level: 1, gamesPlayed: 3 }
const meBase = { id: 'u1', username: 'ana', email: 'ana@example.com', pendingEmail: null, emailVerified: true, roles: ['ROLE_USER', 'ROLE_ADMIN'], deletionRequested: false }
const sendFriendRequest = vi.fn()

function summary(matchId: string, yourOutcome: string): PlayerMatchSummaryDTO {
    return { matchId, endTime: null, result: 'Team A wins 1001–650', yourOutcome, gameMode: 'CASUAL' }
}

function mockPlayer(user: unknown, extra: { isLoading?: boolean; error?: unknown } = {}) {
    vi.mocked(useUser).mockReturnValue({ user, isLoading: false, error: null, refetch: vi.fn().mockResolvedValue(undefined), ...extra } as never)
}

function renderProfile(userId?: string) {
    return render(<UserProfile userId={userId} />, { wrapper: MemoryRouter })
}

beforeEach(() => {
    vi.clearAllMocks()
    mockPlayer(ana)
    vi.mocked(useMe).mockImplementation((enabled = true) => ({ data: enabled ? meBase : null, isLoading: false, error: null, refetch: vi.fn() }) as never)
    vi.mocked(useUserHistorySummary).mockReturnValue({ data: { content: [] }, isLoading: false, error: null } as never)
    vi.mocked(useFriends).mockReturnValue({
        friendships: [], sendFriendRequest, acceptFriendRequest: vi.fn(), rejectFriendRequest: vi.fn(),
        cancelFriendRequest: vi.fn(), removeFriend: vi.fn(),
    } as never)
})

describe('UserProfile (carried)', () => {
    test("someone else's profile has no deletion section", () => {
        mockPlayer(bob)
        renderProfile('u2')
        expect(useMe).toHaveBeenCalledWith(false)
        expect(screen.queryByRole('button', { name: /request account deletion/i })).not.toBeInTheDocument()
    })

    test("someone else's profile shows stats but no email or roles", () => {
        mockPlayer(bob)
        renderProfile('u2')
        expect(screen.getByRole('heading', { level: 1, name: 'bob' })).toBeInTheDocument()
        expect(screen.getByText('1250')).toBeInTheDocument()
        expect(screen.queryByText(/Email/)).not.toBeInTheDocument()
        expect(screen.queryByText('ADMIN')).not.toBeInTheDocument()
        expect(screen.queryByText('USER')).not.toBeInTheDocument()
    })

    test('own profile shows its roles from /user/me', () => {
        renderProfile()
        expect(useMe).toHaveBeenCalledWith(true)
        expect(screen.getByText('ADMIN')).toBeInTheDocument()
        expect(screen.getByText('USER')).toBeInTheDocument()
        // the address lives in Settings now (D-32)
        expect(screen.queryByText('ana@example.com')).not.toBeInTheDocument()
    })

    test('no experience-points tile: the API no longer serves expPoints', () => {
        renderProfile()
        expect(screen.queryByText('Experience Points')).not.toBeInTheDocument()
        expect(screen.queryByText('Experience Progress')).not.toBeInTheDocument()
    })

    // R-34: a new player is level 0 in the database and Level 1 on every screen; the numbers show once
    test('a level of 0 shows as 1 (R-34)', () => {
        mockPlayer({ ...ana, level: 0 })
        renderProfile()
        expect(screen.getAllByText('Level', { selector: 'dt' })).toHaveLength(1)
        expect(screen.getByText('Level', { selector: 'dt' }).nextElementSibling).toHaveTextContent(/^1$/)
    })

    test('no debug Target ID while loading or when the profile is missing', () => {
        mockPlayer(null, { isLoading: true })
        const { unmount } = renderProfile()
        expect(screen.getByText('Loading profile...')).toBeInTheDocument()
        expect(screen.queryByText(/Target ID/)).not.toBeInTheDocument()
        unmount()
        mockPlayer(null, { error: new ApiError({ status: 404, message: 'User not found with id u9' }) })
        renderProfile('u9')
        expect(screen.getByText('Profile not found')).toBeInTheDocument()
        expect(screen.queryByText(/Target ID/)).not.toBeInTheDocument()
    })
})

describe('UserProfile (spec §4.10)', () => {
    test('Elo, Games and Level once, "—" where the API gives nothing; no rank ladder, no one-tab bar', () => {
        mockPlayer({ ...ana, eloRating: null, gamesPlayed: null })
        const { container } = renderProfile()
        expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['ana'])
        expect(screen.getByText('Elo', { selector: 'dt' }).nextElementSibling).toHaveTextContent(/^—$/)
        expect(screen.getByText('Games', { selector: 'dt' }).nextElementSibling).toHaveTextContent(/^—$/)
        for (const gone of ['Ranking', 'Progress to Next Rank', 'Statistics', 'Game Statistics', '1200']) {
            expect(screen.queryByText(gone)).not.toBeInTheDocument()
        }
        expect(container.innerHTML).not.toMatch(RAW_PALETTE)
    })

    test('my own avatar is in the accent, another player\'s is not (X-12)', () => {
        const { container, unmount } = renderProfile()
        expect(container.querySelector('.ui-avatar')).toHaveClass('bg-accent')
        unmount()
        mockPlayer(bob)
        const { container: other } = renderProfile('u2')
        expect(other.querySelector('.ui-avatar')).not.toHaveClass('bg-accent')
    })

    test("the newest five matches as match rows, another player's too", () => {
        mockPlayer(bob)
        vi.mocked(useUserHistorySummary).mockReturnValue({
            data: { content: [summary('6ac9061df0a9f70ffc4dfa74', 'WIN'), summary('6ac8f3f6cf32dc27b44c2d88', 'LOSS')] },
            isLoading: false, error: null,
        } as never)
        renderProfile('u2')
        expect(useUserHistorySummary).toHaveBeenCalledWith('u2', { page: 0, size: 5 })
        expect(screen.getByRole('heading', { level: 2, name: 'Recent matches' })).toBeInTheDocument()
        const links = screen.getAllByRole('link')
        expect(links.map((link) => link.getAttribute('href'))).toEqual(['/matches/6ac9061df0a9f70ffc4dfa74', '/matches/6ac8f3f6cf32dc27b44c2d88'])
        expect(links[0]).toHaveTextContent('Victory')
    })

    test('no matches yet, or a quiet line when they cannot be loaded', () => {
        const { unmount } = renderProfile()
        expect(screen.getByText('No matches yet')).toBeInTheDocument()
        unmount()
        vi.mocked(useUserHistorySummary).mockReturnValue({ data: null, isLoading: false, error: new ApiError({ status: 503, message: 'Service Unavailable' }) } as never)
        renderProfile()
        expect(screen.getByText("Couldn't load the recent matches.")).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 1, name: 'ana' })).toBeInTheDocument()
    })

    test("another player's profile offers the friend actions, sending only the recipient; mine has none", async () => {
        mockPlayer(bob)
        const { unmount } = renderProfile('u2')
        expect(useFriends).toHaveBeenCalledWith('u1')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Add Friend' }))
        expect(sendFriendRequest).toHaveBeenCalledWith({ toUserId: 'u2' })
        unmount()
        mockPlayer(ana)
        renderProfile()
        expect(useFriends).toHaveBeenLastCalledWith(undefined)
        expect(screen.queryByRole('button', { name: 'Add Friend' })).not.toBeInTheDocument()
    })

    test('a profile that fails to load says so and offers Try Again, without the raw status', async () => {
        const refetch = vi.fn().mockResolvedValue(undefined)
        vi.mocked(useUser).mockReturnValue({ user: null, isLoading: false, error: new ApiError({ status: 500, message: 'Internal Server Error' }), refetch } as never)
        renderProfile('u2')
        expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load this profile")
        expect(screen.queryByText(/Status:/)).not.toBeInTheDocument()
        expect(screen.queryByText(/Internal Server Error/)).not.toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Try Again' }))
        expect(refetch).toHaveBeenCalledTimes(1)
    })
})
