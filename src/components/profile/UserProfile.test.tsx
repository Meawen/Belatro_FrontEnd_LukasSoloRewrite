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
    userService: { requestForget: vi.fn(), changePassword: vi.fn(), changeEmail: vi.fn(), resendEmailConfirmation: vi.fn() },
}))

const player = { id: 'u1', username: 'ana', eloRating: 1450, level: 3, gamesPlayed: 42 }
const meBase = { id: 'u1', username: 'ana', email: 'ana@example.com', pendingEmail: null, emailVerified: true, roles: null, deletionRequested: false }
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

describe('UserProfile change of email', () => {
    test('a sent change says where the link may go, without promising it, and refreshes me', async () => {
        const user = userEvent.setup()
        vi.mocked(userService.changeEmail).mockResolvedValue(undefined)
        render(<UserProfile />)
        await user.click(screen.getByRole('button', { name: 'Change Email' }))
        await user.type(screen.getByLabelText('New email address'), 'new@example.com')
        await user.type(screen.getByLabelText('Current password'), 'long-enough-1')
        await user.click(screen.getByRole('button', { name: 'Send confirmation link' }))
        expect(userService.changeEmail).toHaveBeenCalledWith({ newEmail: 'new@example.com', currentPassword: 'long-enough-1' })
        expect(await screen.findByRole('status')).toHaveTextContent(
            'If this address can be used, a confirmation link is on its way to new@example.com. Check your inbox (and spam).')
        expect(screen.queryByLabelText('New email address')).not.toBeInTheDocument()
        expect(refetchMe).toHaveBeenCalled()
    })

    test('an account without any address is offered to add one', async () => {
        const user = userEvent.setup()
        vi.mocked(useMe).mockReturnValue({ data: { ...meBase, email: null, emailVerified: false }, isLoading: false, error: null, refetch: refetchMe } as never)
        vi.mocked(userService.changeEmail).mockResolvedValue(undefined)
        render(<UserProfile />)
        expect(screen.queryByRole('button', { name: 'Change Email' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Resend confirmation email' })).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Add an email address' }))
        expect(screen.getByRole('heading', { name: 'Add an email address' })).toBeInTheDocument()
        await user.type(screen.getByLabelText('New email address'), 'ana@example.com')
        await user.type(screen.getByLabelText('Current password'), 'long-enough-1')
        await user.click(screen.getByRole('button', { name: 'Send confirmation link' }))
        expect(userService.changeEmail).toHaveBeenCalledWith({ newEmail: 'ana@example.com', currentPassword: 'long-enough-1' })
    })

    test('nothing to confirm opens the change form, and a new pending address brings the resend back', async () => {
        const user = userEvent.setup()
        vi.mocked(useMe).mockReturnValue({ data: { ...meBase, email: 'Ana@Example.com', emailVerified: false }, isLoading: false, error: null, refetch: refetchMe } as never)
        vi.mocked(userService.resendEmailConfirmation).mockRejectedValue(new ApiError({ status: 409, message: 'Nothing to confirm' }))
        vi.mocked(userService.changeEmail).mockResolvedValue(undefined)
        render(<UserProfile />)
        await user.click(screen.getByRole('button', { name: 'Resend confirmation email' }))
        expect(await screen.findByText('Nothing to confirm')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Resend confirmation email' })).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Add or change your email address' }))
        await user.type(screen.getByLabelText('New email address'), 'ana@example.com')
        await user.type(screen.getByLabelText('Current password'), 'long-enough-1')
        // what the refreshed /user/me returns once the change is accepted
        vi.mocked(useMe).mockReturnValue({ data: { ...meBase, email: 'Ana@Example.com', pendingEmail: 'ana@example.com', emailVerified: false }, isLoading: false, error: null, refetch: refetchMe } as never)
        await user.click(screen.getByRole('button', { name: 'Send confirmation link' }))

        expect(await screen.findByTestId('pending-email')).toHaveTextContent('Waiting for confirmation: ana@example.com')
        expect(screen.queryByText('Nothing to confirm')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Resend confirmation email' })).toBeInTheDocument()
    })
})
