import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserProfile } from './UserProfile'
import { userService } from '../../services/userService'
import { ApiError } from '../../services/api'
import { useUser, useMe } from '../../hooks/useUser'

vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'u1', username: 'ana' }, isAuthenticated: true, isLoading: false }),
}))
vi.mock('../../hooks/useUser', () => ({
    useUser: vi.fn(),
    useMe: vi.fn(),
}))
vi.mock('../../services/userService', () => ({
    userService: { requestForget: vi.fn(), changePassword: vi.fn() },
}))

const player = { id: 'u1', username: 'ana', eloRating: 1450, level: 3, gamesPlayed: 42 }
const meBase = { id: 'u1', username: 'ana', email: 'ana@example.com', roles: null, deletionRequested: false }
const refetchMe = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useUser).mockReturnValue({ user: player, isLoading: false, error: null, refetch: vi.fn() } as never)
    vi.mocked(useMe).mockReturnValue({ data: meBase, isLoading: false, error: null, refetch: refetchMe } as never)
})

describe('UserProfile deletion request', () => {
    test('request goes through a confirm step, calls the service, refreshes me', async () => {
        const user = userEvent.setup()
        vi.mocked(userService.requestForget).mockResolvedValue(undefined)
        render(<UserProfile />)
        await user.click(screen.getByRole('button', { name: /request account deletion/i }))
        expect(userService.requestForget).not.toHaveBeenCalled()
        await user.click(screen.getByRole('button', { name: /confirm request/i }))
        expect(userService.requestForget).toHaveBeenCalledTimes(1)
        await waitFor(() => expect(refetchMe).toHaveBeenCalled())
    })

    test('an already-flagged account shows the requested state instead of the button', () => {
        vi.mocked(useMe).mockReturnValue({ data: { ...meBase, deletionRequested: true }, isLoading: false, error: null, refetch: refetchMe } as never)
        render(<UserProfile />)
        expect(screen.getByText(/deletion requested/i)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /request account deletion/i })).not.toBeInTheDocument()
    })

    test("someone else's profile has no deletion section", () => {
        vi.mocked(useMe).mockReturnValue({ data: null, isLoading: false, error: null, refetch: refetchMe } as never)
        render(<UserProfile userId="u2" />)
        expect(useMe).toHaveBeenCalledWith(false)
        expect(screen.queryByRole('button', { name: /request account deletion/i })).not.toBeInTheDocument()
    })

    test('a failed request shows the error and keeps the confirm step', async () => {
        const user = userEvent.setup()
        // what apiClient throws when fetch itself fails (Chrome: server unreachable)
        vi.mocked(userService.requestForget).mockRejectedValue(new ApiError({ message: 'Failed to fetch', status: 0 }))
        render(<UserProfile />)
        await user.click(screen.getByRole('button', { name: /request account deletion/i }))
        await user.click(screen.getByRole('button', { name: /confirm request/i }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch')
        expect(screen.getByRole('button', { name: /confirm request/i })).toBeInTheDocument()
        expect(refetchMe).not.toHaveBeenCalled()
    })
})
