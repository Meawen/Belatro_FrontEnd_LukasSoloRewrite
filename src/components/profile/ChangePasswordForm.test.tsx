import { describe, test, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChangePasswordForm } from './ChangePasswordForm'
import { userService } from '../../services/userService'
import { ApiError } from '../../services/api'

vi.mock('../../services/userService', () => ({
    userService: { changePassword: vi.fn() },
}))
const changePassword = vi.mocked(userService.changePassword)

function setup() {
    const onSuccess = vi.fn()
    const onCancel = vi.fn()
    render(<ChangePasswordForm onSuccess={onSuccess} onCancel={onCancel} />)
    return { onSuccess, onCancel }
}

beforeEach(() => vi.clearAllMocks())

describe('ChangePasswordForm', () => {
    test('validates required fields, length and confirmation', async () => {
        const user = userEvent.setup()
        const { onSuccess } = setup()
        await user.click(screen.getByRole('button', { name: /change password/i }))
        expect(screen.getByText('Current password is required')).toBeInTheDocument()
        expect(screen.getByText('New password is required')).toBeInTheDocument()

        await user.type(screen.getByLabelText(/current password/i), 'old-secret')
        await user.type(screen.getByLabelText(/^new password/i), 'short')
        await user.click(screen.getByRole('button', { name: /change password/i }))
        expect(screen.getByText('Password must be at least 8 characters and at most 72 bytes')).toBeInTheDocument()

        await user.type(screen.getByLabelText(/^new password/i), '-enough')
        await user.type(screen.getByLabelText(/confirm new password/i), 'different')
        await user.click(screen.getByRole('button', { name: /change password/i }))
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument()

        expect(changePassword).not.toHaveBeenCalled()
        expect(onSuccess).not.toHaveBeenCalled()
    })

    test('submits current and new password, then calls onSuccess', async () => {
        const user = userEvent.setup()
        changePassword.mockResolvedValue(undefined)
        const { onSuccess } = setup()
        await user.type(screen.getByLabelText(/current password/i), 'old-secret')
        await user.type(screen.getByLabelText(/^new password/i), 'new-secret')
        await user.type(screen.getByLabelText(/confirm new password/i), 'new-secret')
        await user.click(screen.getByRole('button', { name: /change password/i }))
        expect(changePassword).toHaveBeenCalledWith({ currentPassword: 'old-secret', newPassword: 'new-secret' })
        expect(onSuccess).toHaveBeenCalled()
    })

    // A second request would go out on the token the first one rotated away (401 invalid_token)
    test('two submits that land before a re-render send one request', async () => {
        const user = userEvent.setup()
        changePassword.mockReturnValue(new Promise(() => {}))
        setup()
        await user.type(screen.getByLabelText(/current password/i), 'old-secret')
        await user.type(screen.getByLabelText(/^new password/i), 'new-secret')
        await user.type(screen.getByLabelText(/confirm new password/i), 'new-secret')
        const button = screen.getByRole('button', { name: /change password/i })
        // both clicks land before React re-renders the button as disabled
        act(() => {
            button.click()
            button.click()
        })
        expect(changePassword).toHaveBeenCalledTimes(1)
    })

    test('after a failed request the form can be sent again', async () => {
        const user = userEvent.setup()
        changePassword.mockRejectedValueOnce(new ApiError({ message: 'Current password is incorrect', status: 401 }))
        const { onSuccess } = setup()
        await user.type(screen.getByLabelText(/current password/i), 'wrong')
        await user.type(screen.getByLabelText(/^new password/i), 'new-secret')
        await user.type(screen.getByLabelText(/confirm new password/i), 'new-secret')
        await user.click(screen.getByRole('button', { name: /change password/i }))
        expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument()
        changePassword.mockResolvedValue(undefined)
        await user.click(screen.getByRole('button', { name: /change password/i }))
        expect(changePassword).toHaveBeenCalledTimes(2)
        expect(onSuccess).toHaveBeenCalled()
    })

    test('a 401 shows "Current password is incorrect" and does not close', async () => {
        const user = userEvent.setup()
        changePassword.mockRejectedValue(new ApiError({ message: 'Invalid current password', status: 401 }))
        const { onSuccess } = setup()
        await user.type(screen.getByLabelText(/current password/i), 'wrong')
        await user.type(screen.getByLabelText(/^new password/i), 'new-secret')
        await user.type(screen.getByLabelText(/confirm new password/i), 'new-secret')
        await user.click(screen.getByRole('button', { name: /change password/i }))
        expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument()
        expect(onSuccess).not.toHaveBeenCalled()
    })

    test('a 401 for a dead session shows the server message, not "incorrect password"', async () => {
        const user = userEvent.setup()
        changePassword.mockRejectedValue(new ApiError({ message: 'Session expired, please sign in again', status: 401, invalidToken: true }))
        setup()
        await user.type(screen.getByLabelText(/current password/i), 'whatever-1')
        await user.type(screen.getByLabelText(/^new password/i), 'new-secret-1')
        await user.type(screen.getByLabelText(/confirm new password/i), 'new-secret-1')
        await user.click(screen.getByRole('button', { name: /change password/i }))
        expect(await screen.findByText('Session expired, please sign in again')).toBeInTheDocument()
        expect(screen.queryByText('Current password is incorrect')).not.toBeInTheDocument()
    })
})
