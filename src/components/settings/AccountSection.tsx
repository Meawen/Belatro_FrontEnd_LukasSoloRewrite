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

    const { data: me, refetch: refetchMe } = useMe();
    // no address at all (e.g. a new account that changed its password before confirming): resend has nothing to send
    const emailAction = me && !me.email && !me.pendingEmail ? 'Add an email address' : 'Change Email';
    const requestForgetMutation = useMutation(() => userService.requestForget());

    const handleRequestDeletion = async () => {
        try {
            setDeletionError(null);
            await requestForgetMutation.mutate();
            setConfirmingDeletion(false);
            // useApi's refetch rethrows: a failed refresh is not a failed request, and nothing awaits it
            refetchMe().catch(() => {});
        } catch (error) {
            setDeletionError(errorMessage(error, 'Failed to request deletion'));
        }
    };

    return (
        <Panel as="section" id="account" padding="lg" aria-labelledby={headingId} className="flex flex-col gap-5">
            <h2 id={headingId} className="t-title">
                Account
            </h2>

            {emailNotice && (
                <p role="status" className="t-callout text-success">
                    {emailNotice}
                </p>
            )}

            {/* The address comes from GET /user/me (only your own account has one to show). */}
            {me && (
                <div className="flex flex-col gap-1">
                    <p className="t-caption text-text-2">Email</p>
                    <p className="t-body break-words">
                        {me.email || 'Not set'}
                        {me.email && !me.emailVerified && <span className="t-footnote ml-2 text-accent">(not confirmed)</span>}
                    </p>
                    {me.pendingEmail && (
                        <p data-testid="pending-email" className="t-footnote break-words text-accent">
                            Waiting for confirmation: {me.pendingEmail}
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
                    Change Password
                </Button>
            </div>

            <div className="flex flex-col gap-3 border-t-2 border-edge pt-5">
                {me?.deletionRequested ? (
                    <p className="t-callout text-accent">Deletion requested — an administrator will process your account removal.</p>
                ) : confirmingDeletion ? (
                    <>
                        <p className="t-callout text-danger-text">
                            Request deletion of your account? We delete your account and its data within 30 days of your request. You can keep playing until then.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={() => setConfirmingDeletion(false)}>
                                Keep my account
                            </Button>
                            <Button variant="danger" loading={requestForgetMutation.isLoading} onClick={handleRequestDeletion}>
                                Confirm request
                            </Button>
                        </div>
                    </>
                ) : (
                    <Button variant="quiet" leftIcon={<PixelIcon name="trash" />} className="self-start" onClick={() => setConfirmingDeletion(true)}>
                        Request account deletion
                    </Button>
                )}
                <ErrorAlert message={deletionError} />
            </div>

            <Sheet open={showChangePassword} onClose={() => setShowChangePassword(false)} title="Change Password">
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
                        setEmailNotice(`If this address can be used, a confirmation link is on its way to ${newEmail}. Check your inbox (and spam).`);
                        refetchMe().catch(() => {});
                        notifyMeChanged();
                    }}
                    onCancel={() => setShowChangeEmail(false)}
                />
            </Sheet>
        </Panel>
    );
}
