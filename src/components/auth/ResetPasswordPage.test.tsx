import { StrictMode } from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ResetPasswordPage } from './ResetPasswordPage'
import { authService } from '../../services/authService'
import { ApiError } from '../../services/api'

vi.mock('../../services/authService', () => ({ authService: { resetPassword: vi.fn() } }))

// StrictMode as in development; the link is single-use.
function renderAt(url: string) {
    render(
        <StrictMode>
            <MemoryRouter initialEntries={[url]}>
                <Routes><Route path="/reset-password" element={<ResetPasswordPage />} /></Routes>
            </MemoryRouter>
        </StrictMode>,
    )
}

async function fill(newPassword: string, confirm = newPassword) {
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('New password'), newPassword)
    await user.type(screen.getByLabelText('Confirm new password'), confirm)
    return user
}

async function submit(newPassword: string, confirm = newPassword) {
    const user = await fill(newPassword, confirm)
    await user.click(screen.getByRole('button', { name: 'Reset password' }))
}

beforeEach(() => vi.clearAllMocks())

describe('ResetPasswordPage', () => {
    test('a too-short password gets the backend rule message', async () => {
        renderAt('/reset-password?token=tok-2')
        await submit('short12')
        expect(screen.getByText('Password must be at least 8 characters and at most 72 bytes')).toBeInTheDocument()
        expect(authService.resetPassword).not.toHaveBeenCalled()
    })

    test('the two fields must match', async () => {
        renderAt('/reset-password?token=tok-2')
        await submit('brand-new-pass', 'brand-new-pas')
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    })

    test('a valid reset sends token and password, then points to sign-in', async () => {
        vi.mocked(authService.resetPassword).mockResolvedValue(undefined)
        renderAt('/reset-password?token=tok-2')
        await submit('brand-new-pass')
        expect(authService.resetPassword).toHaveBeenCalledWith('tok-2', 'brand-new-pass')
        expect(await screen.findByText('Your password has been reset. Sign in with your new password.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
        expect(screen.queryByRole('button', { name: 'Reset password' })).not.toBeInTheDocument()
    })

    test('two rapid submits post the single-use link once', async () => {
        vi.mocked(authService.resetPassword).mockReturnValue(new Promise(() => {}))
        renderAt('/reset-password?token=tok-2')
        await fill('brand-new-pass')
        const button = screen.getByRole('button', { name: 'Reset password' })
        // both submits land before React re-renders the button as disabled
        act(() => {
            button.click()
            button.click()
        })
        expect(authService.resetPassword).toHaveBeenCalledTimes(1)
    })

    test('a used or expired link shows the server message', async () => {
        vi.mocked(authService.resetPassword).mockRejectedValue(new ApiError({ status: 400, message: 'This link is invalid or has expired' }))
        renderAt('/reset-password?token=old')
        await submit('brand-new-pass')
        expect(await screen.findByRole('alert')).toHaveTextContent('This link is invalid or has expired')
        // the first answer is final: no second post of the same link
        expect(screen.getByRole('button', { name: 'Reset password' })).toBeDisabled()
        expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password')
    })

    test('a password the server refuses keeps the link usable', async () => {
        // the 400 field map {"newPassword": "..."}: validation runs before the link is spent
        vi.mocked(authService.resetPassword).mockRejectedValue(
            new ApiError({ status: 400, message: 'Password must be at least 8 characters and at most 72 bytes' }))
        renderAt('/reset-password?token=tok-2')
        await submit('brand-new-pass')
        expect(await screen.findByText('Password must be at least 8 characters and at most 72 bytes')).toBeInTheDocument()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'Request a new link' })).not.toBeInTheDocument()
        const button = screen.getByRole('button', { name: 'Reset password' })
        expect(button).toBeEnabled()
        vi.mocked(authService.resetPassword).mockResolvedValue(undefined)
        await userEvent.setup().click(button)
        expect(authService.resetPassword).toHaveBeenCalledTimes(2)
        expect(await screen.findByText('Your password has been reset. Sign in with your new password.')).toBeInTheDocument()
    })

    test('a rate-limited reset waits instead of offering a new link', async () => {
        vi.mocked(authService.resetPassword).mockRejectedValue(new ApiError({ status: 429, message: 'Too many requests, try again later' }))
        renderAt('/reset-password?token=tok-3')
        await submit('brand-new-pass')
        expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests, try again later')
        expect(screen.getByRole('button', { name: 'Reset password' })).toBeDisabled()
        // the limiter runs before the link is spent: waiting is the remedy, not a new link
        expect(screen.getByText('Wait a while, then reload this page to try again.')).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'Request a new link' })).not.toBeInTheDocument()
    })

    test.each([
        [0, 'Failed to fetch'],
        [500, 'Internal Server Error'],
    ])('a failure with no usable answer (status %i) offers a new link', async (status, raw) => {
        vi.mocked(authService.resetPassword).mockRejectedValue(new ApiError({ status, message: raw }))
        renderAt('/reset-password?token=tok-4')
        await submit('brand-new-pass')
        expect(await screen.findByRole('alert')).toHaveTextContent('We could not reset your password.')
        expect(screen.queryByText(raw)).not.toBeInTheDocument()
        // the backend spends the link before the write, so a 5xx may have spent it
        expect(screen.getByRole('button', { name: 'Reset password' })).toBeDisabled()
        expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password')
        expect(screen.getByText(/if this keeps happening/)).toBeInTheDocument()
    })

    test('a link without a token offers a new one instead of a form', () => {
        renderAt('/reset-password')
        expect(screen.getByRole('alert')).toHaveTextContent('This link is invalid or has expired')
        expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password')
        expect(screen.queryByRole('button', { name: 'Reset password' })).not.toBeInTheDocument()
    })

    test('a blank token offers a new one instead of a form', () => {
        renderAt('/reset-password?token=%20%20')
        expect(screen.getByRole('alert')).toHaveTextContent('This link is invalid or has expired')
        expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password')
        expect(screen.queryByRole('button', { name: 'Reset password' })).not.toBeInTheDocument()
    })
})

describe('ResetPasswordPage on the auth frame (spec §4.3)', () => {
    test('sits in the auth frame with its title as the page heading and the footer links below', () => {
        renderAt('/reset-password?token=tok-2')
        expect(screen.getByText('Belot for four, online.')).toBeInTheDocument()
        expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Choose a new password'])
        expect(screen.getByRole('contentinfo')).toHaveTextContent('Contact: support@stiglja.com')
    })
})
