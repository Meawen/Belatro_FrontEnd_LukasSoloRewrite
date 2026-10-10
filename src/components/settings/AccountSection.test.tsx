import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AccountSection } from './AccountSection'
import { userService } from '../../services/userService'
import { ApiError } from '../../services/api'
import { useMe, ME_CHANGED } from '../../hooks/useUser'

vi.mock('../../hooks/useUser', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../hooks/useUser')>()),
    useMe: vi.fn(),
}))
vi.mock('../../services/userService', () => ({
    userService: { requestForget: vi.fn(), changePassword: vi.fn(), changeEmail: vi.fn(), resendEmailConfirmation: vi.fn() },
}))

const meBase = { id: 'u1', username: 'ana', email: 'ana@example.com', pendingEmail: null, emailVerified: true, roles: null, deletionRequested: false }
const refetchMe = vi.fn()
const meChanged = vi.fn()

function mockMe(me: Record<string, unknown> | null, refetch: () => Promise<unknown> = refetchMe) {
    vi.mocked(useMe).mockReturnValue({ data: me, isLoading: false, error: null, refetch } as never)
}

function renderAccount() {
    return render(<AccountSection />, { wrapper: MemoryRouter })
}

beforeEach(() => {
    window.removeEventListener(ME_CHANGED, meChanged)
    window.addEventListener(ME_CHANGED, meChanged)
    vi.clearAllMocks()
    // useApi's refetch returns a promise (and rethrows a failed GET /user/me)
    refetchMe.mockResolvedValue(undefined)
    mockMe(meBase)
})

