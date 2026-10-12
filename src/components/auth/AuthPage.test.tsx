import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthPage } from './AuthPage'

vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ isAuthenticated: false, login: vi.fn(), isLoginLoading: false }),
}))

describe('AuthPage', () => {
    test('a tab whose session the server ended lands here and is told why', () => {
        render(<MemoryRouter initialEntries={['/login?reason=session-ended']}><AuthPage /></MemoryRouter>)
        expect(screen.getByRole('alert')).toHaveTextContent('Your session ended — please sign in again')
    })

    test('the sign-in page links the Rules, the Privacy notice, the Terms and the support address (R-40, R-41)', () => {
        render(<MemoryRouter initialEntries={['/login']}><AuthPage /></MemoryRouter>)
        expect(screen.getByRole('link', { name: 'Rules' })).toHaveAttribute('href', '/rules')
        expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
        expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
        expect(screen.getByRole('link', { name: 'Contact: support@stiglja.com' })).toHaveAttribute('href', 'mailto:support@stiglja.com')
    })

    test('a plain visit to the login page shows no such notice', () => {
        render(<MemoryRouter initialEntries={['/login']}><AuthPage /></MemoryRouter>)
        expect(screen.queryByText('Your session ended — please sign in again')).toBeNull()
    })
})
