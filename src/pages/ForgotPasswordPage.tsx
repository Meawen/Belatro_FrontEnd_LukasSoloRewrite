import { ForgotPasswordPage as ForgotPassword } from '../components/auth/ForgotPasswordPage';
import { usePageTitle } from '../routing/usePageTitle';
import { useT } from '../i18n/t';

/** /forgot-password (spec §4.3), reachable signed in or out. Phase 6 owns this module. */
export function ForgotPasswordPage() {
    const t = useT();
    usePageTitle(t.titles.forgotPassword);
    return <ForgotPassword />;
}
