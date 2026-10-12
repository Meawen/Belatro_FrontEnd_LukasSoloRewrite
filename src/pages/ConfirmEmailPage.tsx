import { ConfirmEmailPage as ConfirmEmail } from '../components/auth/ConfirmEmailPage';
import { usePageTitle } from '../routing/usePageTitle';

/** /confirm-email?token=… (spec §4.3), reachable signed in or out. Phase 6 owns this module. */
export function ConfirmEmailPage() {
    usePageTitle('Confirm email');
    return <ConfirmEmail />;
}
