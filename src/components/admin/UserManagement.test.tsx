import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { UserManagement } from './UserManagement'
import { useAdmin } from '../../hooks/useAdmin'

vi.mock('../../hooks/useAdmin', () => ({ useAdmin: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' } }) }))

const bob = { id: 'u2', username: 'bob', email: 'bob@example.com', pendingEmail: null, emailVerified: true, roles: null, deletionRequested: true }

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAdmin).mockReturnValue({
        users: [bob], isLoading: false, error: null, forgetUser: vi.fn(), refetch: vi.fn(), isForgettingUser: false,
    } as never)
})

describe('UserManagement delete dialog (R-40)', () => {
    test('says what the delete removes and what remains', async () => {
        render(<UserManagement />, { wrapper: MemoryRouter })
        await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }))
        const dialog = screen.getByRole('heading', { name: 'Confirm User Deletion' }).closest('.card') as HTMLElement
        expect(dialog).toHaveTextContent('Deletes the user record; friendships, match history and rank history remain')
        expect(dialog).not.toHaveTextContent('All associated data will be removed')
    })
})
