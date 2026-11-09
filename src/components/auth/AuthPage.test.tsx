import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, type InitialEntry } from 'react-router-dom'
import { AuthPage } from './AuthPage'
import { authService } from '../../services/authService'
import { ApiError } from '../../services/api'
import { setLang } from '../../i18n/lang'

vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ isAuthenticated: false, login: vi.fn(), isLoginLoading: false }),
}))
// /signup asks whether signup is open before it shows a form (spec §2.2); its request is betaService.test's
vi.mock('../../services/betaService', () => ({ betaService: { signupStatus: vi.fn(async () => ({ open: true })) } }))

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
    // review fix 1, Minor 3: on /login a reload does nothing, so the page says sign in, not the game connection's "reload" (R1-11)
    test('a tab whose session the server ended lands here and is told why: sign in again', () => {
        render(<MemoryRouter initialEntries={['/login?reason=session-ended']}><AuthPage /></MemoryRouter>)
        expect(screen.getByRole('alert')).toHaveTextContent(/^Your session ended\. Sign in again\.$/)
        expect(screen.queryByText(/Reload the page/)).toBeNull()
    })

    test('the same notice in Croatian', () => {
        setLang('hr')
        const { unmount } = render(<MemoryRouter initialEntries={['/login?reason=session-ended']}><AuthPage /></MemoryRouter>)
        try {
            expect(screen.getByRole('alert')).toHaveTextContent(/^Sesija je završila\. Prijavi se ponovno\.$/)
        } finally {
            unmount()
            setLang('en')
        }
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
        expect(screen.queryByText('Your session ended. Sign in again.')).toBeNull()
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
        expect(await screen.findByRole('heading', { name: 'Create Account' })).toBeInTheDocument()
    })

    test('"Sign in" on /signup is a link back to /login, still carrying the return path', async () => {
        renderAuth({ pathname: '/signup', state: { from: '/lobby/abc' } })
        const link = await screen.findByRole('link', { name: 'Sign in' })
        expect(link).toHaveAttribute('href', '/login')
        await userEvent.setup().click(link)
        expect(screen.getByTestId('where')).toHaveTextContent('/login {"from":"/lobby/abc"}')
        // a table's return path: the door's h1 opens the page, the sign-in heading under it (R1-01)
        expect(screen.getByRole('heading', { level: 2, name: 'Welcome Back' })).toBeInTheDocument()
    })
})

describe("Sign-in from a friend's table link, signed out (spec §3.2)", () => {
    afterEach(() => {
        vi.restoreAllMocks()
        setLang('en')
    })

    test("sign-in from a friend's table link offers to sit down as a guest, and does (spec §3.2)", async () => {
        const start = vi.spyOn(authService, 'startGuest').mockResolvedValue({ token: 'g-tok', user: { id: 'g1', username: 'gost_4821', guest: true }, message: null })
        renderAuth({ pathname: '/login', state: { from: '/lobby/abc' } })
        expect(screen.getByText('You can sit at this table without an account, as a guest.')).toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Sit down as a guest' }))
        expect(start).toHaveBeenCalledWith('en')
        expect(screen.getByTestId('where').textContent).toMatch(/^\/lobby\/abc /)
    })

    test("the door comes first: above the sign-in form, with its line, and the page's one primary button (review Important 1)", () => {
        const { container } = render(
            <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: '/lobby/x' } }]}>
                <AuthPage initialMode="login" redirectTo="/dashboard" />
            </MemoryRouter>,
        )
        const sit = screen.getByRole('button', { name: 'Sit down as a guest' })
        const signIn = screen.getByRole('button', { name: 'Sign In' })
        const form = signIn.closest('form') as HTMLFormElement
        const lead = screen.getByText('You can sit at this table without an account, as a guest.')
        expect(lead.compareDocumentPosition(sit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(sit.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(sit).toHaveClass('ui-btn--primary')
        expect(signIn).not.toHaveClass('ui-btn--primary')
        expect(signIn).toHaveClass('ui-btn--secondary')
        expect(container.querySelectorAll('.ui-btn--primary')).toHaveLength(1)
    })

    test("the door opens the page with its own h1, before its button; the sign-in heading is an h2 there (R1-01, Ruling 79)", () => {
        renderAuth({ pathname: '/login', state: { from: '/lobby/abc' } })
        const h1s = screen.getAllByRole('heading', { level: 1 })
        expect(h1s.map((h) => h.textContent)).toEqual(['A table is waiting for you'])
        const sit = screen.getByRole('button', { name: 'Sit down as a guest' })
        const signIn = screen.getByRole('heading', { level: 2, name: 'Welcome Back' })
        const form = screen.getByRole('button', { name: 'Sign In' }).closest('form') as HTMLFormElement
        expect(h1s[0].compareDocumentPosition(sit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(sit.compareDocumentPosition(signIn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(signIn.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    test('without a table path the sign-in heading stays the h1, and there is no door heading', () => {
        renderAuth({ pathname: '/login', state: { from: '/friends' } })
        expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Welcome Back'])
        expect(screen.queryByRole('heading', { name: 'A table is waiting for you' })).toBeNull()
    })

    test('no door on a plain sign-in, nor from another page', () => {
        const { unmount } = render(<MemoryRouter initialEntries={['/login']}><AuthPage /></MemoryRouter>)
        expect(screen.queryByRole('button', { name: 'Sit down as a guest' })).toBeNull()
        // and the sign-in page as it was: Sign In is its primary button
        expect(screen.getByRole('button', { name: 'Sign In' })).toHaveClass('ui-btn--primary')
        unmount()
        renderAuth({ pathname: '/login', state: { from: '/friends' } })
        expect(screen.queryByRole('button', { name: 'Sit down as a guest' })).toBeNull()
        expect(screen.getByRole('button', { name: 'Sign In' })).toHaveClass('ui-btn--primary')
    })

    test('a refused guest (429) says so, and the page stays', async () => {
        vi.spyOn(authService, 'startGuest').mockRejectedValue(new ApiError({ message: 'Too many requests, try again later', status: 429, code: 'RATE_LIMITED' }))
        renderAuth({ pathname: '/login', state: { from: '/lobby/abc' } })
        await userEvent.setup().click(screen.getByRole('button', { name: 'Sit down as a guest' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Too many tries. Wait a little, then try again.')
        expect(screen.getByTestId('where').textContent).toMatch(/^\/login /)
        expect(screen.getByRole('button', { name: 'Sit down as a guest' })).toBeEnabled()
    })

    test('the door in Croatian', () => {
        setLang('hr')
        renderAuth({ pathname: '/login', state: { from: '/lobby/abc' } })
        expect(screen.getByText('Za ovaj stol možeš sjesti i bez računa, kao gost.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Sjedni kao gost' })).toBeInTheDocument()
        expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Čeka te stol'])
        expect(screen.getByRole('heading', { level: 2, name: 'Opet si tu!' })).toBeInTheDocument()
    })
})
