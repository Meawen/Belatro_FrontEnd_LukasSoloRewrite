import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import {
    emailFromCredential,
    googleButtonWidth,
    googleClientId,
    loadGoogle,
    renderGoogleButton,
    setPendingGoogle,
} from '../../services/googleSignIn';
import { errorMessage, isNetworkOrServerFailure } from '../../utils/errorMessage';
import { getLang, useLang } from '../../i18n/lang';
import { cat, useT } from '../../i18n/t';
import { AUTH_LINK } from './AuthFrame';
import { useReturnState, type ReturnState } from './returnState';

/** A drag-resize changes the slot's width on every frame: Google's button is drawn again once it has settled. */
const SETTLE_MS = 150;

export interface GoogleButtonProps {
    /** Google's answer: the ID token of the account picked in Google's window. */
    onCredential: (credential: string) => void;
}

/**
 * Google's own "Continue with Google" button (Google sign-in spec §2, §6.3), drawn by Google's script, which loads when
 * this first shows; nothing at all without a client id. While the script loads, the button's height is kept free, so
 * nothing jumps. A script that is blocked, fails or has no answer in 10 s shows spec §6.3's line in the button's place,
 * with Try again (A-4). A closed or cancelled Google window shows nothing new: Google tells the page nothing then.
 */
export function GoogleButton({ onCredential }: GoogleButtonProps) {
    const t = useT();
    const lang = useLang();
    const clientId = googleClientId();
    const slot = useRef<HTMLDivElement>(null);
    // Google's answer goes to the latest callback; a new callback alone draws nothing again
    const latest = useRef(onCredential);
    latest.current = onCredential;
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const el = slot.current;
        if (!clientId || failed || !el) return;
        let current = true;
        let drawnAt: number | null = null;
        let settling: ReturnType<typeof setTimeout> | undefined;
        let observer: ResizeObserver | null = null;
        // A-2: at the slot's width. Google's button keeps the width it was drawn at, so it is drawn again when the width
        // it would get changes (a phone turned, a scrollbar came), or the page would scroll sideways
        const draw = () => {
            const width = googleButtonWidth(el.getBoundingClientRect().width);
            if (width === drawnAt) return;
            drawnAt = width;
            try {
                renderGoogleButton(el, {
                    locale: lang,
                    width,
                    onCredential: (credential) => {
                        if (current) latest.current(credential);
                    },
                });
            } catch {
                setFailed(true);
            }
        };
        const drawWhenSettled = () => {
            clearTimeout(settling);
            settling = setTimeout(draw, SETTLE_MS);
        };
        loadGoogle().then(
            () => {
                if (!current) return;
                draw();
                // the slot itself, where the browser can watch it; otherwise the window, whose size moves the slot's
                if (typeof ResizeObserver === 'function') {
                    observer = new ResizeObserver(drawWhenSettled);
                    observer.observe(el);
                } else {
                    window.addEventListener('resize', drawWhenSettled);
                }
            },
            () => {
                if (current) setFailed(true);
            },
        );
        return () => {
            current = false;
            clearTimeout(settling);
            observer?.disconnect();
            window.removeEventListener('resize', drawWhenSettled);
        };
    }, [clientId, failed, lang]);

    if (!clientId) return null;
    if (failed) {
        return (
            <div className="flex flex-col items-center gap-2">
                <ErrorAlert message={t.auth.google.failed} className="w-full" />
                <Button variant="quiet" size="sm" onClick={() => setFailed(false)}>{t.common.retry}</Button>
            </div>
        );
    }
    return <div ref={slot} className="flex min-h-10 w-full justify-center" />;
}

