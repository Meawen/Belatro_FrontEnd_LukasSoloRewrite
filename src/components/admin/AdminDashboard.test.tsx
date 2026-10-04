import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminDashboard } from './AdminDashboard'
import { useMe } from '../../hooks/useUser'

vi.mock('../../hooks/useUser', () => ({ useMe: vi.fn() }))
// the pre-fix component reads roles off the auth user, which never has any
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' } }) }))
vi.mock('./AdminStats', () => ({ AdminStats: () => <div>stats panel</div> }))
vi.mock('./UserManagement', () => ({ UserManagement: () => <div>user management</div> }))
vi.mock('./SystemStatus', () => ({ SystemStatus: () => <div>system status</div> }))

beforeEach(() => vi.clearAllMocks())

describe('AdminDashboard gate (the live /admin gate)', () => {
    test('an admin per /user/me sees the dashboard', () => {
        vi.mocked(useMe).mockReturnValue({ data: { roles: ['ROLE_ADMIN'] }, error: null } as never)
        render(<AdminDashboard />)
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument()
        expect(screen.getByText('stats panel')).toBeInTheDocument()
    })

    test('a non-admin is denied', () => {
        vi.mocked(useMe).mockReturnValue({ data: { roles: ['ROLE_USER'] }, error: null } as never)
        render(<AdminDashboard />)
        expect(screen.getByText('Access Denied')).toBeInTheDocument()
        expect(screen.queryByText('stats panel')).not.toBeInTheDocument()
        // the denial must come from /user/me, not from the role-less auth user
        expect(vi.mocked(useMe)).toHaveBeenCalled()
    })

    test('waits for /user/me instead of flashing a denial', () => {
        vi.mocked(useMe).mockReturnValue({ data: null, error: null } as never)
        render(<AdminDashboard />)
        expect(screen.getByText('Checking permissions...')).toBeInTheDocument()
        expect(screen.queryByText('Access Denied')).not.toBeInTheDocument()
    })

    test('a failed /user/me denies instead of spinning forever', () => {
        vi.mocked(useMe).mockReturnValue({ data: null, error: { status: 500, message: 'boom' } } as never)
        render(<AdminDashboard />)
        expect(screen.getByText('Access Denied')).toBeInTheDocument()
        expect(screen.queryByText('Checking permissions...')).not.toBeInTheDocument()
        expect(vi.mocked(useMe)).toHaveBeenCalled()
    })
})
