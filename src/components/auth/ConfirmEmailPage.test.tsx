import { StrictMode } from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, type InitialEntry } from 'react-router-dom'
import { ConfirmEmailPage } from './ConfirmEmailPage'
import { authService } from '../../services/authService'
import { ApiError } from '../../services/api'

vi.mock('../../services/authService', () => ({
    authService: { confirmEmail: vi.fn(), isAuthenticated: vi.fn(() => true) },
}))

/** Where the router is, and the state it carries. */
function Where() {
    const { pathname, state } = useLocation()
    return <p data-testid="where">{`${pathname} ${JSON.stringify(state)}`}</p>
}

// StrictMode as in development: it runs mount effects twice, and the link is single-use.
function renderAt(entry: InitialEntry) {
    render(
        <StrictMode>
            <MemoryRouter initialEntries={[entry]}>
                <Routes>
                    <Route path="/confirm-email" element={<ConfirmEmailPage />} />
                    <Route path="/login" element={<Where />} />
                </Routes>
            </MemoryRouter>
        </StrictMode>,
    )
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authService.isAuthenticated).mockReturnValue(true)
})

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
        expect(screen.getByText(/send a new link/)).toHaveTextContent('You can send a new link from Settings.')
        // X-11: e-mail management lives in Settings (spec §7.1)
        expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
    })

    test('an address taken in the meantime shows the conflict', async () => {
        vi.mocked(authService.confirmEmail).mockRejectedValue(new ApiError({ status: 409, message: 'That email address is already in use' }))
        renderAt('/confirm-email?token=tok-2')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm email address' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('That email address is already in use')
        expect(screen.getByRole('button', { name: 'Confirm email address' })).toBeDisabled()
        // a new link for the same address would fail the same way: offer a change of address
        expect(screen.getByText(/change your email address/)).toHaveTextContent('You can change your email address from Settings.')
        expect(screen.queryByText(/send a new link/)).not.toBeInTheDocument()
        // X-11: e-mail management lives in Settings (spec §7.1)
        expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
    })

    test('a rate-limited confirm shows the refusal and keeps the button disabled', async () => {
        vi.mocked(authService.confirmEmail).mockRejectedValue(new ApiError({ status: 429, message: 'Too many requests, try again later' }))
        renderAt('/confirm-email?token=tok-3')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm email address' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests, try again later')
        expect(screen.getByRole('button', { name: 'Confirm email address' })).toBeDisabled()
        // the link is not spent: waiting is the remedy, not a new link
        expect(screen.getByText('Reload this page later to try again.')).toBeInTheDocument()
        expect(screen.queryByText(/send a new link/)).not.toBeInTheDocument()
    })

    test.each([
        [0, 'Failed to fetch'],
        [500, 'Internal Server Error'],
    ])('a failure with no usable answer (status %i) offers a reload and a new link', async (status, raw) => {
        vi.mocked(authService.confirmEmail).mockRejectedValue(new ApiError({ status, message: raw }))
        renderAt('/confirm-email?token=tok-4')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm email address' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('We could not confirm your email address.')
        expect(screen.queryByText(raw)).not.toBeInTheDocument()
        // the link may be spent (a 5xx, or a success whose answer was lost): never post it again from here
        expect(screen.getByRole('button', { name: 'Confirm email address' })).toBeDisabled()
        expect(screen.getByText('Reload this page to try again.')).toBeInTheDocument()
        expect(screen.getByText(/send a new link/)).toBeInTheDocument()
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

describe('ConfirmEmailPage on the auth frame (spec §4.3)', () => {
    test('sits in the auth frame with its title as the page heading', () => {
        renderAt('/confirm-email?token=tok-1')
        expect(screen.getByText('Belot for four, online.')).toBeInTheDocument()
        expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Confirm your email address'])
    })
})

describe('ConfirmEmailPage and the return path (spec §4.1)', () => {
    test.each([
        ['/lobby/abc', '/lobby/abc'],
        ['//evil.example', '/dashboard'],
    ])('signed in, Continue after a from of %s goes to %s', async (from, href) => {
        vi.mocked(authService.confirmEmail).mockResolvedValue(undefined)
        renderAt({ pathname: '/confirm-email', search: '?token=tok-1', state: { from } })
        await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm email address' }))
        expect(await screen.findByRole('link', { name: 'Continue' })).toHaveAttribute('href', href)
    })

    test('signed out, Continue goes to sign-in and hands it the return path', async () => {
        vi.mocked(authService.isAuthenticated).mockReturnValue(false)
        vi.mocked(authService.confirmEmail).mockResolvedValue(undefined)
        renderAt({ pathname: '/confirm-email', search: '?token=tok-1', state: { from: '/lobby/abc' } })
        const user = userEvent.setup()
        await user.click(screen.getByRole('button', { name: 'Confirm email address' }))
        await user.click(await screen.findByRole('link', { name: 'Continue' }))
        expect(screen.getByTestId('where')).toHaveTextContent('/login {"from":"/lobby/abc"}')
    })
})
