import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuthGuard } from './AuthGuard'
import { useAuth, useMe } from '../../hooks'

vi.mock('../../hooks', () => ({
    useAuth: vi.fn(),
    useMe: vi.fn(),
}))

const authed = { user: { id: 'u1', username: 'ana' }, isLoading: false, isAuthenticated: true }

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue(authed as never)
})

describe('AuthGuard admin gating', () => {
    test('admin (per /user/me) sees the children', () => {
        vi.mocked(useMe).mockReturnValue({ data: { roles: ['ROLE_ADMIN'] }, isLoading: false, error: null } as never)
        render(<AuthGuard requireAdmin><div>secret</div></AuthGuard>)
        expect(screen.getByText('secret')).toBeInTheDocument()
    })

    test('non-admin is denied', () => {
        vi.mocked(useMe).mockReturnValue({ data: { roles: [] }, isLoading: false, error: null } as never)
        render(<AuthGuard requireAdmin><div>secret</div></AuthGuard>)
        expect(screen.queryByText('secret')).not.toBeInTheDocument()
        expect(screen.getByText(/access denied/i)).toBeInTheDocument()
        // the denial must come from /user/me, not from the role-less auth user
        expect(vi.mocked(useMe)).toHaveBeenCalledWith(true)
    })

    test('shows loading while /user/me resolves', () => {
        vi.mocked(useMe).mockReturnValue({ data: null, isLoading: true, error: null } as never)
        render(<AuthGuard requireAdmin><div>secret</div></AuthGuard>)
        expect(screen.queryByText('secret')).not.toBeInTheDocument()
        expect(screen.getByText('Checking permissions...')).toBeInTheDocument()
    })

    test('a failed /user/me denies instead of spinning forever', () => {
        vi.mocked(useMe).mockReturnValue({ data: null, isLoading: false, error: { status: 500, message: 'boom' } } as never)
        render(<AuthGuard requireAdmin><div>secret</div></AuthGuard>)
        expect(screen.getByText(/access denied/i)).toBeInTheDocument()
        expect(vi.mocked(useMe)).toHaveBeenCalledWith(true)
    })

    test('non-admin routes never consult /user/me', () => {
        vi.mocked(useMe).mockReturnValue({ data: null, isLoading: false, error: null } as never)
        render(<AuthGuard><div>plain</div></AuthGuard>)
        expect(screen.getByText('plain')).toBeInTheDocument()
        expect(vi.mocked(useMe)).toHaveBeenCalledWith(false)
    })
})
