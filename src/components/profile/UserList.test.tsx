import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { UserList } from './UserList'
import { useUsersPage } from '../../hooks/useUser'
import { useFriends } from '../../hooks/useFriends'
import { ApiError } from '../../services/api'
import { viewport } from '../../test/viewport'

// Tailwind's own colour scale (bg-purple-600, text-slate-400, …): the design uses tokens only (spec §3.2)
const RAW_PALETTE = /\b(?:bg|text|border|from|to|via)-(?:amber|emerald|slate|red|purple|gray|blue|yellow|green|orange|teal|lime|pink)-\d/

vi.mock('../../hooks/useUser', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../hooks/useUser')>()),
    useUsersPage: vi.fn(),
}))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' }, isAuthenticated: true }) }))
vi.mock('../../hooks/useFriends', () => ({ useFriends: vi.fn() }))

const ana = { id: 'u1', username: 'ana', eloRating: 1300, level: 2, gamesPlayed: 10 }
const bob = { id: 'u2', username: 'bob', eloRating: 1250, level: 1, gamesPlayed: 3 }
const cy = { id: 'u3', username: 'cy', eloRating: 1400, level: 4, gamesPlayed: 30 }
// a new account: the highest Elo on the page, but no game yet (O-3)
const dee = { id: 'u4', username: 'dee', eloRating: 1500, level: 0, gamesPlayed: 0 }

const rows = () => screen.getAllByRole('listitem')
const names = () => rows().map((row) => within(row).getByRole('link').textContent)

function renderList() {
    return render(<UserList />, { wrapper: MemoryRouter })
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useFriends).mockReturnValue({
        friendships: [], sendFriendRequest: vi.fn(), acceptFriendRequest: vi.fn(), rejectFriendRequest: vi.fn(),
        cancelFriendRequest: vi.fn(), removeFriend: vi.fn(),
    } as never)
    vi.mocked(useUsersPage).mockImplementation((page: number) => ({
        data: { content: [ana, bob, cy], totalElements: 41, totalPages: 3, number: page, size: 20 },
        isLoading: false, error: null, refetch: vi.fn(),
    }) as never)
})
afterEach(() => vi.unstubAllGlobals())

describe('UserList (server-side paging and search)', () => {
    // D-28: the server's page is shown as it is; my own row stays and is highlighted
    test("shows the server's page with me, highlighted, and the server's total", () => {
        renderList()
        expect(names()).toEqual(['ana', 'bob', 'cy'])
        const [mine, other] = rows()
        expect(mine.querySelector('.ui-row')).toHaveClass('ui-row--highlight')
        expect(within(mine).getByText('You')).toBeInTheDocument()
        expect(other.querySelector('.ui-row')).not.toHaveClass('ui-row--highlight')
        expect(screen.getByText('41 users found')).toBeInTheDocument()
        expect(useUsersPage).toHaveBeenCalledWith(0, '')
    })

    test('typing searches on the server after a pause', async () => {
        renderList()
        await userEvent.setup().type(screen.getByPlaceholderText('Search users by username...'), 'bo')
        await waitFor(() => expect(useUsersPage).toHaveBeenLastCalledWith(0, 'bo'))
    })

    test('Next asks the server for the next page', async () => {
        renderList()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Next' }))
        expect(useUsersPage).toHaveBeenLastCalledWith(1, '')
        expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
    })

    test('the page stays where it is while the search term is unchanged', () => {
        vi.useFakeTimers()
        try {
            renderList()
            fireEvent.click(screen.getByRole('button', { name: 'Next' }))
            act(() => { vi.advanceTimersByTime(1000) }) // well past the search pause
            expect(useUsersPage).toHaveBeenLastCalledWith(1, '')
            expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
        } finally {
            vi.useRealTimers()
        }
    })

    test('a new search term starts again from the first page', async () => {
        renderList()
        const user = userEvent.setup()
        await user.click(screen.getByRole('button', { name: 'Next' }))
        expect(useUsersPage).toHaveBeenLastCalledWith(1, '')
        await user.type(screen.getByPlaceholderText('Search users by username...'), 'bo')
        await waitFor(() => expect(useUsersPage).toHaveBeenLastCalledWith(0, 'bo'))
    })

    test('a double-click on Next while that page loads asks for it once and waits', async () => {
        // useApi keeps showing the previous page (number 1) while page index 2 loads
        vi.mocked(useUsersPage).mockImplementation((page: number) => ({
            data: { content: [ana, bob, cy], totalElements: 41, totalPages: 3, number: Math.min(page, 1), size: 20 },
            isLoading: page > 1, error: null, refetch: vi.fn(),
        }) as never)
        renderList()
        const user = userEvent.setup()
        await user.click(screen.getByRole('button', { name: 'Next' }))
        expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
        await user.dblClick(screen.getByRole('button', { name: 'Next' }))
        expect(useUsersPage).toHaveBeenLastCalledWith(2, '')
        expect(useUsersPage).not.toHaveBeenCalledWith(3, '')
        expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    })

    test("Previous and Next step from the server's page number", async () => {
        // the page on screen is the server's (a clamp, or an answer that arrived late)
        vi.mocked(useUsersPage).mockReturnValue({
            data: { content: [ana, bob, cy], totalElements: 41, totalPages: 3, number: 1, size: 20 },
            isLoading: false, error: null, refetch: vi.fn(),
        } as never)
        renderList()
        const user = userEvent.setup()
        await user.click(screen.getByRole('button', { name: 'Next' }))
        expect(useUsersPage).toHaveBeenLastCalledWith(2, '')
        await user.click(screen.getByRole('button', { name: 'Previous' }))
        expect(useUsersPage).toHaveBeenLastCalledWith(0, '')
    })

    // Guard for the dispatch ruling: an error is shown, never an empty or stale list.
    test("a failed request shows the server's message instead of the list", () => {
        vi.mocked(useUsersPage).mockReturnValue({
            // useApi keeps the previous page's data when a request fails
            data: { content: [ana, bob, cy], totalElements: 41, totalPages: 3, number: 0, size: 20 },
            isLoading: false,
            error: new ApiError({ message: 'Search text may not contain a NUL character', status: 400 }),
            refetch: vi.fn(),
        } as never)
        renderList()
        expect(screen.getByText('Search text may not contain a NUL character')).toBeInTheDocument()
        expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    })
})

