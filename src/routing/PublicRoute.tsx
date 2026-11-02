import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loader } from '../components/ui';
import { useT } from '../i18n/t';

/** The sign-in and sign-up pages: a member who is signed in already goes to /dashboard; a guest may sign in or sign up (spec §3.3). */
export function PublicRoute({ children }: { children: ReactNode }) {
    const { isAuthenticated, isGuest, isLoading } = useAuth();
    const t = useT();

    if (isLoading) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-bg">
                <Loader layout="page" text={t.common.loading} />
            </div>
        );
    }

    return isAuthenticated && !isGuest ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}
