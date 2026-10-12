import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LeaderboardPage } from './LeaderboardPage'

const auth = vi.hoisted(() => ({ isAuthenticated: true }))
vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({
        user: auth.isAuthenticated ? { id: 'u1', username: 'ana' } : null,
        isAuthenticated: auth.isAuthenticated,
        isLoading: false,
        logout: vi.fn(),
        token: auth.isAuthenticated ? 'tok-1' : null,
    }),
}))
vi.mock('../hooks/useUser', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../hooks/useUser')>()),
    useMe: () => ({ data: { roles: ['ROLE_USER'] } }),
}))
vi.mock('../components/layout/ActiveGameBanner', () => ({ ActiveGameBanner: () => null }))
vi.mock('../components/layout/UnverifiedEmailBanner', () => ({ UnverifiedEmailBanner: () => null }))
vi.mock('../components/profile/UserList', () => ({ UserList: () => <p>the players</p> }))

function renderUsers() {
    render(
        <MemoryRouter initialEntries={['/users']}>
            <Routes>
                <Route path="/users" element={<LeaderboardPage />} />
                <Route path="/login" element={<h1>Sign-in page</h1>} />
            </Routes>
        </MemoryRouter>,
    )
}

beforeEach(() => {
    auth.isAuthenticated = true
})

describe('/users, the leaderboard (spec §4.12)', () => {
    test('signed in: the leaderboard inside the shell', () => {
        renderUsers()
        expect(screen.getByRole('heading', { level: 1, name: 'Leaderboard' })).toBeInTheDocument()
        expect(screen.getByText('the players')).toBeInTheDocument()
        expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
        expect(document.title).toBe('Leaderboard · Stiglja')
    })

    test('signed out: the prompt, kept, in the public frame (M-13)', async () => {
        auth.isAuthenticated = false
        renderUsers()
        expect(screen.getByRole('heading', { level: 1, name: 'Leaderboard' })).toBeInTheDocument()
        expect(screen.getByText('Authentication Required')).toBeInTheDocument()
        expect(screen.getByText('Please log in to view the user leaderboard.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument()
        expect(screen.queryByText('the players')).not.toBeInTheDocument()
        expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Login' }))
        expect(screen.getByRole('heading', { name: 'Sign-in page' })).toBeInTheDocument()
    })
})
