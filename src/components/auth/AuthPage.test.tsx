import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, type InitialEntry } from 'react-router-dom'
import { AuthPage } from './AuthPage'

vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ isAuthenticated: false, login: vi.fn(), isLoginLoading: false }),
}))

/** Where the router is, and the state it carries. */
function Where() {
    const { pathname, state } = useLocation()
    return <p data-testid="where">{`${pathname} ${JSON.stringify(state)}`}</p>
}

/** /login and /signup as the page modules wire them (src/pages/LoginPage.tsx, SignupPage.tsx). */
function renderAuth(entry: InitialEntry) {
    render(
        <MemoryRouter initialEntries={[entry]}>
            <Routes>
                <Route path="/login" element={<AuthPage initialMode="login" redirectTo="/dashboard" />} />
                <Route path="/signup" element={<AuthPage initialMode="signup" redirectTo="/dashboard" />} />
            </Routes>
            <Where />
        </MemoryRouter>,
    )
}

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

describe('AuthPage on the auth frame (spec §4.2, X-1)', () => {
    test('the emoji logo and "The Ultimate Card Game Experience" are gone; the panel title is the page heading', () => {
        render(<MemoryRouter initialEntries={['/login']}><AuthPage /></MemoryRouter>)
        expect(screen.queryByText('🃏')).toBeNull()
        expect(screen.queryByText('The Ultimate Card Game Experience')).toBeNull()
        expect(screen.getByText('Belot for four, online.')).toBeInTheDocument()
        expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Welcome Back'])
    })
})

describe('Sign in and sign up are two URLs (X-2)', () => {
    test('"Sign up" is a link to /signup, which shows the sign-up form and still carries the return path', async () => {
        renderAuth({ pathname: '/login', state: { from: '/lobby/abc' } })
        const link = screen.getByRole('link', { name: 'Sign up' })
        expect(link).toHaveAttribute('href', '/signup')
        await userEvent.setup().click(link)
        expect(screen.getByTestId('where')).toHaveTextContent('/signup {"from":"/lobby/abc"}')
        expect(screen.getByRole('heading', { name: 'Create Account' })).toBeInTheDocument()
    })
})
