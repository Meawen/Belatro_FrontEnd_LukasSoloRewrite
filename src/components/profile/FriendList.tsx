import React, { useState } from 'react';
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

    // Filter friendships by type and search term
    const filteredFriendships = React.useMemo(() => {
        if (!friendships) return [];

        let filtered = friendships.filter((friendship: Friendship) => {
            switch (activeTab) {
                case 'friends':
                    return friendship.status === 'ACCEPTED';
                case 'pending':
                    return friendship.status === 'PENDING' && friendship.toUser?.id === currentUser?.id;
                case 'sent':
                    return friendship.status === 'PENDING' && friendship.fromUser?.id === currentUser?.id;
                default:
                    return false;
            }
        });

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter((friendship: Friendship) => {
                const otherUser = friendship.fromUser?.id === currentUser?.id
                    ? friendship.toUser
                    : friendship.fromUser;
                return otherUser?.username?.toLowerCase().includes(term);
            });
        }

        return filtered;
    }, [friendships, activeTab, currentUser?.id, searchTerm]);

    const handleAccept = async (friendshipId: string) => {
        try {
            await acceptFriendRequest(friendshipId);
        } catch (error) {
            console.error('Failed to accept friend request:', error);
        }
    };

    const handleReject = async (friendshipId: string) => {
        try {
            await rejectFriendRequest(friendshipId);
        } catch (error) {
            console.error('Failed to reject friend request:', error);
        }
    };

    const handleCancel = async (friendshipId: string) => {
        try {
            await cancelFriendRequest(friendshipId);
        } catch (error) {
            console.error('Failed to cancel friend request:', error);
        }
    };

    const handleRemove = async (friendshipId: string, username: string) => {
        const confirmed = window.confirm(`Are you sure you want to remove ${username} from your friends?`);
        if (!confirmed) return;

        try {
            await removeFriend(friendshipId);
        } catch (error) {
            console.error('Failed to remove friend:', error);
        }
    };

    if (isLoading) {
        return <Loading size="large" text="Loading friends..." />;
    }

    if (error) {
        return (
            <div className="card bg-red-900/20 border-red-500/30">
                <div className="flex items-center gap-3">
                    <div className="text-red-400 text-2xl">⚠️</div>
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

    const friendsCount = friendships.filter((f: Friendship) => f.status === 'ACCEPTED').length;
    const pendingCount = friendships.filter((f: Friendship) =>
        f.status === 'PENDING' && f.toUser?.id === currentUser?.id
    ).length;
    const sentCount = friendships.filter((f: Friendship) =>
        f.status === 'PENDING' && f.fromUser?.id === currentUser?.id
    ).length;

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
                >
                    🔄 Refresh
                </Button>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-4 border-b border-slate-700">
                <button
                    onClick={() => setActiveTab('friends')}
                    className={`pb-2 px-1 font-medium transition-colors ${
                        activeTab === 'friends'
                            ? 'text-purple-400 border-b-2 border-purple-400'
                            : 'text-slate-400 hover:text-white'
                    }`}
                >
                    👥 Friends ({friendsCount})
                </button>
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`pb-2 px-1 font-medium transition-colors ${
                        activeTab === 'pending'
                            ? 'text-purple-400 border-b-2 border-purple-400'
                            : 'text-slate-400 hover:text-white'
                    }`}
                >
                    📥 Requests ({pendingCount})
                </button>
                <button
                    onClick={() => setActiveTab('sent')}
                    className={`pb-2 px-1 font-medium transition-colors ${
                        activeTab === 'sent'
                            ? 'text-purple-400 border-b-2 border-purple-400'
                            : 'text-slate-400 hover:text-white'
                    }`}
                >
                    📤 Sent ({sentCount})
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

            {/* Friends List */}
            {filteredFriendships.length === 0 ? (
                <div className="card text-center py-12">
                    <div className="text-slate-500 text-6xl mb-4">
                        {activeTab === 'friends' ? '👥' : activeTab === 'pending' ? '📥' : '📤'}
                    </div>
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
                            <div key={friendship.id} className="card">
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
                                            onClick={() => window.location.href = `/profile/${otherUser.id}`}
                                            variant="outline"
                                            size="small"
                                        >
                                            View Profile
                                        </Button>

                                        {activeTab === 'friends' && (
                                            <Button
                                                onClick={() => handleRemove(friendship.id!, otherUser.username || 'user')}
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
                                                    onClick={() => handleAccept(friendship.id!)}
                                                    variant="success"
                                                    size="small"
                                                    disabled={isAccepting}
                                                    isLoading={isAccepting}
                                                >
                                                    Accept
                                                </Button>
                                                <Button
                                                    onClick={() => handleReject(friendship.id!)}
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
                                                onClick={() => handleCancel(friendship.id!)}
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
                    })}
                </div>
            )}
        </div>
    );
};