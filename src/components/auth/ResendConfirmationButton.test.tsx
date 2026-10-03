import { describe, test, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ResendConfirmationButton } from './ResendConfirmationButton'
import { userService } from '../../services/userService'
import { ApiError } from '../../services/api'

vi.mock('../../services/userService', () => ({ userService: { resendEmailConfirmation: vi.fn() } }))

beforeEach(() => vi.clearAllMocks())

async function clickResend() {
    await userEvent.setup().click(screen.getByRole('button', { name: 'Resend confirmation email' }))
}

describe('ResendConfirmationButton', () => {
    test('a sent link is reported without promising a mail', async () => {
        vi.mocked(userService.resendEmailConfirmation).mockResolvedValue(undefined)
        render(<ResendConfirmationButton />)
        await clickResend()
        expect(await screen.findByRole('status')).toHaveTextContent('If the address can still be confirmed, a new link is on its way.')
        expect(screen.getByRole('button', { name: 'Resend confirmation email' })).toBeEnabled()
    })

    test('nothing to confirm replaces the resend with the prompt to add or change the address', async () => {
        vi.mocked(userService.resendEmailConfirmation).mockRejectedValue(new ApiError({ status: 409, message: 'Nothing to confirm' }))
        const onChangeEmail = vi.fn()
        render(<ResendConfirmationButton onChangeEmail={onChangeEmail} />)
        await clickResend()
        expect(await screen.findByRole('status')).toHaveTextContent('Nothing to confirm')
        // never offer the same resend again: it would answer 409 again
        expect(screen.queryByRole('button', { name: 'Resend confirmation email' })).not.toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Add or change your email address' }))
        expect(onChangeEmail).toHaveBeenCalledTimes(1)
    })

    test('nothing to confirm, outside the profile, points to the profile', async () => {
        vi.mocked(userService.resendEmailConfirmation).mockRejectedValue(new ApiError({ status: 409, message: 'Nothing to confirm' }))
        render(<MemoryRouter><ResendConfirmationButton /></MemoryRouter>)
        await clickResend()
        expect(await screen.findByRole('link', { name: 'Add or change your email address' })).toHaveAttribute('href', '/profile')
        expect(screen.queryByRole('button', { name: 'Resend confirmation email' })).not.toBeInTheDocument()
    })

    test('too many requests shows the server message and says to wait', async () => {
        vi.mocked(userService.resendEmailConfirmation).mockRejectedValue(new ApiError({ status: 429, message: 'Too many requests, try again later' }))
        render(<ResendConfirmationButton />)
        await clickResend()
        expect(await screen.findByRole('status')).toHaveTextContent('Too many requests, try again later')
        expect(screen.getByText('Wait a while, then try again.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Resend confirmation email' })).toBeEnabled()
    })

    test('two rapid clicks send one request', () => {
        vi.mocked(userService.resendEmailConfirmation).mockReturnValue(new Promise(() => {}))
        render(<ResendConfirmationButton />)
        const button = screen.getByRole('button', { name: 'Resend confirmation email' })
        // both clicks land before React re-renders the button as disabled
        act(() => {
            button.click()
            button.click()
        })
        expect(userService.resendEmailConfirmation).toHaveBeenCalledTimes(1)
    })
})
