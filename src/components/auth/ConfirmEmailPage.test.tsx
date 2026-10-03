import { StrictMode } from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ConfirmEmailPage } from './ConfirmEmailPage'
import { authService } from '../../services/authService'
import { ApiError } from '../../services/api'

vi.mock('../../services/authService', () => ({
    authService: { confirmEmail: vi.fn(), isAuthenticated: vi.fn(() => true) },
}))

// StrictMode as in development: it runs mount effects twice, and the link is single-use.
function renderAt(url: string) {
    render(
        <StrictMode>
            <MemoryRouter initialEntries={[url]}>
                <Routes><Route path="/confirm-email" element={<ConfirmEmailPage />} /></Routes>
            </MemoryRouter>
        </StrictMode>,
    )
}

beforeEach(() => vi.clearAllMocks())

describe('ConfirmEmailPage', () => {
    test('confirms on click, not on load', async () => {
        vi.mocked(authService.confirmEmail).mockResolvedValue(undefined)
        renderAt('/confirm-email?token=tok-1')
        expect(authService.confirmEmail).not.toHaveBeenCalled()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm email address' }))
        expect(authService.confirmEmail).toHaveBeenCalledWith('tok-1')
        expect(await screen.findByText('Your email address is confirmed.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/dashboard')
    })

    test('two rapid clicks post the single-use link once', () => {
        vi.mocked(authService.confirmEmail).mockReturnValue(new Promise(() => {}))
        renderAt('/confirm-email?token=tok-1')
        const button = screen.getByRole('button', { name: 'Confirm email address' })
        // both clicks land before React re-renders the button as disabled
        act(() => {
            button.click()
            button.click()
        })
        expect(authService.confirmEmail).toHaveBeenCalledTimes(1)
    })

    test('a used or expired link shows the server message', async () => {
        vi.mocked(authService.confirmEmail).mockRejectedValue(new ApiError({ status: 400, message: 'This link is invalid or has expired' }))
        renderAt('/confirm-email?token=old')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm email address' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('This link is invalid or has expired')
        // the first answer is final: no second post of the same link
        expect(screen.getByRole('button', { name: 'Confirm email address' })).toBeDisabled()
        expect(screen.getByText(/send a new link/)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'your profile' })).toHaveAttribute('href', '/profile')
    })

    test('an address taken in the meantime shows the conflict', async () => {
        vi.mocked(authService.confirmEmail).mockRejectedValue(new ApiError({ status: 409, message: 'That email address is already in use' }))
        renderAt('/confirm-email?token=tok-2')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm email address' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('That email address is already in use')
        expect(screen.getByRole('button', { name: 'Confirm email address' })).toBeDisabled()
        // a new link for the same address would fail the same way: offer a change of address
        expect(screen.getByText(/change your email address/)).toBeInTheDocument()
        expect(screen.queryByText(/send a new link/)).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'your profile' })).toHaveAttribute('href', '/profile')
    })

    test('a rate-limited confirm shows the refusal and keeps the button disabled', async () => {
        vi.mocked(authService.confirmEmail).mockRejectedValue(new ApiError({ status: 429, message: 'Too many requests, try again later' }))
        renderAt('/confirm-email?token=tok-3')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm email address' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests, try again later')
        expect(screen.getByRole('button', { name: 'Confirm email address' })).toBeDisabled()
        // the link is not spent: waiting is the remedy, not a new link
        expect(screen.queryByText(/send a new link/)).not.toBeInTheDocument()
    })

    test('a link without a token offers nothing to click', () => {
        renderAt('/confirm-email')
        expect(screen.getByRole('alert')).toHaveTextContent('This link is invalid or has expired')
        expect(screen.queryByRole('button', { name: 'Confirm email address' })).not.toBeInTheDocument()
    })

    test('a blank token offers nothing to click', () => {
        renderAt('/confirm-email?token=%20%20')
        expect(screen.getByRole('alert')).toHaveTextContent('This link is invalid or has expired')
        expect(screen.queryByRole('button', { name: 'Confirm email address' })).not.toBeInTheDocument()
    })
})