describe('UserList is a leaderboard (spec §4.12; D-28, O-3)', () => {
    test('ranks #(page·20 + i + 1) the players with games; accounts without a game follow, unnumbered, as Unranked', () => {
        vi.mocked(useUsersPage).mockReturnValue({
            data: { content: [cy, ana, dee], totalElements: 23, totalPages: 2, number: 1, size: 20 },
            isLoading: false, error: null, refetch: vi.fn(),
        } as never)
        renderList()
        const [first, second, third] = rows()
        expect(first).toHaveTextContent('#21')
        expect(second).toHaveTextContent('#22')
        expect(within(third).getByText('Unranked')).toBeInTheDocument()
        expect(third).not.toHaveTextContent('#')
        expect(within(first).queryByText('Unranked')).not.toBeInTheDocument()
        expect(first).toHaveTextContent('1400')
        expect(first).toHaveTextContent('30 games · Level 4')
    })

    test('with a search term the ranks go; Unranked stays', async () => {
        vi.mocked(useUsersPage).mockImplementation(() => ({
            data: { content: [cy, dee], totalElements: 2, totalPages: 1, number: 0, size: 20 },
            isLoading: false, error: null, refetch: vi.fn(),
        }) as never)
        renderList()
        expect(rows()[0]).toHaveTextContent('#1')
        await userEvent.setup().type(screen.getByPlaceholderText('Search users by username...'), 'e')
        await waitFor(() => expect(useUsersPage).toHaveBeenLastCalledWith(0, 'e'))
        await waitFor(() => expect(rows()[0]).not.toHaveTextContent('#'))
        expect(within(rows()[1]).getByText('Unranked')).toBeInTheDocument()
    })

    test('the Name, ELO and Level re-sort buttons are gone, and the rows are drawn on the tokens', () => {
        const { container } = renderList()
        for (const name of ['Name', 'ELO', 'Level']) {
            expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
        }
        expect(container.innerHTML).not.toMatch(RAW_PALETTE)
    })

    test("no player matches the term: it says so, and Clear Search lists everyone again", async () => {
        vi.mocked(useUsersPage).mockImplementation((page: number, q: string) => ({
            data: { content: q === 'zz' ? [] : [ana, bob, cy], totalElements: q === 'zz' ? 0 : 3, totalPages: 1, number: page, size: 20 },
            isLoading: false, error: null, refetch: vi.fn(),
        }) as never)
        renderList()
        const user = userEvent.setup()
        await user.type(screen.getByPlaceholderText('Search users by username...'), 'zz')
        expect(await screen.findByText("No players match 'zz'")).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Clear Search' }))
        expect(screen.getByPlaceholderText('Search users by username...')).toHaveValue('')
        await waitFor(() => expect(useUsersPage).toHaveBeenLastCalledWith(0, ''))
        expect(names()).toEqual(['ana', 'bob', 'cy'])
    })

    test("each name leads to the player's profile; friend actions on every row but mine", () => {
        renderList()
        const [mine, bobs] = rows()
        expect(within(bobs).getByRole('link', { name: 'bob' })).toHaveAttribute('href', '/profile/u2')
        expect(within(bobs).getByRole('button', { name: 'Add Friend' })).toBeInTheDocument()
        expect(within(mine).queryByRole('button', { name: 'Add Friend' })).not.toBeInTheDocument()
        expect(useFriends).toHaveBeenCalledWith('u1')
    })

    test('phones: compact rows with the rank, the name and the Elo, the friend action an icon button', () => {
        viewport(375, 812)
        renderList()
        const bobs = rows()[1]
        expect(bobs).toHaveTextContent('#2')
        expect(bobs).toHaveTextContent('1250')
        expect(bobs).not.toHaveTextContent('3 games')
        expect(within(bobs).getByRole('button', { name: 'Add Friend' })).toHaveAttribute('aria-label', 'Add Friend')
    })
})
