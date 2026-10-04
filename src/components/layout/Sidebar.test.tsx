import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useMe } from '../../hooks/useUser'

vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'u1', username: 'ana' }, logout: vi.fn(), isAuthenticated: true }),
}))
vi.mock('../../hooks/useUser', () => ({ useMe: vi.fn() }))

beforeEach(() => vi.clearAllMocks())

function renderSidebar() {
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
}

describe('Sidebar admin link', () => {
    test('shows Admin Panel to an admin per /user/me', () => {
        vi.mocked(useMe).mockReturnValue({ data: { roles: ['ROLE_ADMIN'] } } as never)
        renderSidebar()
        expect(screen.getByText('Admin Panel')).toBeInTheDocument()
        expect(vi.mocked(useMe)).toHaveBeenCalledWith(true)
    })

    test('hides it from everyone else', () => {
        vi.mocked(useMe).mockReturnValue({ data: { roles: ['ROLE_USER'] } } as never)
        renderSidebar()
        expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument()
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
        // hidden because /user/me says so, not because isAdmin is hard-coded
        expect(vi.mocked(useMe)).toHaveBeenCalledWith(true)
    })
})
