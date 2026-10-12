import { AuthPage } from '../components/auth/AuthPage';
import { usePageTitle } from '../routing/usePageTitle';

/** /login (spec §4.2), behind PublicRoute. Phase 6 owns this module. */
export function LoginPage() {
    usePageTitle('Sign in');
    return <AuthPage initialMode="login" redirectTo="/dashboard" />;
}
