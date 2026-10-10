import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { UserManagement } from './UserManagement'
import { useAdmin } from '../../hooks/useAdmin'
import { ApiError } from '../../services/api'
import { viewport } from '../../test/viewport'

vi.mock('../../hooks/useAdmin', () => ({ useAdmin: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' } }) }))

const ana = { id: 'u1', username: 'ana', email: 'ana@example.com', pendingEmail: null, emailVerified: true, roles: ['ROLE_USER', 'ROLE_ADMIN'], deletionRequested: false }
const bob = { id: 'u2', username: 'bob', email: 'bob@example.com', pendingEmail: null, emailVerified: true, roles: null, deletionRequested: true }
const forgetUser = vi.fn()

function mockAdmin(users: unknown[]) {
    vi.mocked(useAdmin).mockReturnValue({
        users, isLoading: false, error: null, forgetUser, refetch: vi.fn().mockResolvedValue(undefined), isForgettingUser: false,
    } as never)
}

/** Where a button led. */
function Where() {
    const { pathname } = useLocation()
    return <p>at {pathname}</p>
}

function renderManagement() {
    return render(
        <MemoryRouter initialEntries={['/admin']}>
            <Routes>
                <Route path="/admin" element={<UserManagement />} />
                <Route path="*" element={<Where />} />
            </Routes>
        </MemoryRouter>,
    )
}

beforeEach(() => {
    vi.clearAllMocks()
    mockAdmin([bob])
})
afterEach(() => vi.unstubAllGlobals())

describe('UserManagement delete dialog (R-40)', () => {
    test('says what the delete removes and what remains', async () => {
        render(<UserManagement />, { wrapper: MemoryRouter })
        await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }))
        const dialog = screen.getByRole('heading', { name: 'Confirm User Deletion' }).closest('[role="dialog"]') as HTMLElement
        expect(dialog).toHaveTextContent('Deletes the user record; friendships, match history and rank history remain')
        expect(dialog).not.toHaveTextContent('All associated data will be removed')
    })
})

describe('UserManagement (spec §4.14; X-7)', () => {
    test('a failed delete shows the error and keeps the dialog; a done one closes it', async () => {
        const user = userEvent.setup()
        forgetUser.mockRejectedValueOnce(new ApiError({ status: 404, message: 'User not found with id u2' }))
        renderManagement()
        await user.click(screen.getByRole('button', { name: 'Delete' }))
        await user.click(screen.getByRole('button', { name: 'Delete User' }))
        expect(forgetUser).toHaveBeenCalledWith('u2')
        const dialog = screen.getByRole('dialog', { name: 'Confirm User Deletion' })
        expect(await within(dialog).findByRole('alert')).toHaveTextContent('User not found with id u2')

        forgetUser.mockResolvedValueOnce(undefined)
        await user.click(within(dialog).getByRole('button', { name: 'Delete User' }))
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    test('the table: the user, "ID: …", the e-mail, the role and the status; View opens the profile; no Delete on my row', async () => {
        mockAdmin([ana, bob])
        renderManagement()
        expect(screen.getByRole('heading', { level: 2, name: 'User Management' })).toBeInTheDocument()
        expect(screen.getByText('2 users found')).toBeInTheDocument()
        // the name is the word alone: today's button carried an emoji before it (D-36)
        expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
        const [, mine, bobs] = screen.getAllByRole('row')
        expect(mine).toHaveTextContent('You')
        expect(mine).toHaveTextContent('USER, ADMIN')
        expect(within(mine).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
        expect(bobs).toHaveTextContent('ID: u2')
        expect(bobs).toHaveTextContent('bob@example.com')
        expect(bobs).toHaveTextContent('Deletion Requested')
        await userEvent.setup().click(within(bobs).getByRole('button', { name: 'View' }))
        expect(screen.getByText('at /profile/u2')).toBeInTheDocument()
    })

    test('phones get one panel per user instead of the table, with the same facts and actions', () => {
        viewport(375, 812)
        mockAdmin([ana, bob])
        renderManagement()
        expect(screen.queryByRole('table')).not.toBeInTheDocument()
        const [mine, bobs] = screen.getAllByRole('listitem')
        expect(mine).toHaveTextContent('You')
        expect(bobs).toHaveTextContent('bob@example.com')
        expect(bobs).toHaveTextContent('User')
        expect(bobs).toHaveTextContent('Deletion Requested')
        expect(within(bobs).getByRole('button', { name: 'View' })).toBeInTheDocument()
        expect(within(bobs).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    })
})
