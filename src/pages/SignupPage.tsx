import { AuthPage } from '../components/auth/AuthPage';
import { usePageTitle } from '../routing/usePageTitle';
import { useT } from '../i18n/t';

/** /signup (spec §4.2), behind PublicRoute. Phase 6 owns this module. */
export function SignupPage() {
    const t = useT();
    usePageTitle(t.titles.signUp);
    return <AuthPage initialMode="signup" redirectTo="/dashboard" />;
}
