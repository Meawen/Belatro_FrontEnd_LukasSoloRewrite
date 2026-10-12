import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { viewport } from '../../test/viewport'

vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'u1', username: 'ana' }, logout: vi.fn(), isAuthenticated: true }),
}))
vi.mock('../../hooks/useUser', () => ({ useMe: () => ({ data: { roles: ['ROLE_USER'] } }) }))
vi.mock('./ActiveGameBanner', () => ({
    ActiveGameBanner: () => <div role="region" aria-label="Game in progress">You have a game in progress.</div>,
}))
vi.mock('./UnverifiedEmailBanner', () => ({ UnverifiedEmailBanner: () => null }))

/** The shell as App.tsx uses it: a layout route around the pages. */
function renderShell(path = '/dashboard') {
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route element={<AppShell />}>
                    <Route path="/dashboard" element={<h1>Home</h1>} />
                    <Route path="/friends" element={<h1>Friends page</h1>} />
                </Route>
            </Routes>
        </MemoryRouter>,
    )
    return screen.getByRole('navigation', { name: 'Main navigation' })
}

afterEach(() => vi.unstubAllGlobals())

describe('AppShell on a phone (spec §4.1, R-37 amended)', () => {
    test('at 375 px the tab bar is the navigation and there is no sidebar', () => {
        viewport(375, 812)
        const nav = renderShell()
        expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Play', 'Lobbies', 'Matches', 'Profile'])
        expect(within(nav).getByRole('button', { name: 'More' })).toBeInTheDocument()
        expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    })

    test('at 375 px following a link in More closes it', async () => {
        viewport(375, 812)
        renderShell()
        const user = userEvent.setup()
        await user.click(screen.getByRole('button', { name: 'More' }))
        await user.click(within(screen.getByRole('dialog', { name: 'More' })).getByRole('link', { name: 'Friends' }))
        expect(screen.getByRole('heading', { name: 'Friends page' })).toBeInTheDocument()
        expect(screen.queryByRole('dialog', { name: 'More' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false')
    })

    test.each([[812, 375], [667, 375]])('at %i×%i (landscape, at most 500 px tall) the tab bar shows', (width, height) => {
        viewport(width, height)
        const nav = renderShell()
        expect(within(nav).getByRole('button', { name: 'More' })).toBeInTheDocument()
        expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    })
})

describe('AppShell on a wider screen (spec §4.1, X-9)', () => {
    test('at 1024 px the sidebar is in the page and there is no tab bar', () => {
        viewport(1024, 768)
        const nav = renderShell()
        expect(screen.getByRole('complementary')).toContainElement(nav)
        expect(within(nav).getByText('Ranked')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument()
    })

    test('at 800×1000 the sidebar shows only icons, each link named', () => {
        viewport(800, 1000)
        const nav = renderShell()
        expect(within(nav).getByRole('link', { name: 'Ranked' })).toHaveAttribute('aria-label', 'Ranked')
        expect(within(nav).queryByText('Ranked')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument()
    })

    test('the banners come before the page, and the footer after it', () => {
        renderShell()
        const banner = screen.getByRole('region', { name: 'Game in progress' })
        const page = screen.getByRole('heading', { name: 'Home' })
        const footer = screen.getByRole('contentinfo')
        expect(banner.compareDocumentPosition(page) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(page.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(screen.getByRole('main')).toContainElement(banner)
    })
})
