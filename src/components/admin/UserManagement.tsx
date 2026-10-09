import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Loading, Modal } from '../common';
import { useAdmin } from '../../hooks/useAdmin';
import { useAuth } from '../../hooks/useAuth';
import type { UserDto } from '../../types/user';

export const UserManagement: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState<UserDto | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [sortBy, setSortBy] = useState<'username' | 'email'>('username');

    const { users, isLoading, error, forgetUser, refetch, isForgettingUser } = useAdmin();
    const { user: currentUser } = useAuth();
    const navigate = useNavigate();

    // Filter and sort users
    const filteredUsers = React.useMemo(() => {
        if (!users) return [];

        let filtered = users.filter((user: UserDto) => {
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                return user.username?.toLowerCase().includes(term) ||
                    user.email?.toLowerCase().includes(term) ||
                    user.id?.toLowerCase().includes(term);
            }
            return true;
        });

        filtered.sort((a: UserDto, b: UserDto) => {
            switch (sortBy) {
                case 'username':
                    return (a.username || '').localeCompare(b.username || '');
                case 'email':
                    return (a.email || '').localeCompare(b.email || '');
                default:
                    return 0;
            }
        });

        return filtered;
    }, [users, searchTerm, sortBy]);

    const handleForgetUser = async () => {
        if (!selectedUser?.id) return;

        try {
            await forgetUser(selectedUser.id);
            setShowConfirmModal(false);
            setSelectedUser(null);
        } catch (error) {
            console.error('Failed to forget user:', error);
        }
    };

    const getRoleDisplay = (roles: string[] | null) => {
        if (!roles || roles.length === 0) return 'User';
        return roles.map(role => role.replace('ROLE_', '')).join(', ');
    };

    const getStatusIndicator = (user: UserDto) => {
        if (user.deletionRequested) {
            return <span className="badge badge-red text-xs">Deletion Requested</span>;
        }

        return <span className="badge badge-gray text-xs">Active</span>;
    };

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
                        <p className="text-red-300 text-sm">Failed to load user management</p>
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
        <div className="card">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-semibold text-white">User Management</h2>
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
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                    <Input
                        type="text"
                        placeholder="Search by username, email, or ID..."
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
                        Username
                    </button>
                    <button
                        onClick={() => setSortBy('email')}
                        className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                            sortBy === 'email'
                                ? 'bg-purple-600 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                    >
                        Email
                    </button>
                </div>
            </div>

            {/* Users Table */}
            {filteredUsers.length === 0 ? (
                <div className="text-center py-12">
                    <div className="text-slate-500 text-6xl mb-4">👥</div>
                    <h3 className="text-xl font-semibold text-white mb-2">No Users Found</h3>
                    <p className="text-slate-400">
                        {searchTerm ? 'No users match your search criteria.' : 'No users available.'}
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                        <tr className="border-b border-slate-700">
                            <th className="text-left p-3 text-slate-400 font-medium">User</th>
                            <th className="text-left p-3 text-slate-400 font-medium">Email</th>
                            <th className="text-left p-3 text-slate-400 font-medium">Role</th>
                            <th className="text-left p-3 text-slate-400 font-medium">Status</th>
                            <th className="text-left p-3 text-slate-400 font-medium">Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {filteredUsers.map((user: UserDto) => (
                            <tr key={user.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                                <td className="p-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center text-sm font-bold text-white">
                                            {user.username?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                        <div>
                                            <div className="text-white font-medium">
                                                {user.username || 'Unknown'}
                                                {user.id === currentUser?.id && (
                                                    <span className="ml-2 badge badge-blue text-xs">You</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500">ID: {user.id}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-3 text-slate-300">{user.email || 'N/A'}</td>
                                <td className="p-3">
                    <span className="badge badge-purple text-xs">
                      {getRoleDisplay(user.roles)}
                    </span>
                                </td>
                                <td className="p-3">{getStatusIndicator(user)}</td>
                                <td className="p-3">
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={() => navigate(`/profile/${user.id}`)}
                                            variant="outline"
                                            size="small"
                                        >
                                            View
                                        </Button>
                                        {user.id !== currentUser?.id && (
                                            <Button
                                                onClick={() => {
                                                    setSelectedUser(user);
                                                    setShowConfirmModal(true);
                                                }}
                                                variant="danger"
                                                size="small"
                                                disabled={isForgettingUser}
                                            >
                                                Delete
                                            </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Confirm Delete Modal */}
            <Modal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                title="Confirm User Deletion"
            >
                {selectedUser && (
                    <div className="space-y-4">
                        <div className="bg-red-900/20 p-4 rounded border border-red-500/30">
                            <h4 className="text-red-400 font-semibold mb-2">⚠️ Warning</h4>
                            <p className="text-red-300 text-sm">
                                Delete the account of{' '}
                                <strong>{selectedUser.username}</strong>? This cannot be undone.
                            </p>
                            {/* What AdminService.forgetUser removes (R-40); the rest is the owner's manual 30-day process */}
                            <p className="text-red-300 text-sm mt-2">
                                Deletes the user record; friendships, match history and rank history remain.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                onClick={() => setShowConfirmModal(false)}
                                variant="outline"
                                className="flex-1"
                                disabled={isForgettingUser}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleForgetUser}
                                variant="danger"
                                className="flex-1"
                                isLoading={isForgettingUser}
                            >
                                Delete User
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};