// A failed GET /user/me after a write that succeeded must not become an unhandled rejection.
// The refetch is a plain function, not vi.fn(): a vitest mock handles the promises it returns.
async function withFailingRefresh(run: () => Promise<void>) {
    let refreshes = 0
    const refetch = () => {
        refreshes += 1
        return Promise.reject(new ApiError({ status: 503, message: 'Service temporarily unavailable' }))
    }
    mockMe(meBase, refetch)
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

async function changePassword() {
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Change Password' }))
    await user.type(screen.getByLabelText('Current Password'), 'long-enough-1')
    await user.type(screen.getByLabelText('New Password'), 'long-enough-2')
    await user.type(screen.getByLabelText('Confirm New Password'), 'long-enough-2')
    const form = screen.getByLabelText('Current Password').closest('form') as HTMLFormElement
    await user.click(within(form).getByRole('button', { name: 'Change Password' }))
}

describe('Account: the deletion request (moved from UserProfile)', () => {
    test('request goes through a confirm step, calls the service, refreshes me', async () => {
        const user = userEvent.setup()
        vi.mocked(userService.requestForget).mockResolvedValue(undefined)
        renderAccount()
        await user.click(screen.getByRole('button', { name: /request account deletion/i }))
        expect(userService.requestForget).not.toHaveBeenCalled()
        await user.click(screen.getByRole('button', { name: /confirm request/i }))
        expect(userService.requestForget).toHaveBeenCalledTimes(1)
        await waitFor(() => expect(refetchMe).toHaveBeenCalled())
    })

    test('a failed refresh after the request is not an unhandled rejection', () => withFailingRefresh(async () => {
        const user = userEvent.setup()
        vi.mocked(userService.requestForget).mockResolvedValue(undefined)
        renderAccount()
        await user.click(screen.getByRole('button', { name: /request account deletion/i }))
        await user.click(screen.getByRole('button', { name: /confirm request/i }))
        expect(userService.requestForget).toHaveBeenCalledTimes(1)
    }))

    test('an already-flagged account shows the requested state instead of the button', () => {
        mockMe({ ...meBase, deletionRequested: true })
        renderAccount()
        expect(screen.getByText(/deletion requested/i)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /request account deletion/i })).not.toBeInTheDocument()
    })

    test('a failed request shows the error and keeps the confirm step', async () => {
        const user = userEvent.setup()
        // what apiClient throws when fetch itself fails (Chrome: server unreachable)
        vi.mocked(userService.requestForget).mockRejectedValue(new ApiError({ message: 'Failed to fetch', status: 0 }))
        renderAccount()
        await user.click(screen.getByRole('button', { name: /request account deletion/i }))
        await user.click(screen.getByRole('button', { name: /confirm request/i }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch')
        expect(screen.getByRole('button', { name: /confirm request/i })).toBeInTheDocument()
        expect(refetchMe).not.toHaveBeenCalled()
    })

    // R-40
    test('the confirmation says the account and its data go within 30 days', async () => {
        renderAccount()
        await userEvent.setup().click(screen.getByRole('button', { name: /request account deletion/i }))
        expect(screen.getByText(/We delete your account/)).toHaveTextContent('We delete your account and its data within 30 days of your request.')
    })
})

describe('Account: change of password (moved from UserProfile)', () => {
    test('a changed password refreshes me and tells the banner (it cancels a pending address)', async () => {
        vi.mocked(userService.changePassword).mockResolvedValue(undefined)
        renderAccount()
        await changePassword()
        expect(userService.changePassword).toHaveBeenCalledTimes(1)
        await waitFor(() => expect(refetchMe).toHaveBeenCalled())
        expect(meChanged).toHaveBeenCalledTimes(1)
    })

    test('a failed refresh after the change is not an unhandled rejection', () => withFailingRefresh(async () => {
        vi.mocked(userService.changePassword).mockResolvedValue(undefined)
        renderAccount()
        await changePassword()
        await waitFor(() => expect(meChanged).toHaveBeenCalledTimes(1))
    }))
})

describe('Account: change of email (moved from UserProfile)', () => {
    test('a sent change says where the link may go, without promising it, and refreshes me', async () => {
        const user = userEvent.setup()
        vi.mocked(userService.changeEmail).mockResolvedValue(undefined)
        renderAccount()
        await user.click(screen.getByRole('button', { name: 'Change Email' }))
        await user.type(screen.getByLabelText('New email address'), 'new@example.com')
        await user.type(screen.getByLabelText('Current password'), 'long-enough-1')
        await user.click(screen.getByRole('button', { name: 'Send confirmation link' }))
        expect(userService.changeEmail).toHaveBeenCalledWith({ newEmail: 'new@example.com', currentPassword: 'long-enough-1' })
        expect(await screen.findByRole('status')).toHaveTextContent(
            'If this address can be used, a confirmation link is on its way to new@example.com. Check your inbox (and spam).')
        // the sheet closes; its content unmounts after the exit animation
        await waitFor(() => expect(screen.queryByLabelText('New email address')).not.toBeInTheDocument())
        expect(refetchMe).toHaveBeenCalled()
        // the banner above has its own copy of /user/me
        expect(meChanged).toHaveBeenCalledTimes(1)
    })

    test('a failed refresh after the change is not an unhandled rejection', () => withFailingRefresh(async () => {
        const user = userEvent.setup()
        vi.mocked(userService.changeEmail).mockResolvedValue(undefined)
        renderAccount()
        await user.click(screen.getByRole('button', { name: 'Change Email' }))
        await user.type(screen.getByLabelText('New email address'), 'new@example.com')
        await user.type(screen.getByLabelText('Current password'), 'long-enough-1')
        await user.click(screen.getByRole('button', { name: 'Send confirmation link' }))
        expect(await screen.findByRole('status')).toHaveTextContent('a confirmation link is on its way to new@example.com')
        expect(meChanged).toHaveBeenCalledTimes(1)
    }))

    test('an account without any address is offered to add one', async () => {
        const user = userEvent.setup()
        mockMe({ ...meBase, email: null, emailVerified: false })
        vi.mocked(userService.changeEmail).mockResolvedValue(undefined)
        renderAccount()
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
        mockMe({ ...meBase, email: 'Ana@Example.com', emailVerified: false })
        vi.mocked(userService.resendEmailConfirmation).mockRejectedValue(new ApiError({ status: 409, message: 'Nothing to confirm' }))
        vi.mocked(userService.changeEmail).mockResolvedValue(undefined)
        renderAccount()
        await user.click(screen.getByRole('button', { name: 'Resend confirmation email' }))
        expect(await screen.findByText('Nothing to confirm')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Resend confirmation email' })).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Add or change your email address' }))
        await user.type(screen.getByLabelText('New email address'), 'ana@example.com')
        await user.type(screen.getByLabelText('Current password'), 'long-enough-1')
        // what the refreshed /user/me returns once the change is accepted
        mockMe({ ...meBase, email: 'Ana@Example.com', pendingEmail: 'ana@example.com', emailVerified: false })
        await user.click(screen.getByRole('button', { name: 'Send confirmation link' }))

        expect(await screen.findByTestId('pending-email')).toHaveTextContent('Waiting for confirmation: ana@example.com')
        expect(screen.queryByText('Nothing to confirm')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Resend confirmation email' })).toBeInTheDocument()
    })
})

describe('Account: the address (moved from ProfileStats)', () => {
    test('shows the address from /user/me, in the section Settings links point to', () => {
        renderAccount()
        const account = screen.getByRole('region', { name: 'Account' })
        expect(account).toHaveAttribute('id', 'account')
        expect(within(account).getByText('Email')).toBeInTheDocument()
        expect(within(account).getByText('ana@example.com')).toBeInTheDocument()
    })

    test('a pending address waits for confirmation and offers the resend action', () => {
        mockMe({ ...meBase, pendingEmail: 'new@example.com' })
        renderAccount()
        expect(screen.getByTestId('pending-email')).toHaveTextContent('Waiting for confirmation: new@example.com')
        expect(screen.getByRole('button', { name: 'Resend confirmation email' })).toBeInTheDocument()
    })

    test('a legacy unconfirmed address is marked and can be confirmed', () => {
        mockMe({ ...meBase, emailVerified: false })
        renderAccount()
        expect(screen.getByText('(not confirmed)')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Resend confirmation email' })).toBeInTheDocument()
    })

    test('a confirmed address with nothing pending offers no resend', () => {
        renderAccount()
        expect(screen.queryByRole('button', { name: 'Resend confirmation email' })).not.toBeInTheDocument()
    })

    test('an account without any address offers no resend', () => {
        mockMe({ ...meBase, email: null, emailVerified: false })
        renderAccount()
        expect(screen.getByText('Not set')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Resend confirmation email' })).not.toBeInTheDocument()
    })
})
