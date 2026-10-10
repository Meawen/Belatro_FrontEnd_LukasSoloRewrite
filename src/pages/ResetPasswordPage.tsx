import { ResetPasswordPage as ResetPassword } from '../components/auth/ResetPasswordPage';
import { usePageTitle } from '../routing/usePageTitle';

/** /reset-password?token=… (spec §4.3), reachable signed in or out. Phase 6 owns this module. */
export function ResetPasswordPage() {
    usePageTitle('Reset password');
    return <ResetPassword />;
}
