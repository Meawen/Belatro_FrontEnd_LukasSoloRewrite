import { useId, useRef, useState } from 'react';
import { Button, Panel, PixelIcon, Sheet } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { ResendConfirmationButton } from '../auth/ResendConfirmationButton';
import { ChangeEmailForm } from './ChangeEmailForm';
import { ChangePasswordForm } from './ChangePasswordForm';
import { GoogleSection } from './GoogleSection';
import { useMe, notifyMeChanged } from '../../hooks/useUser';
// direct module import (not the ../../hooks barrel) so the component test does
// not load every hook module, incl. the WebSocket ones
import { useMutation } from '../../hooks/useApi';
import { userService } from '../../services/userService';
import { authService } from '../../services/authService';
import { ApiError } from '../../services/api';
import { errorMessage, isNetworkOrServerFailure } from '../../utils/errorMessage';
import { cat, useT } from '../../i18n/t';
import { formatLongDate } from '../../i18n/format';
import type { UserDto } from '../../types/user';

/**
 * Settings → Account (spec §4.13 item 2; D-32): the address, its confirmation, the change of address and of
 * password, and the deletion request, moved from the profile with every string and behaviour. The e-mail
 * links of the shell (X-11) lead here. Google sign-in (Google sign-in spec §5) sits before the deletion request; an
 * account made with Google with no password yet sees how to set one in place of the email and password buttons.
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
    // spec §2.1 (D-25): the day an unconfirmed account goes; '' for one that never is (or an unreadable day)
    const removeDay = formatLongDate(me?.verifyBy ?? '');
    // useApi's refetch rethrows: a failed refresh is not a failed write, and nothing awaits it. The banner above has its
    // own copy of /user/me
    const refreshMe = () => {
        refetchMe().catch(() => {});
        notifyMeChanged();
    };

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
                    {/* spec §2.1 (D-25): the day an unconfirmed account goes, beside its resend */}
                    {removeDay && <p data-testid="verify-by" className="t-footnote break-words text-accent">{t.shell.unverified.removeBy(removeDay)}</p>}
                    {(me.pendingEmail || (me.email && !me.emailVerified)) && (
                        <div className="mt-1">
                            {/* keyed on the pending address: a new one starts a fresh button, not a stale "nothing to confirm" */}
                            <ResendConfirmationButton
                                key={me.pendingEmail ?? ''}
                                onChangeEmail={() => setShowChangeEmail(true)}
                                // passwordless, the address may have been confirmed elsewhere: Set a password may work now
                                onNothingToConfirm={me.passwordless ? () => refetchMe().catch(() => {}) : undefined}
                            />
                        </div>
                    )}
                </div>
            )}

            {me?.passwordless ? (
                <SetPassword me={me} />
            ) : (
                <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" leftIcon={<PixelIcon name="mail" />} onClick={() => setShowChangeEmail(true)}>
                        {emailAction}
                    </Button>
                    <Button variant="secondary" leftIcon={<PixelIcon name="lock" />} onClick={() => setShowChangePassword(true)}>
                        {t.settings.account.changePassword}
                    </Button>
                </div>
            )}

            {me && <GoogleSection connected={me.google === true} passwordless={me.passwordless === true} onChanged={refreshMe} />}

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
                        refreshMe();
                    }}
                    onCancel={() => setShowChangePassword(false)}
                />
            </Sheet>

            {/* passwordless, there is no form and so no Cancel: the sheet's own Close */}
            <Sheet open={showChangeEmail} onClose={() => setShowChangeEmail(false)} title={emailAction} showClose={me?.passwordless === true}>
                {/* reached through the resend's "Add or change"; a change of address needs the password the account lacks */}
                {me?.passwordless ? (
                    <SetPassword me={me} />
                ) : (
                    <ChangeEmailForm
                        currentEmail={me?.email ?? null}
                        onSuccess={(newEmail) => {
                            setShowChangeEmail(false);
                            // the same 202 whether or not the address can be used, so no promise of a mail
                            setEmailNotice(cat().settings.account.emailNotice(newEmail));
                            refreshMe();
                        }}
                        onCancel={() => setShowChangeEmail(false)}
                    />
                )}
            </Sheet>
        </Panel>
    );
}

/**
 * The email and password rows of an account made with Google with no password yet (Google sign-in spec §5.2, §8): why
 * both need a password, and Set a password, which mails the forgot-password link (its limits, no new route) to the
 * confirmed address. While the address still waits for its link, that comes first: the resend is in the address block.
 */
function SetPassword({ me }: { me: UserDto }) {
    const t = useT();
    const p = t.settings.account.passwordless;
    // forgot-password mails only a confirmed address (A-11)
    const address = me.emailVerified ? me.email : null;
    const unconfirmed = me.pendingEmail ?? me.email;
    const [line, setLine] = useState<{ text: string; failed: boolean } | null>(null);
    const [hint, setHint] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    // stops a second click that lands before React re-renders the button as busy
    const sending = useRef(false);

    const send = async (to: string) => {
        if (sending.current) return;
        sending.current = true;
        setBusy(true);
        setLine(null);
        setHint(null);
        try {
            await authService.forgotPassword(to);
            setLine({ text: cat().settings.account.passwordless.linkSent(to), failed: false });
        } catch (error) {
            const status = error instanceof ApiError ? error.status : 0;
            setLine({ text: isNetworkOrServerFailure(status) ? cat().auth.resend.notSent : errorMessage(error, cat().errors.generic), failed: true });
            if (status === 429) setHint(cat().errors.waitAndRetry);
        } finally {
            sending.current = false;
            setBusy(false);
        }
    };

    return (
        <div className="flex flex-col items-start gap-2">
            <p className="t-callout text-text-2">{p.why}</p>
            {address ? (
                <>
                    <Button variant="secondary" leftIcon={<PixelIcon name="lock" />} loading={busy} onClick={() => void send(address)}>
                        {p.setPassword}
                    </Button>
                    {line && <p role="status" className={`t-footnote ${line.failed ? 'text-danger-text' : 'text-success'}`}>{line.text}</p>}
                    {hint && <p className="t-footnote text-text-2">{hint}</p>}
                </>
            ) : (
                unconfirmed && <p className="t-callout text-accent">{p.confirmFirst(unconfirmed)}</p>
            )}
        </div>
    );
}
