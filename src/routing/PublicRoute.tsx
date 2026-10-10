import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loader } from '../components/ui';

/** The sign-in and sign-up pages: a visitor who is already signed in goes to /dashboard. */
export function PublicRoute({ children }: { children: ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-bg">
                <Loader layout="page" text="Loading..." />
            </div>
        );
    }

    return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}