export interface GoogleSignInProps {
    /** Signed in: the form's onSuccess, so AuthPage goes where a password sign-in goes (spec §6.3). */
    onSignedIn: () => void;
    /** /signup?invite=…'s token (spec §2.2): a new account is admitted even while signup is full. */
    waitlistToken?: string;
    /**
     * The sign-up form's waitlist (A-8), given by /signup only: there the cap and a dead invite link turn the form into
     * the waitlist, its address Google's, and a new account's name step comes on the same page. Elsewhere (/login, the
     * guest prompt) both go to /signup.
     */
    onWaitlist?: (notice: string, email: string) => void;
    /**
     * The return path /signup carries on (the name step, the form link): this page's own `{ from }` where it isn't an auth
     * page (the guest prompt, S2 A-7). By default the one this auth page was handed.
     */
    returnTo?: ReturnState;
    /** The "or" between Google's button and a form under it; the guest prompt has no form (S2 A-7). */
    divider?: boolean;
}

/**
 * "Continue with Google" above a sign-in or sign-up form (spec §2, A-3): Google's button, the line for a refusal under
 * it, then "or". Nothing without a client id, so no "or" stands alone. The guest prompt has it too, with no "or".
 */
export function GoogleSignIn({ onSignedIn, waitlistToken, onWaitlist, returnTo, divider = true }: GoogleSignInProps) {
    const t = useT();
    const { googleSignIn } = useAuth();
    const navigate = useNavigate();
    const handed = useReturnState();
    const returnState = returnTo ?? handed;
    const [refusal, setRefusal] = useState<{ line: string; formLink: boolean } | null>(null);
    // one answer at a time: Google's window can answer again before the first is through
    const sending = useRef(false);

    if (!googleClientId()) return null;

    // P-1: the credential waits in memory for the name step on /signup, never in the URL or the history entry
    const toSignup = (credential: string, email: string) => {
        setPendingGoogle({ credential, email });
        if (!onWaitlist) navigate('/signup', { state: returnState });
    };

    const signIn = async (credential: string) => {
        if (sending.current) return;
        sending.current = true;
        setRefusal(null);
        try {
            const answer = await googleSignIn({ credential, language: getLang(), ...(waitlistToken ? { waitlistToken } : {}) });
            if (answer.needsName) toSignup(credential, answer.email ?? emailFromCredential(credential) ?? '');
            else onSignedIn();
        } catch (error) {
            const status = error instanceof ApiError ? error.status : 0;
            const code = error instanceof ApiError ? error.code : undefined;
            // spec §4, §8: no new account now, so the waitlist, with the address from Google's token (for display only)
            if (code === 'SIGNUP_FULL' || code === 'INVITE_LINK_INVALID') {
                const email = emailFromCredential(credential) ?? '';
                if (onWaitlist) {
                    onWaitlist(errorMessage(error, cat().errors.generic), email);
                    return;
                }
                // /login: /signup at the cap is the waitlist, which takes the address from the store
                if (code === 'SIGNUP_FULL') {
                    toSignup(credential, email);
                    return;
                }
            }
            setRefusal({
                // A-5: a 404 is a server with Google sign-in off, so the line that points to the form
                line: isNetworkOrServerFailure(status) ? cat().errors.generic : status === 404 ? cat().auth.google.failed : errorMessage(error, cat().errors.generic),
                // A-12: spec §3.3's "and a link to it", where the sign-up form isn't on the page
                formLink: code === 'GOOGLE_EMAIL_UNVERIFIED' && !onWaitlist,
            });
        } finally {
            sending.current = false;
        }
    };

    return (
        <>
            <GoogleButton onCredential={(credential) => void signIn(credential)} />
            {refusal && (
                <div className="mt-3 flex flex-col items-center">
                    <ErrorAlert message={refusal.line} className="w-full" />
                    {refusal.formLink && (
                        <Link to="/signup" state={returnState} className={`t-callout mt-1 inline-flex min-h-11 items-center ${AUTH_LINK}`}>
                            {t.auth.google.formLink}
                        </Link>
                    )}
                </div>
            )}
            {divider && (
                <div className="my-5 flex items-center gap-3">
                    <span aria-hidden="true" className="h-0.5 flex-1 bg-edge" />
                    <span className="t-footnote text-text-2">{t.auth.google.or}</span>
                    <span aria-hidden="true" className="h-0.5 flex-1 bg-edge" />
                </div>
            )}
        </>
    );
}
