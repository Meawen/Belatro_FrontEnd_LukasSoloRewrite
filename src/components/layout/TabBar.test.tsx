import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { TabBar } from './TabBar'
import { useMe } from '../../hooks/useUser'

const auth = vi.hoisted(() => ({ logout: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'u1', username: 'ana' }, logout: auth.logout, isAuthenticated: true }),
}))
vi.mock('../../hooks/useUser', () => ({ useMe: vi.fn() }))

function Where() {
    return <p>at {useLocation().pathname}</p>
}

function renderTabBar(path = '/dashboard') {
    render(
        <MemoryRouter initialEntries={[path]}>
            <TabBar />
            <Routes>
                <Route path="*" element={<Where />} />
            </Routes>
        </MemoryRouter>,
    )
}

async function openMore() {
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'More' }))
    return { user, sheet: screen.getByRole('dialog', { name: 'More' }) }
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useMe).mockReturnValue({ data: { roles: ['ROLE_USER'] } } as never)
})

describe('TabBar (spec §4.1, R-37 amended)', () => {
    test('shows Play, Lobbies, Matches, Profile and More, the current page marked', () => {
        renderTabBar('/matches')
        const nav = screen.getByRole('navigation', { name: 'Main navigation' })
        expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Play', 'Lobbies', 'Matches', 'Profile'])
        expect(within(nav).getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false')
        expect(within(nav).getByRole('link', { name: 'Matches' })).toHaveAttribute('aria-current', 'page')
        expect(within(nav).getByRole('link', { name: 'Play' })).toHaveAttribute('href', '/dashboard')
    })

    test('More lists the other destinations, Settings among them, then Log out', async () => {
        renderTabBar()
        const { sheet } = await openMore()
        expect(within(sheet).getAllByRole('link').map((link) => link.textContent)).toEqual(['Ranked', 'Friends', 'Leaderboard', 'Settings', 'Rules'])
        expect(within(sheet).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
        expect(within(sheet).getByRole('button', { name: 'Log out' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'true')
    })

    test('on a page under More, its row in More is the current page (spec §4.1)', async () => {
        renderTabBar('/friends')
        const { sheet } = await openMore()
        expect(within(sheet).getByRole('link', { name: 'Friends' })).toHaveAttribute('aria-current', 'page')
        expect(within(sheet).getAllByRole('link').filter((link) => link.hasAttribute('aria-current')).map((link) => link.textContent)).toEqual(['Friends'])
    })

    test('an admin per /user/me also finds Admin under More', async () => {
        vi.mocked(useMe).mockReturnValue({ data: { roles: ['ROLE_ADMIN'] } } as never)
        renderTabBar()
        const { sheet } = await openMore()
        expect(within(sheet).getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin')
        expect(vi.mocked(useMe)).toHaveBeenCalledWith(true)
    })

    test('following a link in More closes it', async () => {
        renderTabBar()
        const { user, sheet } = await openMore()
        await user.click(within(sheet).getByRole('link', { name: 'Friends' }))
        expect(screen.getByText('at /friends')).toBeInTheDocument()
        expect(screen.queryByRole('dialog', { name: 'More' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false')
    })

    test('Log out under More signs out', async () => {
        renderTabBar()
        const { user, sheet } = await openMore()
        await user.click(within(sheet).getByRole('button', { name: 'Log out' }))
        expect(auth.logout).toHaveBeenCalledTimes(1)
    })
})
