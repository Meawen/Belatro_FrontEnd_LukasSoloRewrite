import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { UnverifiedEmailBanner } from './UnverifiedEmailBanner'
import { useMe } from '../../hooks/useUser'
import { userService } from '../../services/userService'
import { ApiError } from '../../services/api'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true }) }))
vi.mock('../../hooks/useUser', () => ({ useMe: vi.fn() }))
vi.mock('../../services/userService', () => ({ userService: { resendEmailConfirmation: vi.fn() } }))

const base = { id: 'u1', username: 'ana', email: null, pendingEmail: null, emailVerified: false, roles: null, deletionRequested: false }
const refetch = vi.fn()

function renderBanner(me: object | null) {
    vi.mocked(useMe).mockReturnValue({ data: me, refetch } as never)
    return render(<MemoryRouter><UnverifiedEmailBanner /></MemoryRouter>)
}

beforeEach(() => {
    vi.clearAllMocks()
    refetch.mockResolvedValue(undefined)
})

describe('UnverifiedEmailBanner', () => {
    test('a verified account sees nothing', () => {
        const { container } = renderBanner({ ...base, email: 'ana@example.com', emailVerified: true })
        expect(container).toBeEmptyDOMElement()
        expect(vi.mocked(useMe)).toHaveBeenCalledWith(true)
    })

    test('a pending address asks to check the inbox and offers a resend', () => {
        renderBanner({ ...base, pendingEmail: 'ana@example.com' })
        expect(screen.getByRole('region', { name: 'Email confirmation' })).toHaveTextContent('Check your inbox: confirm ana@example.com to play ranked.')
        expect(screen.getByRole('button', { name: 'Resend confirmation email' })).toBeInTheDocument()
    })

    test('a legacy unconfirmed address is named too', () => {
        renderBanner({ ...base, email: 'old@example.com' })
        expect(screen.getByRole('region', { name: 'Email confirmation' })).toHaveTextContent('confirm old@example.com to play ranked.')
    })

    test('an account without any address is sent to its profile', () => {
        renderBanner(base)
        expect(screen.getByText(/Add an email address to play ranked/)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Open your profile' })).toHaveAttribute('href', '/profile')
    })

    test('nothing to confirm stops asking to confirm the address and asks for a new one', async () => {
        vi.mocked(userService.resendEmailConfirmation).mockRejectedValue(new ApiError({ status: 409, message: 'Nothing to confirm' }))
        renderBanner({ ...base, email: 'Ana@Example.com' })
        await userEvent.setup().click(screen.getByRole('button', { name: 'Resend confirmation email' }))
        const banner = screen.getByRole('region', { name: 'Email confirmation' })
        expect(await screen.findByRole('link', { name: 'Add or change your email address' })).toHaveAttribute('href', '/profile')
        expect(banner).toHaveTextContent('Add or change your email address to play ranked.')
        expect(banner).not.toHaveTextContent('Check your inbox')
        expect(banner).not.toHaveTextContent('confirm Ana@Example.com')
        // the account may have been confirmed elsewhere since this page loaded
        expect(refetch).toHaveBeenCalledTimes(1)
    })

    test('a new pending address after nothing to confirm is asked for afresh', async () => {
        vi.mocked(userService.resendEmailConfirmation).mockRejectedValue(new ApiError({ status: 409, message: 'Nothing to confirm' }))
        const { rerender } = renderBanner({ ...base, email: 'Ana@Example.com' })
        await userEvent.setup().click(screen.getByRole('button', { name: 'Resend confirmation email' }))
        await screen.findByRole('link', { name: 'Add or change your email address' })
        vi.mocked(useMe).mockReturnValue({ data: { ...base, email: 'Ana@Example.com', pendingEmail: 'ana@example.com' }, refetch } as never)
        rerender(<MemoryRouter><UnverifiedEmailBanner /></MemoryRouter>)
        expect(screen.getByRole('region', { name: 'Email confirmation' })).toHaveTextContent('Check your inbox: confirm ana@example.com to play ranked.')
        expect(screen.getByRole('button', { name: 'Resend confirmation email' })).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'Add or change your email address' })).not.toBeInTheDocument()
    })
})
