import { useEffect, useRef, useState } from 'react';
import { Button, Input, PixelIcon } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { GoogleButton } from '../auth/GoogleButton';
import { ApiError } from '../../services/api';
import { googleClientId } from '../../services/googleSignIn';
import { userService } from '../../services/userService';
import { errorMessage, isNetworkOrServerFailure } from '../../utils/errorMessage';
import { cat, useT } from '../../i18n/t';

export interface GoogleSectionProps {
    /** GET /user/me's `google`: a Google account is connected. */
    connected: boolean;
    /** GET /user/me's `passwordless`: no password yet, so Google stays connected (spec §5.2). */
    passwordless: boolean;
    /** A connect or a disconnect went through, or the page was stale: GET /user/me again. */
    onChanged: () => void;
}

/** Where focus goes once an answer is drawn (A-15): never to <body> when the focused control went away. */
type FocusTarget = 'field' | 'alert' | 'notice' | 'action' | 'question';

/**
 * Google sign-in in Settings' Account section (Google sign-in spec §5, §8): "Google: not connected" and Connect Google,
 * which opens the current-password field and Google's button (Google's script loads only then, A-1); "Google: connected"
 * and Disconnect with an inline confirm; or, for an account made with Google with no password yet, why it stays. Nothing
 * without a client id (spec §2). It never shows a Google address: Stiglja keeps none.
 */
