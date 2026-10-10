import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, type InitialEntry } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { PublicRoute } from './PublicRoute'
import { AuthPage } from '../components/auth/AuthPage'
import { captureConsole } from '../test/captureConsole'

// One switch for every component that asks: the real forms sign in by flipping it.
const auth = vi.hoisted(() => ({ signedIn: false, loading: false }))
vi.mock('../hooks/useAuth', () => {
    const signIn = async () => {
        auth.signedIn = true
        return { token: 'tok-1', user: { id: 'u1', username: 'ana' }, message: null }
    }
    return {
        useAuth: () => ({
            user: auth.signedIn ? { id: 'u1', username: 'ana' } : null,
            isAuthenticated: auth.signedIn,
            isLoading: auth.loading,
            login: signIn,
            signup: signIn,
            isLoginLoading: false,
            isSignupLoading: false,
        }),
    }
})

/** What /login was handed. */
function From() {
    const state = useLocation().state as { from?: unknown } | null
    return <p>from: {String(state?.from)}</p>
}

function Lobby() {
    return <h1>Lobby page {useLocation().pathname}</h1>
}

/** The routes as App.tsx wires them; /login shows the real sign-in page unless `login` replaces it. */
function renderAt(entry: InitialEntry, login = <AuthPage initialMode="login" redirectTo="/dashboard" />) {
    render(
        <MemoryRouter initialEntries={[entry]}>
            <Routes>
                <Route path="/login" element={<PublicRoute>{login}</PublicRoute>} />
                <Route path="/signup" element={<PublicRoute><AuthPage initialMode="signup" redirectTo="/dashboard" /></PublicRoute>} />
                <Route path="/lobby/:lobbyId" element={<ProtectedRoute><Lobby /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><h1>Home page</h1></ProtectedRoute>} />
            </Routes>
        </MemoryRouter>,
    )
}

async function signIn() {
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Username'), 'ana')
    await user.type(screen.getByLabelText('Password'), 'e2e-password-123')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))
}

beforeEach(() => {
    auth.signedIn = false
    auth.loading = false
    // the forms log their steps (never a password)
    captureConsole()
})
afterEach(() => vi.restoreAllMocks())

describe('ProtectedRoute and PublicRoute', () => {
    test('a signed-out visitor goes to /login, which is handed the page as { from }: path and query', () => {
        renderAt('/lobby/abc?seat=b', <From />)
        expect(screen.getByText('from: /lobby/abc?seat=b')).toBeInTheDocument()
    })

    test('while the session is read, the guards keep their loading lines', () => {
        auth.loading = true
        renderAt('/lobby/abc')
        expect(screen.getByText('Checking authentication...')).toBeInTheDocument()
        renderAt('/login')
        expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    test('a signed-in visitor of /login goes to /dashboard', () => {
        auth.signedIn = true
        renderAt('/login')
        expect(screen.getByRole('heading', { name: 'Home page' })).toBeInTheDocument()
    })
})

describe('the return path (spec §4.1 AC 7, D-20)', () => {
    test('a signed-out visit to /lobby/abc, then sign in, lands on /lobby/abc', async () => {
        renderAt('/lobby/abc')
        await signIn()
        expect(await screen.findByRole('heading', { name: 'Lobby page /lobby/abc' })).toBeInTheDocument()
    })

    test('a signed-out visit to /lobby/abc, then Sign up, Create Account and Continue, lands on /lobby/abc', async () => {
        renderAt('/lobby/abc')
        const user = userEvent.setup()
        // a button today; a link once sign in and sign up are separate URLs (X-2)
        await user.click(screen.getByText('Sign up', { selector: 'a, button' }))
        await user.type(screen.getByLabelText('Username'), 'ana_1')
        await user.type(screen.getByLabelText('Email'), 'ana@example.test')
        await user.type(screen.getByLabelText('Password'), 'e2e-password-123')
        await user.type(screen.getByLabelText('Confirm Password'), 'e2e-password-123')
        await user.click(screen.getByRole('button', { name: 'Create Account' }))
        await user.click(await screen.findByRole('button', { name: 'Continue' }))
        expect(await screen.findByRole('heading', { name: 'Lobby page /lobby/abc' })).toBeInTheDocument()
    })

    test.each(['//evil.example', '/\\evil.example'])('a from of %s lands on /dashboard', async (from) => {
        renderAt({ pathname: '/login', state: { from } })
        await signIn()
        expect(await screen.findByRole('heading', { name: 'Home page' })).toBeInTheDocument()
    })

    test('without a from, sign-in goes to /dashboard as before', async () => {
        renderAt('/login')
        await signIn()
        expect(await screen.findByRole('heading', { name: 'Home page' })).toBeInTheDocument()
    })
})
