import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserCard } from './UserCard'
import { useFriends } from '../../hooks/useFriends'
import { ApiError } from '../../services/api'
import type { Friendship } from '../../types/friendship'

vi.mock('../../hooks/useFriends', () => ({ useFriends: vi.fn() }))

const ana = { id: 'u1', username: 'ana', eloRating: 1300, level: 2, gamesPlayed: 10 }
const bob = { id: 'u2', username: 'bob', eloRating: 1250, level: 1, gamesPlayed: 3 }
const sendFriendRequest = vi.fn()

function mockFriends(friendships: Friendship[]) {
    vi.mocked(useFriends).mockReturnValue({
        friendships, sendFriendRequest, acceptFriendRequest: vi.fn(), rejectFriendRequest: vi.fn(),
        cancelFriendRequest: vi.fn(), removeFriend: vi.fn(), isSending: false, isAccepting: false,
        isRejecting: false, isCanceling: false, isRemoving: false,
    } as never)
}

beforeEach(() => {
    vi.clearAllMocks()
    mockFriends([])
})

describe('UserCard friend request', () => {
    test('sends only the recipient - the sender is the signed-in user', async () => {
        sendFriendRequest.mockResolvedValue({})
        render(<UserCard user={bob} currentUser={ana} onUpdate={vi.fn()} />)
        await userEvent.setup().click(screen.getByRole('button', { name: 'Add Friend' }))
        expect(sendFriendRequest).toHaveBeenCalledWith({ toUserId: 'u2' })
    })

    test('a refusal is shown', async () => {
        // bob deleted his account after the user list loaded
        sendFriendRequest.mockRejectedValue(new ApiError({ status: 404, message: 'User not found with id: u2' }))
        render(<UserCard user={bob} currentUser={ana} onUpdate={vi.fn()} />)
        await userEvent.setup().click(screen.getByRole('button', { name: 'Add Friend' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('User not found with id: u2')
    })

    test('accept and reject only on a request to me; cancel only on a request from me', () => {
        mockFriends([{ id: 'f1', fromUser: bob, toUser: ana, status: 'PENDING', createdAt: null }])
        const { unmount } = render(<UserCard user={bob} currentUser={ana} onUpdate={vi.fn()} />)
        expect(screen.getByRole('button', { name: '✓' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '✗' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Pending' })).not.toBeInTheDocument()
        unmount()

        mockFriends([{ id: 'f2', fromUser: ana, toUser: bob, status: 'PENDING', createdAt: null }])
        render(<UserCard user={bob} currentUser={ana} onUpdate={vi.fn()} />)
        expect(screen.getByRole('button', { name: 'Pending' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '✓' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '✗' })).not.toBeInTheDocument()
    })
})
