import { ResetPasswordPage as ResetPassword } from '../components/auth/ResetPasswordPage';
import { usePageTitle } from '../routing/usePageTitle';
import { useT } from '../i18n/t';

/** /reset-password?token=… (spec §4.3), reachable signed in or out. Phase 6 owns this module. */
export function ResetPasswordPage() {
    const t = useT();
    usePageTitle(t.titles.resetPassword);
    return <ResetPassword />;
}
