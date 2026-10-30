import { useId, useState } from 'react';
import { Button, Panel, PixelIcon, Sheet } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { ResendConfirmationButton } from '../auth/ResendConfirmationButton';
import { ChangeEmailForm } from './ChangeEmailForm';
import { ChangePasswordForm } from './ChangePasswordForm';
import { useMe, notifyMeChanged } from '../../hooks/useUser';
// direct module import (not the ../../hooks barrel) so the component test does
// not load every hook module, incl. the WebSocket ones
import { useMutation } from '../../hooks/useApi';
import { userService } from '../../services/userService';
import { errorMessage } from '../../utils/errorMessage';
import { cat, useT } from '../../i18n/t';

/**
 * Settings → Account (spec §4.13 item 2; D-32): the address, its confirmation, the change of address and of
 * password, and the deletion request, moved from the profile with every string and behaviour. The e-mail
 * links of the shell (X-11) lead here.
 */
export function AccountSection() {
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [showChangeEmail, setShowChangeEmail] = useState(false);
    const [emailNotice, setEmailNotice] = useState<string | null>(null);
    const [confirmingDeletion, setConfirmingDeletion] = useState(false);
    const [deletionError, setDeletionError] = useState<string | null>(null);
    const headingId = useId();
    const t = useT();

    const { data: me, refetch: refetchMe } = useMe();
    // no address at all (e.g. a new account that changed its password before confirming): resend has nothing to send
    const emailAction = me && !me.email && !me.pendingEmail ? t.settings.account.addEmail : t.settings.account.changeEmail;
    const requestForgetMutation = useMutation(() => userService.requestForget());

    const handleRequestDeletion = async () => {
        try {
            setDeletionError(null);
            await requestForgetMutation.mutate();
            setConfirmingDeletion(false);
            // useApi's refetch rethrows: a failed refresh is not a failed request, and nothing awaits it
            refetchMe().catch(() => {});
        } catch (error) {
            setDeletionError(errorMessage(error, cat().settings.account.deletionFailed));
        }
    };

    return (
        <Panel as="section" id="account" padding="lg" aria-labelledby={headingId} className="flex flex-col gap-5">
            <h2 id={headingId} className="t-title">
                {t.settings.account.heading}
            </h2>

            {emailNotice && (
                <p role="status" className="t-callout text-success">
                    {emailNotice}
                </p>
            )}

            {/* The address comes from GET /user/me (only your own account has one to show). */}
            {me && (
                <div className="flex flex-col gap-1">
                    <p className="t-caption text-text-2">{t.forms.email}</p>
                    <p className="t-body break-words">
                        {me.email || t.settings.account.notSet}
                        {me.email && !me.emailVerified && <span className="t-footnote ml-2 text-accent">{t.settings.account.notConfirmed}</span>}
                    </p>
                    {me.pendingEmail && (
                        <p data-testid="pending-email" className="t-footnote break-words text-accent">
                            {t.settings.account.pending(me.pendingEmail)}
                        </p>
                    )}
                    {(me.pendingEmail || (me.email && !me.emailVerified)) && (
                        <div className="mt-1">
                            {/* keyed on the pending address: a new one starts a fresh button, not a stale "nothing to confirm" */}
                            <ResendConfirmationButton key={me.pendingEmail ?? ''} onChangeEmail={() => setShowChangeEmail(true)} />
                        </div>
                    )}
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                <Button variant="secondary" leftIcon={<PixelIcon name="mail" />} onClick={() => setShowChangeEmail(true)}>
                    {emailAction}
                </Button>
                <Button variant="secondary" leftIcon={<PixelIcon name="lock" />} onClick={() => setShowChangePassword(true)}>
                    {t.settings.account.changePassword}
                </Button>
            </div>

            <div className="flex flex-col gap-3 border-t-2 border-edge pt-5">
                {me?.deletionRequested ? (
                    <p className="t-callout text-accent">{t.settings.account.deletionRequested}</p>
                ) : confirmingDeletion ? (
                    <>
                        <p className="t-callout text-danger-text">
                            {t.settings.account.deletionQuestion}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={() => setConfirmingDeletion(false)}>
                                {t.settings.account.keepAccount}
                            </Button>
                            <Button variant="danger" loading={requestForgetMutation.isLoading} onClick={handleRequestDeletion}>
                                {t.settings.account.confirmDeletion}
                            </Button>
                        </div>
                    </>
                ) : (
                    <Button variant="quiet" leftIcon={<PixelIcon name="trash" />} className="self-start" onClick={() => setConfirmingDeletion(true)}>
                        {t.settings.account.requestDeletion}
                    </Button>
                )}
                <ErrorAlert message={deletionError} />
            </div>

            <Sheet open={showChangePassword} onClose={() => setShowChangePassword(false)} title={t.settings.account.changePassword}>
                <ChangePasswordForm
                    onSuccess={() => {
                        setShowChangePassword(false);
                        // a password change cancels a pending change of address
                        refetchMe().catch(() => {});
                        notifyMeChanged();
                    }}
                    onCancel={() => setShowChangePassword(false)}
                />
            </Sheet>

            <Sheet open={showChangeEmail} onClose={() => setShowChangeEmail(false)} title={emailAction}>
                <ChangeEmailForm
                    currentEmail={me?.email ?? null}
                    onSuccess={(newEmail) => {
                        setShowChangeEmail(false);
                        // the same 202 whether or not the address can be used, so no promise of a mail
                        setEmailNotice(cat().settings.account.emailNotice(newEmail));
                        refetchMe().catch(() => {});
                        notifyMeChanged();
                    }}
                    onCancel={() => setShowChangeEmail(false)}
                />
            </Sheet>
        </Panel>
    );
}
