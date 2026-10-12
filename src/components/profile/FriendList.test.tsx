import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { FriendsList } from './FriendList'
import { useFriends } from '../../hooks/useFriends'
import { ApiError } from '../../services/api'
import type { Friendship } from '../../types/friendship'

vi.mock('../../hooks/useFriends', () => ({ useFriends: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' } }) }))

const ana = { id: 'u1', username: 'ana', eloRating: 1300, level: 2, gamesPlayed: 10 }
const bob = { id: 'u2', username: 'bob', eloRating: 1250, level: 1, gamesPlayed: 3 }
const cy = { id: 'u3', username: 'cy', eloRating: 1200, level: 1, gamesPlayed: 0 }
const acceptFriendRequest = vi.fn()

function mockFriends(friendships: Friendship[]) {
    vi.mocked(useFriends).mockReturnValue({
        friendships, isLoading: false, error: null, acceptFriendRequest, rejectFriendRequest: vi.fn(),
        cancelFriendRequest: vi.fn(), removeFriend: vi.fn(), refetch: vi.fn(),
        isAccepting: false, isRejecting: false, isCanceling: false, isRemoving: false,
    } as never)
}

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
