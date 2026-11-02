import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { NeedsAccountPage, type LockedArea } from '../pages/NeedsAccountPage';

/**
 * A member-only page (spec §3.3). A guest gets the "needs an account" page for it, anyone else the page. It sits inside
 * ProtectedRoute, which has already sent a signed-out visitor to /login. Nothing renders while the stored session is
 * read, so a member page never mounts (and asks the server) for a guest.
 */
export function MemberRoute({ area, children }: { area: LockedArea; children: ReactNode }) {
    const { isGuest, isLoading } = useAuth();
    if (isLoading) return null;
    return isGuest ? <NeedsAccountPage area={area} /> : <>{children}</>;
}
