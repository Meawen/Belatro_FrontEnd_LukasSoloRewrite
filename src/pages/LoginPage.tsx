import { AuthPage } from '../components/auth/AuthPage';
import { usePageTitle } from '../routing/usePageTitle';
import { useT } from '../i18n/t';

/** /login (spec §4.2), behind PublicRoute. Phase 6 owns this module. */
export function LoginPage() {
    const t = useT();
    usePageTitle(t.titles.signIn);
    return <AuthPage initialMode="login" redirectTo="/dashboard" />;
}
