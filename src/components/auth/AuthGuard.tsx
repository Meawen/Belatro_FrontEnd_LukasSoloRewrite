
import React from 'react';
import { useAuth } from '../../hooks';
import { Loading } from '../common';

export interface AuthGuardProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    requireAdmin?: boolean;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
                                                        children,
                                                        fallback,
                                                        requireAdmin = false,
                                                    }) => {
    const { user, isLoading, isAuthenticated } = useAuth();

    if (isLoading) {
        return <Loading size="large" text="Checking authentication..." fullScreen />;
    }

    if (!isAuthenticated) {
        return fallback || (
            <div className="card max-w-md mx-auto mt-8 text-center">
                <div className="text-yellow-500 text-6xl mb-4">🔒</div>
                <h2 className="text-xl font-semibold text-white mb-2">Authentication Required</h2>
                <p className="text-slate-400">Please sign in to access this content.</p>
            </div>
        );
    }

    if (requireAdmin && user && !user.roles?.some(role => role === 'ROLE_ADMIN')) {
        return (
            <div className="card max-w-md mx-auto mt-8 text-center">
                <div className="text-red-500 text-6xl mb-4">⛔</div>
                <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
                <p className="text-slate-400">You don't have permission to access this content.</p>
            </div>
        );
    }

    return <>{children}</>;
};