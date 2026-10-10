import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useMe } from '../../hooks/useUser'
import { viewport } from '../../test/viewport'

const auth = vi.hoisted(() => ({ logout: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'u1', username: 'ana' }, logout: auth.logout, isAuthenticated: true }),
}))
vi.mock('../../hooks/useUser', () => ({ useMe: vi.fn() }))

const EVERYONE = ['Play', 'Ranked', 'Lobbies', 'Matches', 'Friends', 'Leaderboard', 'Profile', 'Settings', 'Rules']

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useMe).mockReturnValue({ data: { roles: ['ROLE_USER'] } } as never)
})
afterEach(() => vi.unstubAllGlobals())

function renderSidebar(path = '/dashboard') {
    render(<MemoryRouter initialEntries={[path]}><Sidebar /></MemoryRouter>)
    return screen.getByRole('navigation', { name: 'Main navigation' })
}

describe('Sidebar admin link', () => {
    test('shows Admin to an admin per /user/me', () => {
        vi.mocked(useMe).mockReturnValue({ data: { roles: ['ROLE_ADMIN'] } } as never)
        const nav = renderSidebar()
        expect(within(nav).getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin')
        expect(vi.mocked(useMe)).toHaveBeenCalledWith(true)
    })

    test('hides it from everyone else', () => {
        const nav = renderSidebar()
        expect(within(nav).queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
        expect(within(nav).getByRole('link', { name: 'Play' })).toBeInTheDocument()
        // hidden because /user/me says so, not because isAdmin is hard-coded
        expect(vi.mocked(useMe)).toHaveBeenCalledWith(true)
    })

    // R-34 as amended (spec §2.5): Settings is a real page again (D-32), so the nav lists it
    test('Settings is in the nav and leads to /settings (R-34 amended)', () => {
        const nav = renderSidebar()
        expect(within(nav).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
        expect(within(nav).getByRole('link', { name: 'Matches' })).toBeInTheDocument()
    })
})

describe('Sidebar (spec §4.1, X-9)', () => {
    test('lists every destination in order, the current page marked', () => {
        const nav = renderSidebar('/lobby/abc')
        expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(EVERYONE)
        expect(within(nav).getByRole('link', { name: 'Lobbies' })).toHaveAttribute('aria-current', 'page')
        expect(within(nav).getByRole('link', { name: 'Play' })).not.toHaveAttribute('aria-current')
    })

    test('at 1024 px the links show their labels', () => {
        viewport(1024, 768)
        const nav = renderSidebar()
        expect(within(nav).getByText('Lobbies')).toBeInTheDocument()
        expect(screen.getByText('Log out')).toBeInTheDocument()
    })

    test('at 800 px only the icons show, and every link is still named', () => {
        viewport(800, 1000)
        const nav = renderSidebar()
        expect(within(nav).getAllByRole('link').map((link) => link.getAttribute('aria-label'))).toEqual(EVERYONE)
        expect(within(nav).queryByText('Lobbies')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
    })

    test('the user block names the player, and Log out signs out', async () => {
        renderSidebar()
        expect(screen.getByText('ana')).toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }))
        expect(auth.logout).toHaveBeenCalledTimes(1)
    })
})
