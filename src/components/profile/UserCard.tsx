import React, { useMemo, useCallback, useState } from 'react';
import { Button } from '../common';
import { useFriends } from '../../hooks/useFriends';
import type { User } from '../../types/user';
import type { Friendship } from '../../types/friendship';
import { errorMessage } from '../../utils/errorMessage';

export interface UserCardProps {
    user: User;
    currentUser: User | null;
    onUpdate: () => void;
}

export const UserCard: React.FC<UserCardProps> = React.memo(({
                                                                 user,
                                                                 currentUser,
                                                                 onUpdate
                                                             }) => {
    const {
        friendships,
        sendFriendRequest,
        acceptFriendRequest,
        rejectFriendRequest,
        cancelFriendRequest,
        removeFriend,
        isSending,
        isAccepting,
        isRejecting,
        isCanceling,
        isRemoving
    } = useFriends(currentUser?.id || undefined);
    const [actionError, setActionError] = useState<string | null>(null);

    // Memoize friendship status calculation
    const friendshipStatus = useMemo(() => {
        if (!currentUser?.id || !user.id || !Array.isArray(friendships)) {
            return { friendship: null, isOutgoingRequest: false, isIncomingRequest: false, isFriend: false };
        }

        const friendship = friendships.find((f: Friendship) =>
            (f.fromUser?.id === user.id && f.toUser?.id === currentUser.id) ||
            (f.fromUser?.id === currentUser.id && f.toUser?.id === user.id)
        );

        const isOutgoingRequest = friendship?.fromUser?.id === currentUser.id && friendship?.status === 'PENDING';
        const isIncomingRequest = friendship?.toUser?.id === currentUser.id && friendship?.status === 'PENDING';
        const isFriend = friendship?.status === 'ACCEPTED';

        return { friendship, isOutgoingRequest, isIncomingRequest, isFriend };
    }, [friendships, currentUser?.id, user.id]);

    // Memoize handlers to prevent unnecessary re-renders
    const handleSendFriendRequest = useCallback(async () => {
        if (!currentUser?.id || !user.id) return;

        try {
            setActionError(null);
            await sendFriendRequest({ toUserId: user.id });
            onUpdate();
        } catch (error) {
            console.error('Failed to send friend request:', error);
            setActionError(errorMessage(error, 'Failed to send friend request'));
        }
    }, [currentUser?.id, user.id, sendFriendRequest, onUpdate]);

    const handleAcceptRequest = useCallback(async () => {
        if (!friendshipStatus.friendship?.id) return;

        try {
            setActionError(null);
            await acceptFriendRequest(friendshipStatus.friendship.id);
            onUpdate();
        } catch (error) {
            console.error('Failed to accept friend request:', error);
            setActionError(errorMessage(error, 'Failed to accept friend request'));
        }
    }, [friendshipStatus.friendship?.id, acceptFriendRequest, onUpdate]);

    const handleRejectRequest = useCallback(async () => {
        if (!friendshipStatus.friendship?.id) return;

        try {
            setActionError(null);
            await rejectFriendRequest(friendshipStatus.friendship.id);
            onUpdate();
        } catch (error) {
            console.error('Failed to reject friend request:', error);
            setActionError(errorMessage(error, 'Failed to reject friend request'));
        }
    }, [friendshipStatus.friendship?.id, rejectFriendRequest, onUpdate]);

    const handleCancelRequest = useCallback(async () => {
        if (!friendshipStatus.friendship?.id) return;

        try {
            setActionError(null);
            await cancelFriendRequest(friendshipStatus.friendship.id);
            onUpdate();
        } catch (error) {
            console.error('Failed to cancel friend request:', error);
            setActionError(errorMessage(error, 'Failed to cancel friend request'));
        }
    }, [friendshipStatus.friendship?.id, cancelFriendRequest, onUpdate]);

    const handleRemoveFriend = useCallback(async () => {
        if (!friendshipStatus.friendship?.id) return;

        const confirmed = window.confirm(`Are you sure you want to remove ${user.username} from your friends?`);
        if (!confirmed) return;

        try {
            setActionError(null);
            await removeFriend(friendshipStatus.friendship.id);
            onUpdate();
        } catch (error) {
            console.error('Failed to remove friend:', error);
            setActionError(errorMessage(error, 'Failed to remove friend'));
        }
    }, [friendshipStatus.friendship?.id, user.username, removeFriend, onUpdate]);

    const handleViewProfile = useCallback(() => {
        window.location.href = `/profile/${user.id}`;
    }, [user.id]);

    // Memoize rank icon calculation
    const rankIcon = useMemo(() => {
        const elo = user.eloRating || 1200;
        if (elo >= 2000) return '👑';
        if (elo >= 1800) return '💎';
        if (elo >= 1600) return '🏆';
        if (elo >= 1400) return '🥈';
        if (elo >= 1200) return '🥉';
        return '🆕';
    }, [user.eloRating]);

    const { friendship, isOutgoingRequest, isIncomingRequest, isFriend } = friendshipStatus;

    return (
        <div className="card hover:border-purple-500/50 transition-all duration-200">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center text-lg font-bold text-white">
                    {user.username?.charAt(0).toUpperCase() || '?'}
                </div>

                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">
                        {user.username || 'Unknown User'}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <span>{rankIcon}</span>
                        <span>Level {user.level || 1}</span>
                    </div>
                </div>

                {isFriend && (
                    <span className="badge badge-green text-xs">Friend</span>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center">
                    <div className="text-lg font-bold text-purple-400">
                        {user.eloRating || 1200}
                    </div>
                    <div className="text-xs text-slate-400">ELO</div>
                </div>

                <div className="text-center">
                    <div className="text-lg font-bold text-blue-400">
                        {user.level || 1}
                    </div>
                    <div className="text-xs text-slate-400">Level</div>
                </div>

                <div className="text-center">
                    <div className="text-lg font-bold text-green-400">
                        {user.gamesPlayed || 0}
                    </div>
                    <div className="text-xs text-slate-400">Games</div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                <Button
                    onClick={handleViewProfile}
                    variant="outline"
                    size="small"
                    className="flex-1"
                >
                    View Profile
                </Button>

                {/* Friend Actions */}
                {!friendship ? (
                    <Button
                        onClick={handleSendFriendRequest}
                        variant="primary"
                        size="small"
                        disabled={isSending}
                        isLoading={isSending}
                    >
                        Add Friend
                    </Button>
                ) : isIncomingRequest ? (
                    <div className="flex gap-1">
                        <Button
                            onClick={handleAcceptRequest}
                            variant="success"
                            size="small"
                            disabled={isAccepting}
                            isLoading={isAccepting}
                        >
                            ✓
                        </Button>
                        <Button
                            onClick={handleRejectRequest}
                            variant="danger"
                            size="small"
                            disabled={isRejecting}
                            isLoading={isRejecting}
                        >
                            ✗
                        </Button>
                    </div>
                ) : isOutgoingRequest ? (
                    <Button
                        onClick={handleCancelRequest}
                        variant="outline"
                        size="small"
                        disabled={isCanceling}
                        isLoading={isCanceling}
                        className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-900/20"
                    >
                        Pending
                    </Button>
                ) : isFriend ? (
                    <Button
                        onClick={handleRemoveFriend}
                        variant="outline"
                        size="small"
                        disabled={isRemoving}
                        isLoading={isRemoving}
                        className="border-red-500/50 text-red-400 hover:bg-red-900/20"
                    >
                        Remove
                    </Button>
                ) : null}
            </div>

            {actionError && (
                <p role="alert" className="text-red-400 text-sm mt-2">{actionError}</p>
            )}
        </div>
    );
});

UserCard.displayName = 'UserCard';