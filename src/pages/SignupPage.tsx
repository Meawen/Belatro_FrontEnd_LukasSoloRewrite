import { AuthPage } from '../components/auth/AuthPage';
import { usePageTitle } from '../routing/usePageTitle';

/** /signup (spec §4.2), behind PublicRoute. Phase 6 owns this module. */
export function SignupPage() {
    usePageTitle('Sign up');
    return <AuthPage initialMode="signup" redirectTo="/dashboard" />;
}
