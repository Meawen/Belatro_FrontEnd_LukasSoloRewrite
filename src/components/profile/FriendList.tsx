
import React, { useState, useMemo, useCallback } from 'react';
import { Button, Loading, Input } from '../common';
import { useFriends } from '../../hooks/useFriends';
import { useAuth } from '../../hooks/useAuth';
import type { Friendship } from '../../types/friendship';

export const FriendsList: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'friends' | 'pending' | 'sent'>('friends');
    const [searchTerm, setSearchTerm] = useState('');

    const { user: currentUser } = useAuth();
    const {
        friendships,
        isLoading,
        error,
        acceptFriendRequest,
        rejectFriendRequest,
        cancelFriendRequest,
        removeFriend,
        refetch,
        isAccepting,
        isRejecting,
        isCanceling,
        isRemoving
    } = useFriends(currentUser?.id || undefined);

    // Memoize filtered friendships to prevent unnecessary recalculations
    const filteredFriendships = useMemo(() => {
        if (!friendships || !currentUser?.id) return [];

        let filtered = friendships.filter((friendship: Friendship) => {
            switch (activeTab) {
                case 'friends':
                    return friendship.status === 'ACCEPTED';
                case 'pending':
                    return friendship.status === 'PENDING' && friendship.toUser?.id === currentUser.id;
                case 'sent':
                    return friendship.status === 'PENDING' && friendship.fromUser?.id === currentUser.id;
                default:
                    return false;
            }
        });

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter((friendship: Friendship) => {
                const otherUser = friendship.fromUser?.id === currentUser.id
                    ? friendship.toUser
                    : friendship.fromUser;
                return otherUser?.username?.toLowerCase().includes(term);
            });
        }

        return filtered;
    }, [friendships, activeTab, currentUser?.id, searchTerm]);

    // Memoize counts to prevent unnecessary recalculations
    const counts = useMemo(() => {
        if (!friendships || !currentUser?.id) {
            return { friends: 0, pending: 0, sent: 0 };
        }

        return {
            friends: friendships.filter((f: Friendship) => f.status === 'ACCEPTED').length,
            pending: friendships.filter((f: Friendship) =>
                f.status === 'PENDING' && f.toUser?.id === currentUser.id
            ).length,
            sent: friendships.filter((f: Friendship) =>
                f.status === 'PENDING' && f.fromUser?.id === currentUser.id
            ).length,
        };
    }, [friendships, currentUser?.id]);

    // Memoize handlers to prevent unnecessary re-renders
    const handleAccept = useCallback(async (friendshipId: string) => {
        try {
            await acceptFriendRequest(friendshipId);
        } catch (error) {
            console.error('Failed to accept friend request:', error);
        }
    }, [acceptFriendRequest]);

    const handleReject = useCallback(async (friendshipId: string) => {
        try {
            await rejectFriendRequest(friendshipId);
        } catch (error) {
            console.error('Failed to reject friend request:', error);
        }
    }, [rejectFriendRequest]);

    const handleCancel = useCallback(async (friendshipId: string) => {
        try {
            await cancelFriendRequest(friendshipId);
        } catch (error) {
            console.error('Failed to cancel friend request:', error);
        }
    }, [cancelFriendRequest]);

    const handleRemove = useCallback(async (friendshipId: string, username: string) => {
        const confirmed = window.confirm(`Are you sure you want to remove ${username} from your friends?`);
        if (!confirmed) return;

        try {
            await removeFriend(friendshipId);
        } catch (error) {
            console.error('Failed to remove friend:', error);
        }
    }, [removeFriend]);

    const handleViewProfile = useCallback((userId: string) => {
        window.location.href = `/profile/${userId}`;
    }, []);

    if (isLoading && !friendships.length) {
        return <Loading size="large" text="Loading friends..." />;
    }

    if (error && !friendships.length) {
        return (
            <div className="card bg-red-900/20 border-red-500/30">
                <div className="flex items-center gap-3">
                    <div className="text-red-400 text-2xl">!</div>
                    <div>
                        <h3 className="text-red-400 font-semibold">Error Loading Friends</h3>
                        <p className="text-red-300 text-sm">Failed to load friends list</p>
                    </div>
                </div>
                <Button
                    onClick={refetch}
                    variant="outline"
                    size="small"
                    className="mt-4"
                >
                    Try Again
                </Button>
            </div>
        );
    }

    // Icon components to replace emojis
    const RefreshIcon = () => (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
    );

    const UsersIcon = () => (
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
    );

    const InboxIcon = () => (
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
    );

    const SendIcon = () => (
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
    );

    const EmptyStateIcon = ({ type }: { type: 'friends' | 'pending' | 'sent' }) => {
        const iconClass = "w-16 h-16 text-slate-500 mx-auto mb-4";

        if (type === 'friends') {
            return (
                <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
            );
        }

        if (type === 'pending') {
            return (
                <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
            );
        }

        return (
            <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Friends</h2>
                    <p className="text-slate-400">Manage your friendships</p>
                </div>
                <Button
                    onClick={refetch}
                    variant="outline"
                    size="small"
                    disabled={isLoading}
                >
                    <RefreshIcon />
                    {isLoading ? 'Refreshing...' : 'Refresh'}
                </Button>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-4 border-b border-slate-700">
                <button
                    onClick={() => setActiveTab('friends')}
                    className={`pb-2 px-1 font-medium transition-colors flex items-center ${
                        activeTab === 'friends'
                            ? 'text-purple-400 border-b-2 border-purple-400'
                            : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <UsersIcon />
                    Friends ({counts.friends})
                </button>
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`pb-2 px-1 font-medium transition-colors flex items-center ${
                        activeTab === 'pending'
                            ? 'text-purple-400 border-b-2 border-purple-400'
                            : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <InboxIcon />
                    Requests ({counts.pending})
                </button>
                <button
                    onClick={() => setActiveTab('sent')}
                    className={`pb-2 px-1 font-medium transition-colors flex items-center ${
                        activeTab === 'sent'
                            ? 'text-purple-400 border-b-2 border-purple-400'
                            : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <SendIcon />
                    Sent ({counts.sent})
                </button>
            </div>

            {/* Search */}
            <div className="card">
                <Input
                    type="text"
                    placeholder="Search friends..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Loading indicator for updates */}
            {isLoading && friendships.length > 0 && (
                <div className="text-center py-2">
                    <span className="text-slate-400 text-sm flex items-center justify-center gap-2">
                        <RefreshIcon />
                        Updating...
                    </span>
                </div>
            )}

            {/* Friends List */}
            {filteredFriendships.length === 0 ? (
                <div className="card text-center py-12">
                    <EmptyStateIcon type={activeTab} />
                    <h3 className="text-xl font-semibold text-white mb-2">
                        {activeTab === 'friends' && 'No Friends Yet'}
                        {activeTab === 'pending' && 'No Pending Requests'}
                        {activeTab === 'sent' && 'No Sent Requests'}
                    </h3>
                    <p className="text-slate-400">
                        {activeTab === 'friends' && 'Start adding friends to see them here!'}
                        {activeTab === 'pending' && 'Friend requests will appear here.'}
                        {activeTab === 'sent' && 'Your sent friend requests will appear here.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredFriendships.map((friendship: Friendship) => {
                        const otherUser = friendship.fromUser?.id === currentUser?.id
                            ? friendship.toUser
                            : friendship.fromUser;

                        if (!otherUser || !friendship.id) return null;

                        return (
                            <FriendCard
                                key={friendship.id}
                                friendship={friendship}
                                otherUser={otherUser}
                                activeTab={activeTab}
                                onAccept={handleAccept}
                                onReject={handleReject}
                                onCancel={handleCancel}
                                onRemove={handleRemove}
                                onViewProfile={handleViewProfile}
                                isAccepting={isAccepting}
                                isRejecting={isRejecting}
                                isCanceling={isCanceling}
                                isRemoving={isRemoving}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// Separate component for friend card to prevent unnecessary re-renders
const FriendCard = React.memo<{
    friendship: Friendship;
    otherUser: any;
    activeTab: string;
    onAccept: (id: string) => void;
    onReject: (id: string) => void;
    onCancel: (id: string) => void;
    onRemove: (id: string, username: string) => void;
    onViewProfile: (id: string) => void;
    isAccepting: boolean;
    isRejecting: boolean;
    isCanceling: boolean;
    isRemoving: boolean;
}>(({
        friendship,
        otherUser,
        activeTab,
        onAccept,
        onReject,
        onCancel,
        onRemove,
        onViewProfile,
        isAccepting,
        isRejecting,
        isCanceling,
        isRemoving
    }) => {
    return (
        <div className="card">
            <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center text-lg font-bold text-white">
                    {otherUser.username?.charAt(0).toUpperCase() || '?'}
                </div>

                {/* User Info */}
                <div className="flex-1">
                    <h4 className="text-lg font-semibold text-white">
                        {otherUser.username || 'Unknown User'}
                    </h4>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span>ELO: {otherUser.eloRating || 1200}</span>
                        <span>Level: {otherUser.level || 1}</span>
                        {friendship.createdAt && (
                            <span>
                                {activeTab === 'friends' ? 'Friends since' : 'Requested'}: {' '}
                                {new Date(friendship.createdAt).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <Button
                        onClick={() => onViewProfile(otherUser.id)}
                        variant="outline"
                        size="small"
                    >
                        View Profile
                    </Button>

                    {activeTab === 'friends' && (
                        <Button
                            onClick={() => onRemove(friendship.id!, otherUser.username || 'user')}
                            variant="outline"
                            size="small"
                            disabled={isRemoving}
                            isLoading={isRemoving}
                            className="border-red-500/50 text-red-400 hover:bg-red-900/20"
                        >
                            Remove
                        </Button>
                    )}

                    {activeTab === 'pending' && (
                        <>
                            <Button
                                onClick={() => onAccept(friendship.id!)}
                                variant="success"
                                size="small"
                                disabled={isAccepting}
                                isLoading={isAccepting}
                            >
                                Accept
                            </Button>
                            <Button
                                onClick={() => onReject(friendship.id!)}
                                variant="danger"
                                size="small"
                                disabled={isRejecting}
                                isLoading={isRejecting}
                            >
                                Decline
                            </Button>
                        </>
                    )}

                    {activeTab === 'sent' && (
                        <Button
                            onClick={() => onCancel(friendship.id!)}
                            variant="outline"
                            size="small"
                            disabled={isCanceling}
                            isLoading={isCanceling}
                            className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-900/20"
                        >
                            Cancel
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
});

FriendCard.displayName = 'FriendCard';