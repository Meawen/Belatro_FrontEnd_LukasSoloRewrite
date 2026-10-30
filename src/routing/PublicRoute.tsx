import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loader } from '../components/ui';
import { useT } from '../i18n/t';

/** The sign-in and sign-up pages: a visitor who is already signed in goes to /dashboard. */
export function PublicRoute({ children }: { children: ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();
    const t = useT();

    if (isLoading) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-bg">
                <Loader layout="page" text={t.common.loading} />
            </div>
        );
    }

    return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}
