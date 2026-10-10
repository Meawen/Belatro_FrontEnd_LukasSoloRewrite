import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FriendActions, type FriendActionsProps } from './FriendActions'
import { ApiError } from '../../services/api'
import type { Friendship } from '../../types/friendship'

const ana = { id: 'u1', username: 'ana', eloRating: 1300, level: 2, gamesPlayed: 10 }
const bob = { id: 'u2', username: 'bob', eloRating: 1250, level: 1, gamesPlayed: 3 }

const actions = {
    sendFriendRequest: vi.fn(),
    acceptFriendRequest: vi.fn(),
    rejectFriendRequest: vi.fn(),
    cancelFriendRequest: vi.fn(),
    removeFriend: vi.fn(),
}

/** bob's actions as ana sees them, with these friendships loaded. */
function renderActions(friendships: Friendship[], props: Partial<FriendActionsProps> = {}) {
    return render(<FriendActions user={bob} meId="u1" friends={{ ...actions, friendships }} {...props} />)
}

const incoming: Friendship = { id: 'f1', fromUser: bob, toUser: ana, status: 'PENDING', createdAt: null }
const outgoing: Friendship = { id: 'f2', fromUser: ana, toUser: bob, status: 'PENDING', createdAt: null }
const accepted: Friendship = { id: 'f3', fromUser: bob, toUser: ana, status: 'ACCEPTED', createdAt: null }

beforeEach(() => vi.clearAllMocks())

describe('FriendActions: the friend request (UserCard, carried)', () => {
    test('sends only the recipient - the sender is the signed-in user', async () => {
        actions.sendFriendRequest.mockResolvedValue({})
        renderActions([])
        await userEvent.setup().click(screen.getByRole('button', { name: 'Add Friend' }))
        expect(actions.sendFriendRequest).toHaveBeenCalledWith({ toUserId: 'u2' })
    })

    test('a refusal is shown', async () => {
        // bob deleted his account after the user list loaded
        actions.sendFriendRequest.mockRejectedValue(new ApiError({ status: 404, message: 'User not found with id: u2' }))
        renderActions([])
        await userEvent.setup().click(screen.getByRole('button', { name: 'Add Friend' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('User not found with id: u2')
    })

    // D-36: the accept and decline buttons were "✓" and "✗", with no accessible name
    test('accept and decline only on a request to me; cancel only on a request from me', () => {
        const { unmount } = renderActions([incoming])
        expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Pending' })).not.toBeInTheDocument()
        unmount()

        renderActions([outgoing])
        expect(screen.getByRole('button', { name: 'Pending' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Decline' })).not.toBeInTheDocument()
    })
})

describe('FriendActions (spec §4.10, §4.12)', () => {
    test('Accept and Decline answer the request; Pending cancels it', async () => {
        const user = userEvent.setup()
        actions.acceptFriendRequest.mockResolvedValue({})
        actions.rejectFriendRequest.mockResolvedValue({})
        actions.cancelFriendRequest.mockResolvedValue({})
        const { unmount } = renderActions([incoming])
        await user.click(screen.getByRole('button', { name: 'Accept' }))
        expect(actions.acceptFriendRequest).toHaveBeenCalledWith('f1')
        await user.click(screen.getByRole('button', { name: 'Decline' }))
        expect(actions.rejectFriendRequest).toHaveBeenCalledWith('f1')
        unmount()
        renderActions([outgoing])
        await user.click(screen.getByRole('button', { name: 'Pending' }))
        expect(actions.cancelFriendRequest).toHaveBeenCalledWith('f2')
    })

    test('Remove asks first in a sheet: Cancel keeps the friend, "Remove bob" removes', async () => {
        const user = userEvent.setup()
        actions.removeFriend.mockResolvedValue({})
        renderActions([accepted])
        await user.click(screen.getByRole('button', { name: 'Remove' }))
        const sheet = screen.getByRole('dialog', { name: 'Remove bob?' })
        expect(sheet).toHaveTextContent('Are you sure you want to remove bob from your friends?')
        await user.click(within(sheet).getByRole('button', { name: 'Cancel' }))
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        expect(actions.removeFriend).not.toHaveBeenCalled()

        await user.click(screen.getByRole('button', { name: 'Remove' }))
        await user.click(screen.getByRole('button', { name: 'Remove bob' }))
        expect(actions.removeFriend).toHaveBeenCalledWith('f3')
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    test('while a request runs its button shows it and the other waits; another player is not held up', async () => {
        const user = userEvent.setup()
        actions.acceptFriendRequest.mockReturnValue(new Promise(() => {}))
        const cy = { id: 'u3', username: 'cy', eloRating: 1200, level: 1, gamesPlayed: 0 }
        const toMe = [incoming, { id: 'f4', fromUser: cy, toUser: ana, status: 'PENDING', createdAt: null } as Friendship]
        render(
            <>
                <div data-testid="bob"><FriendActions user={bob} meId="u1" friends={{ ...actions, friendships: toMe }} /></div>
                <div data-testid="cy"><FriendActions user={cy} meId="u1" friends={{ ...actions, friendships: toMe }} /></div>
            </>,
        )
        const bobs = within(screen.getByTestId('bob'))
        await user.click(bobs.getByRole('button', { name: 'Accept' }))
        expect(bobs.getByRole('button', { name: 'Accept' })).toHaveAttribute('aria-busy', 'true')
        expect(bobs.getByRole('button', { name: 'Decline' })).toBeDisabled()
        const cys = within(screen.getByTestId('cy'))
        expect(cys.getByRole('button', { name: 'Accept' })).toBeEnabled()
        expect(cys.getByRole('button', { name: 'Decline' })).toBeEnabled()
    })

    test('compact (phones): one icon button per action, named like the full ones', () => {
        const { unmount } = renderActions([], { compact: true })
        const add = screen.getByRole('button', { name: 'Add Friend' })
        expect(add).toHaveAttribute('aria-label', 'Add Friend')
        expect(add).not.toHaveTextContent('Add Friend')
        unmount()
        renderActions([incoming], { compact: true })
        expect(screen.getByRole('button', { name: 'Accept' })).toHaveAttribute('aria-label', 'Accept')
        expect(screen.getByRole('button', { name: 'Decline' })).toHaveAttribute('aria-label', 'Decline')
    })

    test('nothing for yourself, and nothing once a request was declined or cancelled', () => {
        const { container, unmount } = renderActions([], { user: ana })
        expect(container).toBeEmptyDOMElement()
        unmount()
        const { container: closed } = renderActions([{ ...outgoing, status: 'CANCELLED' }])
        expect(closed).toBeEmptyDOMElement()
    })
})
