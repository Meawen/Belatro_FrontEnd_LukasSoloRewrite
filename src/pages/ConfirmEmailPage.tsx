import { ConfirmEmailPage as ConfirmEmail } from '../components/auth/ConfirmEmailPage';
import { usePageTitle } from '../routing/usePageTitle';
import { useT } from '../i18n/t';

/** /confirm-email?token=… (spec §4.3), reachable signed in or out. Phase 6 owns this module. */
export function ConfirmEmailPage() {
    const t = useT();
    usePageTitle(t.titles.confirmEmail);
    return <ConfirmEmail />;
}
