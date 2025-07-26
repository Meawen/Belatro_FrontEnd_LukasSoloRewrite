import React, { useState } from 'react';
import { UserCard } from './UserCard';
import { Loading, Button, Input } from '../common';
import { useAllUsers } from '../../hooks/useUser';
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

    const { data: users, isLoading, error, refetch } = useAllUsers();
    const { user: currentUser } = useAuth();

    // Filter and sort users
    const filteredUsers = React.useMemo(() => {
        if (!users) return [];

        let filtered = users.filter((user: User) => {
            // Exclude current user
            if (user.id === currentUser?.id) return false;

            // Online filter (placeholder - you'd need actual online status)
            if (showOnlyOnline) {
                // This would need actual online status from your backend
                // For now, we'll assume all users are potentially online
                return true;
            }

            // Search filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                return user.username?.toLowerCase().includes(term) ||
                    user.email?.toLowerCase().includes(term);
            }

            return true;
        });

        // Sort users
        filtered.sort((a: User, b: User) => {
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
        });

        return filtered;
    }, [users, currentUser?.id, searchTerm, sortBy, showOnlyOnline]);

    if (isLoading) {
        return <Loading size="large" text="Loading users..." />;
    }

    if (error) {
        return (
            <div className="card bg-red-900/20 border-red-500/30">
                <div className="flex items-center gap-3">
                    <div className="text-red-400 text-2xl">⚠️</div>
                    <div>
                        <h3 className="text-red-400 font-semibold">Error Loading Users</h3>
                        <p className="text-red-300 text-sm">Failed to load user list</p>
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">
                        {showOnlyOnline ? 'Online Users' : 'All Users'}
                    </h2>
                    <p className="text-slate-400">
                        {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'} found
                    </p>
                </div>
                <Button
                    onClick={refetch}
                    variant="outline"
                    size="small"
                >
                    🔄 Refresh
                </Button>
            </div>

            {/* Filters */}
            <div className="card">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <Input
                            type="text"
                            placeholder="Search users by username or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
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

            {/* Users Grid */}
            {filteredUsers.length === 0 ? (
                <div className="card text-center py-12">
                    <div className="text-slate-500 text-6xl mb-4">👥</div>
                    <h3 className="text-xl font-semibold text-white mb-2">No Users Found</h3>
                    <p className="text-slate-400 mb-6">
                        {searchTerm ? 'No users match your search criteria.' : 'No users available.'}
                    </p>
                    {searchTerm && (
                        <Button
                            onClick={() => setSearchTerm('')}
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
                            key={user.id}
                            user={user}
                            currentUser={currentUser}
                            onUpdate={refetch}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};