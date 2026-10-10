import { ForgotPasswordPage as ForgotPassword } from '../components/auth/ForgotPasswordPage';
import { usePageTitle } from '../routing/usePageTitle';

/** /forgot-password (spec §4.3), reachable signed in or out. Phase 6 owns this module. */
export function ForgotPasswordPage() {
    usePageTitle('Forgot password');
    return <ForgotPassword />;
}
