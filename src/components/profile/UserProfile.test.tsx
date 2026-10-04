import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserProfile } from './UserProfile'
import { userService } from '../../services/userService'
import { ApiError } from '../../services/api'
import { useUser, useMe, ME_CHANGED } from '../../hooks/useUser'

vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'u1', username: 'ana' }, isAuthenticated: true, isLoading: false }),
}))
vi.mock('../../hooks/useUser', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../hooks/useUser')>()),
    useUser: vi.fn(),
    useMe: vi.fn(),
}))
vi.mock('../../services/userService', () => ({
    userService: { requestForget: vi.fn(), changePassword: vi.fn(), changeEmail: vi.fn(), resendEmailConfirmation: vi.fn() },
}))

const player = { id: 'u1', username: 'ana', eloRating: 1450, level: 3, gamesPlayed: 42 }
const meBase = { id: 'u1', username: 'ana', email: 'ana@example.com', pendingEmail: null, emailVerified: true, roles: null, deletionRequested: false }
const refetchMe = vi.fn()
const meChanged = vi.fn()

beforeEach(() => {
    window.removeEventListener(ME_CHANGED, meChanged)
    window.addEventListener(ME_CHANGED, meChanged)
    vi.clearAllMocks()
    // useApi's refetch returns a promise (and rethrows a failed GET /user/me)
    refetchMe.mockResolvedValue(undefined)
    vi.mocked(useUser).mockReturnValue({ user: player, isLoading: false, error: null, refetch: vi.fn() } as never)
    vi.mocked(useMe).mockReturnValue({ data: meBase, isLoading: false, error: null, refetch: refetchMe } as never)
})

// A failed GET /user/me after a write that succeeded must not become an unhandled rejection.
// The refetch is a plain function, not vi.fn(): a vitest mock handles the promises it returns.
async function withFailingRefresh(run: () => Promise<void>) {
    let refreshes = 0
    const refetch = () => {
        refreshes += 1
        return Promise.reject(new ApiError({ status: 503, message: 'Service temporarily unavailable' }))
    }
    vi.mocked(useMe).mockReturnValue({ data: meBase, isLoading: false, error: null, refetch } as never)
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
        await run()
        await waitFor(() => expect(refreshes).toBe(1))
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(unhandled).not.toHaveBeenCalled()
    } finally {
        process.off('unhandledRejection', unhandled)
    }
}

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

    test('a failed refresh after the request is not an unhandled rejection', () => withFailingRefresh(async () => {
        const user = userEvent.setup()
        vi.mocked(userService.requestForget).mockResolvedValue(undefined)
        render(<UserProfile />)
        await user.click(screen.getByRole('button', { name: /request account deletion/i }))
        await user.click(screen.getByRole('button', { name: /confirm request/i }))
        expect(userService.requestForget).toHaveBeenCalledTimes(1)
    }))

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

describe('UserProfile change of password', () => {
    test('a changed password refreshes me and tells the banner (it cancels a pending address)', async () => {
        const user = userEvent.setup()
        vi.mocked(userService.changePassword).mockResolvedValue(undefined)
        render(<UserProfile />)
        await user.click(screen.getByRole('button', { name: 'Change Password' }))
        await user.type(screen.getByLabelText('Current Password'), 'long-enough-1')
        await user.type(screen.getByLabelText('New Password'), 'long-enough-2')
        await user.type(screen.getByLabelText('Confirm New Password'), 'long-enough-2')
        const form = screen.getByLabelText('Current Password').closest('form') as HTMLFormElement
        await user.click(within(form).getByRole('button', { name: 'Change Password' }))
        expect(userService.changePassword).toHaveBeenCalledTimes(1)
        await waitFor(() => expect(refetchMe).toHaveBeenCalled())
        expect(meChanged).toHaveBeenCalledTimes(1)
    })
})

describe('UserProfile change of password, refresh failing', () => {
    test('a failed refresh after the change is not an unhandled rejection', () => withFailingRefresh(async () => {
        const user = userEvent.setup()
        vi.mocked(userService.changePassword).mockResolvedValue(undefined)
        render(<UserProfile />)
        await user.click(screen.getByRole('button', { name: 'Change Password' }))
        await user.type(screen.getByLabelText('Current Password'), 'long-enough-1')
        await user.type(screen.getByLabelText('New Password'), 'long-enough-2')
        await user.type(screen.getByLabelText('Confirm New Password'), 'long-enough-2')
        const form = screen.getByLabelText('Current Password').closest('form') as HTMLFormElement
        await user.click(within(form).getByRole('button', { name: 'Change Password' }))
        await waitFor(() => expect(meChanged).toHaveBeenCalledTimes(1))
    }))
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
        // the banner above has its own copy of /user/me
        expect(meChanged).toHaveBeenCalledTimes(1)
    })

    test('a failed refresh after the change is not an unhandled rejection', () => withFailingRefresh(async () => {
        const user = userEvent.setup()
        vi.mocked(userService.changeEmail).mockResolvedValue(undefined)
        render(<UserProfile />)
        await user.click(screen.getByRole('button', { name: 'Change Email' }))
        await user.type(screen.getByLabelText('New email address'), 'new@example.com')
        await user.type(screen.getByLabelText('Current password'), 'long-enough-1')
        await user.click(screen.getByRole('button', { name: 'Send confirmation link' }))
        expect(await screen.findByRole('status')).toHaveTextContent('a confirmation link is on its way to new@example.com')
        expect(meChanged).toHaveBeenCalledTimes(1)
    }))

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
