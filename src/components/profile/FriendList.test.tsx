import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { FriendsList } from './FriendList'
import { useFriends } from '../../hooks/useFriends'
import { ApiError } from '../../services/api'
import type { Friendship } from '../../types/friendship'

// Tailwind's own colour scale (text-purple-400, border-slate-700, …): the design uses tokens only (spec §3.2)
const RAW_PALETTE = /\b(?:bg|text|border|from|to|via)-(?:amber|emerald|slate|red|purple|gray|blue|yellow|green|orange|teal|lime|pink)-\d/

vi.mock('../../hooks/useFriends', () => ({ useFriends: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' } }) }))

const ana = { id: 'u1', username: 'ana', eloRating: 1300, level: 2, gamesPlayed: 10 }
const bob = { id: 'u2', username: 'bob', eloRating: 1250, level: 1, gamesPlayed: 3 }
const cy = { id: 'u3', username: 'cy', eloRating: 1200, level: 1, gamesPlayed: 0 }
const acceptFriendRequest = vi.fn()
const removeFriend = vi.fn()

function mockFriends(friendships: Friendship[]) {
    vi.mocked(useFriends).mockReturnValue({
        friendships, isLoading: false, error: null, acceptFriendRequest, rejectFriendRequest: vi.fn(),
        cancelFriendRequest: vi.fn(), removeFriend, refetch: vi.fn(),
        isAccepting: false, isRejecting: false, isCanceling: false, isRemoving: false,
    } as never)
}

/** Where a button led. */
function Where() {
    const { pathname } = useLocation()
    return <p>at {pathname}</p>
}

function renderFriends() {
    return render(
        <MemoryRouter initialEntries={['/friends']}>
            <Routes>
                <Route path="/friends" element={<FriendsList />} />
                <Route path="*" element={<Where />} />
            </Routes>
        </MemoryRouter>,
    )
}

const rowOf = (name: string) => screen.getByText(name, { selector: 'p' }).closest('li') as HTMLElement

beforeEach(() => {
    vi.clearAllMocks()
    mockFriends([{ id: 'f1', fromUser: bob, toUser: ana, status: 'PENDING', createdAt: null }])
})

describe('FriendsList actions', () => {
    test('a refused accept is shown', async () => {
        const user = userEvent.setup()
        // bob cancelled the request after the list was loaded
        acceptFriendRequest.mockRejectedValue(new ApiError({ status: 409, message: 'Cannot change status once friendship is finalized.' }))
        render(<FriendsList />, { wrapper: MemoryRouter })
        await user.click(screen.getByRole('button', { name: /requests \(1\)/i }))
        await user.click(screen.getByRole('button', { name: 'Accept' }))
        expect(acceptFriendRequest).toHaveBeenCalledWith('f1')
        expect(await screen.findByRole('alert')).toHaveTextContent('Cannot change status once friendship is finalized.')
    })

    test('accept and decline only on requests to me; cancel only on requests from me', async () => {
        const user = userEvent.setup()
        mockFriends([
            { id: 'f1', fromUser: bob, toUser: ana, status: 'PENDING', createdAt: null },
            { id: 'f2', fromUser: ana, toUser: cy, status: 'PENDING', createdAt: null },
        ])
        render(<FriendsList />, { wrapper: MemoryRouter })

        await user.click(screen.getByRole('button', { name: /requests \(1\)/i }))
        expect(screen.getByText('bob')).toBeInTheDocument()
        expect(screen.queryByText('cy')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /sent \(1\)/i }))
        expect(screen.getByText('cy')).toBeInTheDocument()
        expect(screen.queryByText('bob')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Decline' })).not.toBeInTheDocument()
    })
})

describe('Friends (spec §4.11)', () => {
    test("one row's request does not disable the others: the busy state is per row", async () => {
        const user = userEvent.setup()
        acceptFriendRequest.mockReturnValue(new Promise(() => {}))
        mockFriends([
            { id: 'f1', fromUser: bob, toUser: ana, status: 'PENDING', createdAt: null },
            { id: 'f5', fromUser: cy, toUser: ana, status: 'PENDING', createdAt: null },
        ])
        renderFriends()
        await user.click(screen.getByRole('button', { name: /requests \(2\)/i }))
        await user.click(within(rowOf('bob')).getByRole('button', { name: 'Accept' }))
        expect(within(rowOf('bob')).getByRole('button', { name: 'Accept' })).toHaveAttribute('aria-busy', 'true')
        expect(within(rowOf('bob')).getByRole('button', { name: 'Decline' })).toBeDisabled()
        expect(within(rowOf('cy')).getByRole('button', { name: 'Accept' })).toBeEnabled()
        expect(within(rowOf('cy')).getByRole('button', { name: 'Decline' })).toBeEnabled()
    })

    test('Remove asks first in a sheet; "Remove bob" removes the friendship', async () => {
        const user = userEvent.setup()
        removeFriend.mockResolvedValue({})
        mockFriends([{ id: 'f3', fromUser: bob, toUser: ana, status: 'ACCEPTED', createdAt: null }])
        renderFriends()
        await user.click(within(rowOf('bob')).getByRole('button', { name: 'Remove' }))
        expect(screen.getByRole('dialog', { name: 'Remove bob?' })).toHaveTextContent('Are you sure you want to remove bob from your friends?')
        expect(removeFriend).not.toHaveBeenCalled()
        await user.click(screen.getByRole('button', { name: 'Remove bob' }))
        expect(removeFriend).toHaveBeenCalledWith('f3')
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    test('a row: the name, "Elo n · Level n", since when, and View profile, which opens the profile', async () => {
        const createdAt = '2026-09-26T10:00:00Z'
        mockFriends([{ id: 'f3', fromUser: bob, toUser: ana, status: 'ACCEPTED', createdAt }])
        const { container } = renderFriends()
        const row = rowOf('bob')
        expect(row).toHaveTextContent('Elo 1250 · Level 1')
        expect(row).toHaveTextContent(`Friends since ${new Date(createdAt).toLocaleDateString()}`)
        expect(container.innerHTML).not.toMatch(RAW_PALETTE)
        await userEvent.setup().click(within(row).getByRole('button', { name: 'View profile' }))
        expect(screen.getByText('at /profile/u2')).toBeInTheDocument()
    })

    test('an empty tab says so and points to the Leaderboard', async () => {
        mockFriends([])
        renderFriends()
        expect(screen.getByText('No Friends Yet')).toBeInTheDocument()
        expect(screen.getByText('Start adding friends to see them here!')).toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Open the Leaderboard' }))
        expect(screen.getByText('at /users')).toBeInTheDocument()
    })
})
