import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChangeEmailForm } from './ChangeEmailForm'
import { userService } from '../../services/userService'
import { ApiError } from '../../services/api'

vi.mock('../../services/userService', () => ({ userService: { changeEmail: vi.fn() } }))

function setup(currentEmail: string | null = 'ana@example.com') {
    const onSuccess = vi.fn()
    render(<ChangeEmailForm currentEmail={currentEmail} onSuccess={onSuccess} onCancel={vi.fn()} />)
    return { onSuccess }
}

async function submit(newEmail: string, currentPassword: string) {
    const user = userEvent.setup()
    if (newEmail) await user.type(screen.getByLabelText('New email address'), newEmail)
    if (currentPassword) await user.type(screen.getByLabelText('Current password'), currentPassword)
    await user.click(screen.getByRole('button', { name: 'Send confirmation link' }))
}

beforeEach(() => vi.clearAllMocks())

describe('ChangeEmailForm', () => {
    test('both fields are required and the address must look like one', async () => {
        setup()
        await submit('', '')
        expect(screen.getByText('New email address is required')).toBeInTheDocument()
        expect(screen.getByText('Current password is required')).toBeInTheDocument()
        await submit('nope', 'long-enough-1')
        expect(screen.getByText('Email is invalid')).toBeInTheDocument()
        expect(userService.changeEmail).not.toHaveBeenCalled()
    })

    test('the current address is refused before sending, whatever its case and spacing', async () => {
        setup()
        await submit(' ANA@example.com ', 'long-enough-1')
        expect(screen.getByText('That is already your email address')).toBeInTheDocument()
        expect(userService.changeEmail).not.toHaveBeenCalled()
    })

    test('a legacy mixed-case address can be changed to its normalised spelling', async () => {
        // the backend compares the normalised new address with the stored one as stored,
        // and a change to the correct spelling is the fix for such an account
        vi.mocked(userService.changeEmail).mockResolvedValue(undefined)
        const { onSuccess } = setup('Ana@Example.com')
        await submit('ana@example.com', 'long-enough-1')
        expect(userService.changeEmail).toHaveBeenCalledWith({ newEmail: 'ana@example.com', currentPassword: 'long-enough-1' })
        expect(onSuccess).toHaveBeenCalledWith('ana@example.com')
    })

    test('a valid change sends address and password and reports the new address', async () => {
        vi.mocked(userService.changeEmail).mockResolvedValue(undefined)
        const { onSuccess } = setup()
        await submit(' new@example.com ', 'long-enough-1')
        expect(userService.changeEmail).toHaveBeenCalledWith({ newEmail: 'new@example.com', currentPassword: 'long-enough-1' })
        expect(onSuccess).toHaveBeenCalledWith('new@example.com')
    })

    test('an account without an address can add one', async () => {
        vi.mocked(userService.changeEmail).mockResolvedValue(undefined)
        const { onSuccess } = setup(null)
        expect(screen.queryByText(/current address stays in use/)).not.toBeInTheDocument()
        await submit('ana@example.com', 'long-enough-1')
        expect(onSuccess).toHaveBeenCalledWith('ana@example.com')
    })

    test('the form does not promise a mail', () => {
        setup()
        expect(screen.getByText(/If the address can be used, we send a confirmation link to it\./)).toBeInTheDocument()
        expect(screen.getByText(/Your current address stays in use until you confirm\./)).toBeInTheDocument()
    })

    test('a wrong current password says so and keeps the form usable', async () => {
        vi.mocked(userService.changeEmail).mockRejectedValue(new ApiError({ status: 401, message: 'Current password is incorrect' }))
        const { onSuccess } = setup()
        await submit('new@example.com', 'wrong-pass-1')
        expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect')
        expect(screen.getByRole('button', { name: 'Send confirmation link' })).toBeEnabled()
        expect(screen.getByLabelText('New email address')).toBeEnabled()
        expect(onSuccess).not.toHaveBeenCalled()
    })

    test('a dead session shows the server message instead', async () => {
        vi.mocked(userService.changeEmail).mockRejectedValue(new ApiError({ status: 401, message: 'Session expired, please sign in again', invalidToken: true }))
        setup()
        await submit('new@example.com', 'long-enough-1')
        expect(await screen.findByRole('alert')).toHaveTextContent('Session expired, please sign in again')
    })

    test("the server's same-address refusal is shown", async () => {
        // the profile's copy of the address can be stale, e.g. a change confirmed in another tab
        vi.mocked(userService.changeEmail).mockRejectedValue(new ApiError({ status: 400, message: 'That is already your email address' }))
        setup()
        await submit('new@example.com', 'long-enough-1')
        expect(await screen.findByRole('alert')).toHaveTextContent('That is already your email address')
    })
})