export function GoogleSection({ connected, passwordless, onChanged }: GoogleSectionProps) {
    const t = useT();
    const c = t.settings.google;
    // what this page just did, shown until GET /user/me's answer changes (so also when the refresh fails)
    const [done, setDone] = useState<{ was: boolean; now: boolean } | null>(null);
    const isConnected = done && done.was === connected ? done.now : connected;
    const [open, setOpen] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [password, setPassword] = useState('');
    // a refusal about the password (A-3): under the field until the next keystroke
    const [fieldError, setFieldError] = useState<string | null>(null);
    const [alert, setAlert] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    // one request at a time: Google's window can answer again before the first is through
    const sendingRef = useRef(false);
    const [sending, setSending] = useState(false);

    // a screen reader hears an answer where focus goes. A new object per request, so a repeated one still moves focus
    const fieldRef = useRef<HTMLInputElement>(null);
    const alertRef = useRef<HTMLDivElement>(null);
    const noticeRef = useRef<HTMLParagraphElement>(null);
    const actionRef = useRef<HTMLButtonElement>(null);
    const questionRef = useRef<HTMLParagraphElement>(null);
    const [focusTo, setFocusTo] = useState<{ target: FocusTarget } | null>(null);
    useEffect(() => {
        if (!focusTo) return;
        const el = { field: fieldRef, alert: alertRef, notice: noticeRef, action: actionRef, question: questionRef }[focusTo.target].current;
        // the field's note is its description, read as it takes focus: from the field itself, focus leaves and comes back
        if (el === document.activeElement) el?.blur();
        el?.focus();
    }, [focusTo]);
    const focus = (target: FocusTarget) => setFocusTo({ target });

    if (!googleClientId()) return null;

    // A-6: a 404 is a server with Google sign-in off, whose body has no code
    const lineFor = (error: unknown) => {
        const status = error instanceof ApiError ? error.status : 0;
        return isNetworkOrServerFailure(status) ? cat().errors.generic : status === 404 ? cat().settings.google.unavailable : errorMessage(error, cat().errors.generic);
    };

    /** A connect or a disconnect went through: the new state and its line, and GET /user/me again (A-12). */
    const changed = (now: boolean, line: string) => {
        setDone({ was: connected, now });
        setConfirming(false);
        setNotice(line);
        focus('notice');
        onChanged();
    };

    const connect = async (credential: string) => {
        if (sendingRef.current) return;
        setAlert(null);
        // A-2: the password first; Google's answer alone sends nothing
        if (!password) {
            setFieldError(cat().forms.currentPasswordRequired);
            focus('field');
            return;
        }
        sendingRef.current = true;
        setSending(true);
        try {
            await userService.connectGoogle({ credential, currentPassword: password });
        } catch (error) {
            // A-3: the password stays either way; any other refusal came with the right one (B3-9)
            if (error instanceof ApiError && error.code === 'WRONG_PASSWORD') {
                setFieldError(cat().errors.codes.WRONG_PASSWORD);
                focus('field');
            } else {
                // under Google's button, which stays for the next tap (S1 A-6)
                setAlert(lineFor(error));
                focus('alert');
            }
            return;
        } finally {
            sendingRef.current = false;
            setSending(false);
        }
        setOpen(false);
        setPassword('');
        changed(true, cat().settings.google.connectedNotice);
    };

    const disconnect = async () => {
        if (sendingRef.current) return;
        sendingRef.current = true;
        setSending(true);
        setAlert(null);
        try {
            await userService.disconnectGoogle();
        } catch (error) {
            setAlert(lineFor(error));
            focus('alert');
            // a stale page: the account has no password after all, and GET /user/me shows why
            if (error instanceof ApiError && error.code === 'NO_PASSWORD') {
                setConfirming(false);
                onChanged();
            }
            return;
        } finally {
            sendingRef.current = false;
            setSending(false);
        }
        changed(false, cat().settings.google.disconnectedNotice);
    };

    const formOpen = open && !isConnected;
    const alertLine = <ErrorAlert ref={alertRef} message={alert} />;

    return (
        <div className="flex flex-col gap-3 border-t-2 border-edge pt-5">
            <h3 className="t-headline">{c.heading}</h3>
            {notice && <p ref={noticeRef} tabIndex={-1} role="status" className="t-callout text-success">{notice}</p>}
            <p className="t-body">{isConnected ? c.connected : c.notConnected}</p>
            {isConnected ? (
                passwordless ? (
                    <p className="t-callout text-text-2">{c.onlyWayIn}</p>
                ) : confirming ? (
                    <>
                        <p ref={questionRef} tabIndex={-1} className="t-callout text-danger-text">{c.disconnectQuestion}</p>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setConfirming(false);
                                    setAlert(null);
                                    focus('action');
                                }}
                            >
                                {c.keep}
                            </Button>
                            <Button variant="danger" loading={sending} onClick={() => void disconnect()}>{c.confirmDisconnect}</Button>
                        </div>
                    </>
                ) : (
                    <Button
                        ref={actionRef}
                        variant="secondary"
                        className="self-start"
                        onClick={() => {
                            setConfirming(true);
                            setNotice(null);
                            setAlert(null);
                            focus('question');
                        }}
                    >
                        {c.disconnect}
                    </Button>
                )
            ) : formOpen ? (
                // as wide as Google's button at most, so the field and the button line up (A-1)
                <div className="flex max-w-sm flex-col gap-3">
                    <Input
                        ref={fieldRef}
                        label={t.settings.changeEmail.currentPassword}
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        disabled={sending}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            setFieldError(null);
                        }}
                        helper={c.hint}
                        error={fieldError}
                    />
                    <GoogleButton onCredential={(credential) => void connect(credential)} failedLine={c.didntOpen} />
                    {alertLine}
                    <Button
                        variant="quiet"
                        className="self-start"
                        disabled={sending}
                        onClick={() => {
                            setOpen(false);
                            setPassword('');
                            setFieldError(null);
                            setAlert(null);
                            focus('action');
                        }}
                    >
                        {t.common.cancel}
                    </Button>
                </div>
            ) : (
                <>
                    <p className="t-callout text-text-2">{c.what}</p>
                    <Button
                        ref={actionRef}
                        variant="secondary"
                        leftIcon={<PixelIcon name="link" />}
                        className="self-start"
                        onClick={() => {
                            setOpen(true);
                            setNotice(null);
                            setAlert(null);
                            focus('field');
                        }}
                    >
                        {c.connect}
                    </Button>
                </>
            )}
            {/* outside the form, the line stays when the state changes under it (NO_PASSWORD, then the refresh) */}
            {!formOpen && alertLine}
        </div>
    );
}
