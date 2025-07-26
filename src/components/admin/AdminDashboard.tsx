import React from 'react';
import { AdminStats } from './AdminStats';
import { UserManagement } from './UserManagement';
import { SystemStatus } from './SystemStatus';
import { useAuth } from '../../hooks/useAuth';

export const AdminDashboard: React.FC = () => {
    const { user } = useAuth();

    // Check if user has admin role
    const isAdmin = user?.roles?.includes('ROLE_ADMIN');

    if (!isAdmin) {
        return (
            <div className="card bg-red-900/20 border-red-500/30 text-center py-12">
                <div className="text-red-400 text-6xl mb-4">🚫</div>
                <h2 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h2>
                <p className="text-red-300">You don't have permission to access the admin panel.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
                    <p className="text-slate-400">System management and monitoring</p>
                </div>
                <div className="badge badge-purple">
                    👑 Administrator
                </div>
            </div>

            {/* Stats Overview */}
            <AdminStats />

            {/* System Status */}
            <SystemStatus />

            {/* User Management */}
            <UserManagement />
        </div>
    );
};