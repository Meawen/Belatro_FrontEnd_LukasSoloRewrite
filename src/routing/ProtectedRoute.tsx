import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loader } from '../components/ui';
import { useT } from '../i18n/t';

/**
 * A signed-in page. A signed-out visitor goes to /login, which is handed the page they asked for as
 * navigation state `{ from }` (pathname + search), so signing in brings them back (D-20).
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();
    const { pathname, search } = useLocation();
    const t = useT();

    if (isLoading) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-bg">
                <Loader layout="page" text={t.shell.checkingSession} />
            </div>
        );
    }

    return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace state={{ from: pathname + search }} />;
}
