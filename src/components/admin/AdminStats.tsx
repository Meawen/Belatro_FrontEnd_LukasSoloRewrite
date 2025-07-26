import React from 'react';
import { Loading } from '../common';
import { useAllUsers } from '../../hooks/useUser';
import { useLobbies } from '../../hooks/useLobby';
import { useAdmin } from '../../hooks/useAdmin';
import type { UserDto } from '../../types/user';

export const AdminStats: React.FC = () => {
    const { data: allUsers, isLoading: allUsersLoading } = useAllUsers();
    const { users: adminUsers, isLoading: adminUsersLoading } = useAdmin();
    const { lobbies, isLoading: lobbiesLoading } = useLobbies();

    if (allUsersLoading || adminUsersLoading || lobbiesLoading) {
        return <Loading size="medium" text="Loading statistics..." />;
    }

    // Use allUsers for game stats, adminUsers for admin-specific stats
    const totalUsers = adminUsers?.length || 0;
    const activeUsers = allUsers?.filter(user =>
        user.lastLogin &&
        new Date(user.lastLogin) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length || 0;

    const pendingDeletions = adminUsers?.filter((user: UserDto) => user.deletionRequested).length || 0;
    const totalLobbies = Array.isArray(lobbies) ? lobbies.length : 0;
    const totalMatches = allUsers?.reduce((sum, user) => sum + (user.gamesPlayed || 0), 0) || 0;

    const stats = [
        {
            label: 'Total Users',
            value: totalUsers,
            icon: '👥',
            color: 'text-blue-400',
            bgColor: 'bg-blue-500/20'
        },
        {
            label: 'Active Users (24h)',
            value: activeUsers,
            icon: '🟢',
            color: 'text-green-400',
            bgColor: 'bg-green-500/20'
        },
        {
            label: 'Total Matches',
            value: totalMatches,
            icon: '🎮',
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/20'
        },
        {
            label: 'Active Lobbies',
            value: totalLobbies,
            icon: '🏠',
            color: 'text-yellow-400',
            bgColor: 'bg-yellow-500/20'
        },
        {
            label: 'Pending Deletions',
            value: pendingDeletions,
            icon: '🗑️',
            color: 'text-red-400',
            bgColor: 'bg-red-500/20'
        }
    ];

    return (
        <div className="card">
            <h2 className="text-xl font-semibold text-white mb-6">System Statistics</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {stats.map((stat, index) => (
                    <div key={index} className={`${stat.bgColor} p-4 rounded-lg`}>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">{stat.icon}</span>
                            <div className="flex-1">
                                <div className={`text-2xl font-bold ${stat.color}`}>
                                    {stat.value.toLocaleString()}
                                </div>
                                <div className="text-sm text-slate-400">{stat.label}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};