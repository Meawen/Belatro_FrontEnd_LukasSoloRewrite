import React, { useState, useCallback, useMemo } from 'react';
import { UserCard } from './UserCard';
import { Loading, Button, Input } from '../common';
import { useAllUsers, useUser } from '../../hooks/useUser';
import { useAuth } from '../../hooks/useAuth';
import type { User } from '../../types/user';

export interface UserListProps {
    showOnlyOnline?: boolean;
}

export const UserList: React.FC<UserListProps> = ({
                                                      showOnlyOnline = false
                                                  }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'username' | 'eloRating' | 'level'>('username');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const { data: users, isLoading, error, refetch } = useAllUsers();
    const { user: authUser, isAuthenticated } = useAuth();

    // Fetch the full user data for the current user with caching
    const { user: currentUserFull } = useUser(authUser?.id || undefined);

    // Debounced search handler
    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    }, []);

    // Memoized filtered users with error handling
    const filteredUsers = useMemo(() => {
        if (!users || !Array.isArray(users)) return [];

        try {
            let filtered = users.filter((user: User) => {
                // Safety check for user object
                if (!user || typeof user !== 'object') return false;

                // Exclude current user
                if (user.id === authUser?.id) return false;

                // Online filter (placeholder - you'd need actual online status)
                if (showOnlyOnline) {
                    // This would need actual online status from your backend
                    // For now, we'll assume all users are potentially online
                    return true;
                }

                // Search filter with null safety
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    const username = user.username?.toLowerCase() || '';
                    return username.includes(term);
                }

                return true;
            });

            // Sort users with null safety
            filtered.sort((a: User, b: User) => {
                try {
                    switch (sortBy) {
                        case 'username':
                            return (a.username || '').localeCompare(b.username || '');
                        case 'eloRating':
                            return (b.eloRating || 0) - (a.eloRating || 0);
                        case 'level':
                            return (b.level || 0) - (a.level || 0);
                        default:
                            return 0;
                    }
                } catch (err) {
                    console.warn('Error sorting users:', err);
                    return 0;
                }
            });

            return filtered;
        } catch (err) {
            console.error('Error filtering users:', err);
            return [];
        }
    }, [users, authUser?.id, searchTerm, sortBy, showOnlyOnline]);

    // Handle refresh with rate limiting
    const handleRefresh = useCallback(async () => {
        if (isRefreshing) return;

        setIsRefreshing(true);
        try {
            await refetch();
        } catch (err) {
            console.error('Refresh failed:', err);
        } finally {
            // Rate limit refreshes to prevent spamming
            setTimeout(() => setIsRefreshing(false), 3000);
        }
    }, [refetch, isRefreshing]);

    const clearSearch = useCallback(() => {
        setSearchTerm('');
    }, []);

    // Icon components to replace emojis
    const LockIcon = () => (
        <svg className="w-16 h-16 text-slate-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-9a2 2 0 00-2-2H9V6a3 3 0 116 0v4a2 2 0 002 2v9a2 2 0 01-2 2z" />
        </svg>
    );

    const WarningIcon = () => (
        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
    );

    const UsersIcon = () => (
        <svg className="w-16 h-16 text-slate-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
    );

    const RefreshIcon = ({ isSpinning = false }: { isSpinning?: boolean }) => (
        <svg className={`w-4 h-4 mr-1 ${isSpinning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
    );

    const LoadingIcon = () => (
        <svg className="w-4 h-4 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
    );

    // Don't render if not authenticated (but allow viewing leaderboard)
    if (!isAuthenticated && showOnlyOnline) {
        return (
            <div className="card text-center py-12">
                <LockIcon />
                <h3 className="text-xl font-semibold text-white mb-2">Authentication Required</h3>
                <p className="text-slate-400">Please log in to view online users.</p>
            </div>
        );
    }

    if (isLoading && !users) {
        return <Loading size="large" text="Loading users..." />;
    }

    if (error) {
        return (
            <div className="card bg-red-900/20 border-red-500/30">
                <div className="flex items-center gap-3">
                    <WarningIcon />
                    <div>
                        <h3 className="text-red-400 font-semibold">Error Loading Users</h3>
                        <p className="text-red-300 text-sm">
                            {error instanceof Error ? error.message : 'Failed to load user list'}
                        </p>
                    </div>
                </div>
                <Button
                    onClick={handleRefresh}
                    variant="outline"
                    size="small"
                    className="mt-4"
                    disabled={isRefreshing}
                >
                    {isRefreshing ? 'Retrying...' : 'Try Again'}
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">
                        {showOnlyOnline ? 'Online Users' : 'Leaderboard'}
                    </h2>
                    <p className="text-slate-400">
                        {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'} found
                    </p>
                </div>
                <Button
                    onClick={handleRefresh}
                    variant="outline"
                    size="small"
                    disabled={isRefreshing || isLoading}
                >
                    {isRefreshing ? (
                        <>
                            <LoadingIcon />
                            Refreshing...
                        </>
                    ) : (
                        <>
                            <RefreshIcon />
                            Refresh
                        </>
                    )}
                </Button>
            </div>

            {/* Filters */}
            <div className="card">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <Input
                            type="text"
                            placeholder="Search users by username..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                        />
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setSortBy('username')}
                            className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                                sortBy === 'username'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                        >
                            Name
                        </button>
                        <button
                            onClick={() => setSortBy('eloRating')}
                            className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                                sortBy === 'eloRating'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                        >
                            ELO
                        </button>
                        <button
                            onClick={() => setSortBy('level')}
                            className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                                sortBy === 'level'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                        >
                            Level
                        </button>
                    </div>
                </div>
            </div>

            {/* Loading indicator for refresh */}
            {isLoading && users && (
                <div className="text-center py-2">
                    <span className="text-slate-400 text-sm flex items-center justify-center gap-2">
                        <RefreshIcon isSpinning />
                        Loading users...
                    </span>
                </div>
            )}

            {/* Users Grid */}
            {filteredUsers.length === 0 ? (
                <div className="card text-center py-12">
                    <UsersIcon />
                    <h3 className="text-xl font-semibold text-white mb-2">No Users Found</h3>
                    <p className="text-slate-400 mb-6">
                        {searchTerm ? 'No users match your search criteria.' : 'No users available.'}
                    </p>
                    {searchTerm && (
                        <Button
                            onClick={clearSearch}
                            variant="outline"
                        >
                            Clear Search
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredUsers.map((user: User) => (
                        <UserCard
                            key={user.id || Math.random()}
                            user={user}
                            currentUser={currentUserFull}
                            onUpdate={handleRefresh}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};