import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AccountSection } from './AccountSection'
import { userService } from '../../services/userService'
import { authService } from '../../services/authService'
import { ApiError } from '../../services/api'
import { useMe, ME_CHANGED } from '../../hooks/useUser'
import { setLang } from '../../i18n/lang'
import { CLIENT_ID, dropGoogleScripts, stubGoogle } from '../../test/googleStub'

vi.mock('../../hooks/useUser', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../hooks/useUser')>()),
    useMe: vi.fn(),
}))
vi.mock('../../services/userService', () => ({
    userService: {
        requestForget: vi.fn(), changePassword: vi.fn(), changeEmail: vi.fn(), resendEmailConfirmation: vi.fn(),
        connectGoogle: vi.fn(), disconnectGoogle: vi.fn(),
    },
}))
// "Set a password" (Google sign-in spec §5.2) is the forgot-password mail; the rest of the module stays real
vi.mock('../../services/authService', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../services/authService')>()
    return { ...actual, authService: { ...actual.authService, forgotPassword: vi.fn() } }
})

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

afterEach(() => {
    cleanup()
    dropGoogleScripts()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    setLang('en')
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

    test('an unconfirmed signup sees the day it goes, with the resend (spec §2.1)', () => {
        mockMe({ ...meBase, email: null, pendingEmail: 'new@example.com', emailVerified: false, verifyBy: '2026-11-06T10:00:00Z' })
        const { unmount } = renderAccount()
        expect(screen.getByTestId('verify-by')).toHaveTextContent('If no email address is confirmed by November 6, 2026, the account will be removed.')
        expect(screen.getByRole('button', { name: 'Resend confirmation email' })).toBeInTheDocument()
        unmount()

        mockMe({ ...meBase, email: null, pendingEmail: 'new@example.com', emailVerified: false })
        renderAccount()
        expect(screen.queryByTestId('verify-by')).not.toBeInTheDocument()
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

/** Connect Google opened, the password typed, and Google's answer in (Google sign-in spec §5.1). */
async function connectGoogle() {
    const user = userEvent.setup()
    const google = stubGoogle()
    await user.click(screen.getByRole('button', { name: 'Connect Google' }))
    await screen.findByTestId('google-button')
    await user.type(screen.getByLabelText('Current password'), 'long-enough-1')
    await google.answer()
}

describe('Account: Google sign-in (Google sign-in spec §5, A-4, A-8, A-14)', () => {
    test('with a client id, the Google block comes after the email and password rows and before the deletion request', () => {
        vi.stubEnv('VITE_GOOGLE_CLIENT_ID', CLIENT_ID)
        renderAccount()
        const account = screen.getByRole('region', { name: 'Account' })
        const heading = within(account).getByRole('heading', { level: 3, name: 'Google sign-in' })
        const following = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
        expect(following(screen.getByRole('button', { name: 'Change Password' }), heading)).toBe(true)
        expect(following(heading, screen.getByRole('button', { name: /request account deletion/i }))).toBe(true)
        // an older server's GET /user/me has neither field: not connected
        expect(screen.getByText('Google: not connected')).toBeInTheDocument()
    })

    test("the block follows GET /user/me's google and passwordless", () => {
        vi.stubEnv('VITE_GOOGLE_CLIENT_ID', CLIENT_ID)
        mockMe({ ...meBase, google: true, passwordless: false })
        const { unmount } = renderAccount()
        expect(screen.getByText('Google: connected')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Disconnect Google' })).toBeInTheDocument()
        unmount()
        mockMe({ ...meBase, google: true, passwordless: true })
        renderAccount()
        expect(screen.getByText('Google is your only way to sign in, so it stays connected until you set a password.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Disconnect Google' })).not.toBeInTheDocument()
    })

    test('no Google block without a client id, or while GET /user/me is not in', () => {
        renderAccount()
        expect(screen.queryByRole('heading', { name: 'Google sign-in' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Change Password' })).toBeInTheDocument()
        cleanup()
        vi.stubEnv('VITE_GOOGLE_CLIENT_ID', CLIENT_ID)
        mockMe(null)
        renderAccount()
        expect(screen.queryByRole('heading', { name: 'Google sign-in' })).not.toBeInTheDocument()
    })

    test('a connect refreshes me and tells the rest of the page, once', async () => {
        vi.stubEnv('VITE_GOOGLE_CLIENT_ID', CLIENT_ID)
        vi.mocked(userService.connectGoogle).mockResolvedValue(undefined)
        renderAccount()
        await connectGoogle()
        expect(userService.connectGoogle).toHaveBeenCalledTimes(1)
        await waitFor(() => expect(refetchMe).toHaveBeenCalledTimes(1))
        expect(meChanged).toHaveBeenCalledTimes(1)
    })

    test('a failed refresh after a connect is not an unhandled rejection', () => withFailingRefresh(async () => {
        vi.stubEnv('VITE_GOOGLE_CLIENT_ID', CLIENT_ID)
        vi.mocked(userService.connectGoogle).mockResolvedValue(undefined)
        renderAccount()
        await connectGoogle()
        expect(await screen.findByRole('status')).toHaveTextContent('Google is connected.')
        expect(meChanged).toHaveBeenCalledTimes(1)
    }))

    test('a disconnect refreshes me and tells the rest of the page, once', async () => {
        const user = userEvent.setup()
        vi.stubEnv('VITE_GOOGLE_CLIENT_ID', CLIENT_ID)
        vi.mocked(userService.disconnectGoogle).mockResolvedValue(undefined)
        mockMe({ ...meBase, google: true, passwordless: false })
        renderAccount()
        await user.click(screen.getByRole('button', { name: 'Disconnect Google' }))
        await user.click(screen.getByRole('button', { name: 'Disconnect' }))
        expect(userService.disconnectGoogle).toHaveBeenCalledTimes(1)
        await waitFor(() => expect(refetchMe).toHaveBeenCalledTimes(1))
        expect(meChanged).toHaveBeenCalledTimes(1)
    })
})

describe('Account: made with Google, no password yet (Google sign-in spec §5.2, §8, A-9 to A-11)', () => {
    const WHY = 'You sign in with Google, and your account has no password yet. Set a password first to change your email.'
    const SENT = 'A link to set your password is on its way to ana@gmail.com. It works for 15 minutes. Setting the password signs you out on every device, so sign in again afterwards.'
    const CONFIRM_FIRST = 'We send the link to set a password only to a confirmed address. First confirm ana@firma.hr with the link we sent to it, then set your password here.'
    // the owner's R1 (item 47, option A): the way on for an inbox its owner can't read, and the day the account goes
    const NO_ACCESS = 'No access to this address? Sign out and sign up with the form, using an address you can read.'
    // a Gmail signup: the address Google vouched for is confirmed
    const PASSWORDLESS = { ...meBase, email: 'ana@gmail.com', google: true, passwordless: true }
    // an unvouched signup: the address waits for its link, and the account goes if it never comes
    const PENDING = { ...meBase, email: null, pendingEmail: 'ana@firma.hr', emailVerified: false, verifyBy: '2026-11-20T10:00:00Z', google: true, passwordless: true }
    const setPassword = () => screen.getByRole('button', { name: 'Set a password' })

    test('in place of the email and password buttons: why, and one Set a password, with or without a client id', () => {
        mockMe(PASSWORDLESS)
        const { unmount } = renderAccount()
        expect(screen.queryByRole('button', { name: 'Change Email' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Add an email address' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Change Password' })).not.toBeInTheDocument()
        expect(screen.getByText(WHY)).toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: 'Set a password' })).toHaveLength(1)
        unmount()
        // A-9: the Google block says why it stays and leans on the same button
        vi.stubEnv('VITE_GOOGLE_CLIENT_ID', CLIENT_ID)
        renderAccount()
        expect(screen.getAllByRole('button', { name: 'Set a password' })).toHaveLength(1)
        expect(screen.getByText('Google is your only way to sign in, so it stays connected until you set a password.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Disconnect Google' })).not.toBeInTheDocument()
    })

    test('Set a password mails the reset link to the confirmed address and says so; it can go again', async () => {
        const user = userEvent.setup()
        vi.mocked(authService.forgotPassword).mockResolvedValue(undefined)
        mockMe(PASSWORDLESS)
        renderAccount()
        await user.click(setPassword())
        expect(authService.forgotPassword).toHaveBeenCalledTimes(1)
        expect(authService.forgotPassword).toHaveBeenCalledWith('ana@gmail.com')
        expect(await screen.findByRole('status')).toHaveTextContent(SENT)
        await user.click(setPassword())
        expect(authService.forgotPassword).toHaveBeenCalledTimes(2)
    })

    test('the answer takes focus, as the busy button lets it go: the sent line, a refusal line, and the sent line again (US-G11)', async () => {
        const user = userEvent.setup()
        vi.mocked(authService.forgotPassword)
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new ApiError({ status: 429, message: 'Too many requests, try again later', code: 'RATE_LIMITED' }))
            .mockResolvedValueOnce(undefined)
        mockMe(PASSWORDLESS)
        renderAccount()
        await user.click(setPassword())
        await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('status')))
        expect(document.activeElement).toHaveTextContent(SENT)
        await user.click(setPassword())
        await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('alert')))
        expect(document.activeElement).toHaveTextContent('Too many tries. Wait a little, then try again.')
        await user.click(setPassword())
        await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('status')))
        expect(document.activeElement).toHaveTextContent(SENT)
    })

    test('one link at a time', async () => {
        let done = () => {}
        vi.mocked(authService.forgotPassword).mockImplementation(() => new Promise<void>((resolve) => { done = resolve }))
        mockMe(PASSWORDLESS)
        renderAccount()
        // both clicks land before React draws the button busy
        const button = setPassword()
        act(() => {
            button.click()
            button.click()
        })
        expect(authService.forgotPassword).toHaveBeenCalledTimes(1)
        await act(async () => { done() })
        expect(await screen.findByRole('status')).toHaveTextContent(SENT)
    })

    test('a refused or failed send says why: 429 in one line, no answer, a 5xx', async () => {
        const user = userEvent.setup()
        vi.mocked(authService.forgotPassword)
            .mockRejectedValueOnce(new ApiError({ status: 429, message: 'Too many requests, try again later', code: 'RATE_LIMITED' }))
            .mockRejectedValueOnce(new ApiError({ status: 0, message: 'Failed to fetch' }))
            .mockRejectedValueOnce(new ApiError({ status: 503, message: 'Service Unavailable' }))
        mockMe(PASSWORDLESS)
        renderAccount()
        // a refusal is an alert, as Google's block's are
        await user.click(setPassword())
        expect(await screen.findByRole('alert')).toHaveTextContent('Too many tries. Wait a little, then try again.')
        // the owner's R1 (item 45): the refusal already says to wait, so no second line under it
        expect(screen.getByRole('alert').nextElementSibling).toBeNull()
        expect(screen.queryByText('Wait a while, then try again.')).not.toBeInTheDocument()
        await user.click(setPassword())
        expect(await screen.findByRole('alert')).toHaveTextContent('We could not send the email. Try again.')
        expect(screen.queryByText('Wait a while, then try again.')).not.toBeInTheDocument()
        await user.click(setPassword())
        await waitFor(() => expect(authService.forgotPassword).toHaveBeenCalledTimes(3))
        expect(screen.getByRole('alert')).toHaveTextContent('We could not send the email. Try again.')
        expect(screen.getByRole('alert')).not.toHaveTextContent('Service Unavailable')
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    test("an address still waiting for its link: why the link can't go yet, the resend above, and no Set a password", async () => {
        const user = userEvent.setup()
        vi.mocked(userService.resendEmailConfirmation).mockResolvedValue(undefined)
        mockMe(PENDING)
        renderAccount()
        expect(screen.getByText(WHY)).toBeInTheDocument()
        expect(screen.getByText(CONFIRM_FIRST)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Set a password' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Change Email' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Change Password' })).not.toBeInTheDocument()
        expect(screen.getByTestId('pending-email')).toHaveTextContent('Waiting for confirmation: ana@firma.hr')
        expect(screen.getByTestId('verify-by')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Resend confirmation email' }))
        expect(userService.resendEmailConfirmation).toHaveBeenCalledTimes(1)
        expect(authService.forgotPassword).not.toHaveBeenCalled()
    })

    test('an address still waiting for its link also names the way out, with the day the account goes when it has one (R1 item 47)', () => {
        mockMe(PENDING)
        const { unmount } = renderAccount()
        // under the line that says why the link can't go yet
        const confirmFirst = screen.getByText(CONFIRM_FIRST)
        expect(confirmFirst.nextElementSibling).toBe(screen.getByTestId('no-access'))
        // the day as Settings writes it above (formatLongDate)
        expect(screen.getByTestId('no-access').textContent).toBe(`${NO_ACCESS} This account is removed on November 20, 2026.`)
        unmount()
        // no removal day (none sent, or one that can't be read): the way out alone
        for (const verifyBy of [undefined, 'not a day']) {
            mockMe({ ...PENDING, verifyBy })
            const view = renderAccount()
            expect(screen.getByTestId('no-access').textContent).toBe(NO_ACCESS)
            view.unmount()
        }
        // a confirmed address gets the link, so it has no such line
        mockMe(PASSWORDLESS)
        renderAccount()
        expect(screen.queryByTestId('no-access')).not.toBeInTheDocument()
    })

    test("the resend's \"Add or change\" opens the sheet with the same why, not the change-of-address form, and refreshes", async () => {
        const user = userEvent.setup()
        vi.mocked(userService.resendEmailConfirmation).mockRejectedValue(new ApiError({ status: 409, message: 'Nothing to confirm', code: 'NOTHING_TO_CONFIRM' }))
        mockMe(PENDING)
        renderAccount()
        await user.click(screen.getByRole('button', { name: 'Resend confirmation email' }))
        // the page's copy of GET /user/me may be stale (confirmed elsewhere): it is asked again
        await waitFor(() => expect(refetchMe).toHaveBeenCalledTimes(1))
        await user.click(await screen.findByRole('button', { name: 'Add or change your email address' }))
        // the owner's R1 (item 46): titled for what it offers, not as a change of address
        const sheet = await screen.findByRole('dialog', { name: 'Set a password' })
        expect(within(sheet).getByRole('heading', { level: 2 })).toHaveTextContent(/^Set a password$/)
        expect(within(sheet).getByText(WHY)).toBeInTheDocument()
        expect(within(sheet).getByText(CONFIRM_FIRST)).toBeInTheDocument()
        expect(within(sheet).getByTestId('no-access')).toHaveTextContent(NO_ACCESS)
        expect(within(sheet).queryByLabelText('New email address')).not.toBeInTheDocument()
        expect(within(sheet).queryByLabelText('Current password')).not.toBeInTheDocument()
        // no form, so no Cancel: the sheet's own Close
        await user.click(within(sheet).getByRole('button', { name: 'Close' }))
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    test('a password account still gets no refresh from the resend (unchanged)', async () => {
        const user = userEvent.setup()
        vi.mocked(userService.resendEmailConfirmation).mockRejectedValue(new ApiError({ status: 409, message: 'Nothing to confirm', code: 'NOTHING_TO_CONFIRM' }))
        mockMe({ ...meBase, emailVerified: false })
        renderAccount()
        await user.click(screen.getByRole('button', { name: 'Resend confirmation email' }))
        expect(await screen.findByRole('button', { name: 'Add or change your email address' })).toBeInTheDocument()
        expect(refetchMe).not.toHaveBeenCalled()
    })

    test('in Croatian', () => {
        setLang('hr')
        mockMe(PASSWORDLESS)
        renderAccount()
        expect(screen.getByText('Prijavljuješ se putem Googlea, a tvoj račun još nema lozinku. Najprije postavi lozinku pa ćeš moći promijeniti e-adresu.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Postavi lozinku' })).toBeInTheDocument()
    })

    test('in Croatian: the way out for an address still waiting, with and without the day (R1 item 47)', () => {
        setLang('hr')
        const way = 'Nemaš pristup ovoj adresi? Odjavi se i registriraj putem obrasca, s e-adresom kojoj imaš pristup.'
        mockMe(PENDING)
        const { unmount } = renderAccount()
        // the day's own dot ends the sentence
        expect(screen.getByTestId('no-access').textContent).toBe(`${way} Ovaj račun brišemo 20. studenoga 2026.`)
        unmount()
        mockMe({ ...PENDING, verifyBy: undefined })
        renderAccount()
        expect(screen.getByTestId('no-access').textContent).toBe(way)
    })
})
