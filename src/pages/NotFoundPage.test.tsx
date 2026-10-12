import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { NotFoundPage } from './NotFoundPage'

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

function renderAt(path: string) {
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/dashboard" element={<h1>Home page</h1>} />
                <Route path="/login" element={<h1>Sign-in page</h1>} />
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </MemoryRouter>,
    )
}

beforeEach(() => {
    auth.isAuthenticated = true
})

describe('Not found (spec §4.16)', () => {
    test('signed in: "Page not found" inside the shell, and Go home leads to /dashboard', async () => {
        renderAt('/no/such/page')
        expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
        expect(screen.getByText("The page you're looking for doesn't exist.")).toBeInTheDocument()
        expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
        expect(document.title).toBe('Page not found · Stiglja')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Go home' }))
        expect(screen.getByRole('heading', { name: 'Home page' })).toBeInTheDocument()
    })

    test('signed out: the public frame, and Sign in leads to /login', async () => {
        auth.isAuthenticated = false
        renderAt('/no/such/page')
        expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
        expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Stiglja' })).toHaveAttribute('href', '/')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Sign in' }))
        expect(screen.getByRole('heading', { name: 'Sign-in page' })).toBeInTheDocument()
    })
})
