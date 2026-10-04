import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserList } from './UserList'
import { useUsersPage, useUser } from '../../hooks/useUser'
import { ApiError } from '../../services/api'

vi.mock('../../hooks/useUser', () => ({ useUsersPage: vi.fn(), useUser: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' }, isAuthenticated: true }) }))
vi.mock('./UserCard', () => ({
    UserCard: ({ user }: { user: { username: string } }) => <div data-testid="user-card">{user.username}</div>,
}))

const ana = { id: 'u1', username: 'ana', eloRating: 1300, level: 2, gamesPlayed: 10 }
const bob = { id: 'u2', username: 'bob', eloRating: 1250, level: 1, gamesPlayed: 3 }
const cy = { id: 'u3', username: 'cy', eloRating: 1400, level: 4, gamesPlayed: 30 }

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useUser).mockReturnValue({ user: ana, isLoading: false, error: null, refetch: vi.fn() } as never)
    vi.mocked(useUsersPage).mockImplementation((page: number) => ({
        data: { content: [ana, bob, cy], totalElements: 41, totalPages: 3, number: page, size: 20 },
        isLoading: false, error: null, refetch: vi.fn(),
    }) as never)
})

describe('UserList (server-side paging and search)', () => {
    test("shows the server's page without me, and the server's total", () => {
        render(<UserList />)
        expect(screen.getAllByTestId('user-card').map((el) => el.textContent)).toEqual(['bob', 'cy'])
        expect(screen.getByText('41 users found')).toBeInTheDocument()
        expect(useUsersPage).toHaveBeenCalledWith(0, '')
    })

    test('typing searches on the server after a pause', async () => {
        render(<UserList />)
        await userEvent.setup().type(screen.getByPlaceholderText('Search users by username...'), 'bo')
        await waitFor(() => expect(useUsersPage).toHaveBeenLastCalledWith(0, 'bo'))
    })

    test('Next asks the server for the next page', async () => {
        render(<UserList />)
        await userEvent.setup().click(screen.getByRole('button', { name: 'Next' }))
        expect(useUsersPage).toHaveBeenLastCalledWith(1, '')
        expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
    })

    test('the page stays where it is while the search term is unchanged', () => {
        vi.useFakeTimers()
        try {
            render(<UserList />)
            fireEvent.click(screen.getByRole('button', { name: 'Next' }))
            act(() => { vi.advanceTimersByTime(1000) }) // well past the search pause
            expect(useUsersPage).toHaveBeenLastCalledWith(1, '')
            expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
        } finally {
            vi.useRealTimers()
        }
    })

    test('a new search term starts again from the first page', async () => {
        render(<UserList />)
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
        render(<UserList />)
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
        render(<UserList />)
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
        render(<UserList />)
        expect(screen.getByText('Search text may not contain a NUL character')).toBeInTheDocument()
        expect(screen.queryAllByTestId('user-card')).toHaveLength(0)
    })
})
