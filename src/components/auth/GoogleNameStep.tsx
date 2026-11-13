import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import {
    clearPendingGoogle,
    emailFromCredential,
    peekPendingGoogle,
    sameGoogleAccount,
    setPendingGoogle,
} from '../../services/googleSignIn';
import { errorMessage, isNetworkOrServerFailure } from '../../utils/errorMessage';
import { getLang } from '../../i18n/lang';
import { cat, useT } from '../../i18n/t';
import { usernameRuleError } from './credentialRules';
import { GoogleButton } from './GoogleButton';
import { TermsLine } from './TermsLine';
import { useReturnState } from './returnState';

export interface GoogleNameStepProps {
    /** The Google address it shows (spec §3.3): the pending credential's, still shown once the credential is spent (A-1). */
    email: string;
    /** /signup?invite=…'s token (spec §2.2), sent as the form sends it. */
    waitlistToken?: string;
    /** Signed in: the form's onSuccess, so AuthPage goes where a sign-up from the form goes (spec §6.3). */
    onSuccess: () => void;
    /** No account now (the cap, or a dead invite link while full): the waitlist, with this line and address (spec §4, §8). */
    onWaitlist: (notice: string, email: string) => void;
    /** "Use another way to sign up": the credential goes and the form shows (SignupForm closes the step). */
    onBack: () => void;
}

/** A refusal no retry can fix (A-6): its next step takes the place of the field and Make my account. */
type Ending = 'signIn' | 'form';
const ENDINGS = new Map<string, Ending>([
    // spec §3.3, §8: the address became a member's meanwhile
    ['GOOGLE_EMAIL_IN_USE', 'signIn'],
    // spec §4, §8: the private beta's invite code is still set; members still sign in
    ['INVITE_CODE_INVALID', 'signIn'],
    // spec §3.3: Google hasn't confirmed the address
    ['GOOGLE_EMAIL_UNVERIFIED', 'form'],
]);
/** Refusals about the name (A-5, US-G5): under the field, as on the form. The server's rule sentence is one too. */
const NAME_CODES = new Set(['USERNAME_TAKEN', 'USERNAME_RESERVED', 'IN_GAME']);

/**
 * Google's name step (Google sign-in spec §3.3, §8): /signup after Google said a new account needs a name. The Google
 * address, one name field under the form's rules (the rule its hint, live once the field is left), the Terms line, "Make
 * my account" and a way back. It sends Google's token again with the name (step 2); an expired token keeps the name and
 * asks for Google again, and the next tap with the same account goes straight on (review focus 4, A-2).
 */
export function GoogleNameStep({ email, waitlistToken, onSuccess, onWaitlist, onBack }: GoogleNameStepProps) {
    const t = useT();
    const { googleSignup, isGuest } = useAuth();
    const navigate = useNavigate();
    const returnState = useReturnState();
    const [name, setName] = useState('');
    // A-5: the rule is the field's hint until the field is left or a submit is tried; from then on its error while broken
    const [check, setCheck] = useState<'off' | 'left' | 'tried'>('off');
    // a server refusal about the name: under the field until the next keystroke
    const [nameRefusal, setNameRefusal] = useState<string | null>(null);
    const [alert, setAlert] = useState<string | null>(null);
    // review focus 4: Google's token ran out, so Google's button takes Make my account's place
    const [expired, setExpired] = useState(false);
    const [ending, setEnding] = useState<Ending | null>(null);
    // one step 2 at a time: Enter and a tap, or Google's window answering twice; after a success it stays busy
    const sendingRef = useRef(false);
    const [sending, setSending] = useState(false);
    // the step takes the form's place: reading starts again at its heading
    const heading = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        heading.current?.focus();
    }, []);

    const trimmed = name.trim();
    const ruleLine = check === 'off' ? null : trimmed ? usernameRuleError(trimmed) : check === 'tried' ? t.forms.usernameRequired : null;
    const c = t.auth.google.name;

    const refused = (error: unknown) => {
        const status = error instanceof ApiError ? error.status : 0;
        const code = error instanceof ApiError ? error.code : undefined;
        const line = errorMessage(error, cat().errors.generic);
        // spec §4, §8: no new account now; the waitlist, with the Google address in it
        if (code === 'SIGNUP_FULL' || code === 'INVITE_LINK_INVALID') {
            clearPendingGoogle();
            onWaitlist(line, email);
            return;
        }
        if ((code && NAME_CODES.has(code)) || line === cat().errors.rules.username) {
            // Ruling 5: at signup, IN_GAME is a guest keeping its own name while still seated
            setNameRefusal(code === 'IN_GAME' ? cat().auth.signUp.inGame : line);
            return;
        }
        const end = code === undefined ? undefined : ENDINGS.get(code);
        if (code === 'GOOGLE_INVALID' || end) {
            // the credential can't be used again
            clearPendingGoogle();
            setAlert(line);
            if (end) setEnding(end);
            else setExpired(true);
            return;
        }
        // worth another try: the name, the credential and the button stay. A 404 is a server with Google sign-in off (S1 A-5)
        setAlert(isNetworkOrServerFailure(status) ? cat().errors.generic : status === 404 ? cat().auth.google.failed : line);
    };

    const send = async (credential: string) => {
        if (sendingRef.current) return;
        sendingRef.current = true;
        setSending(true);
        setAlert(null);
        setNameRefusal(null);
        try {
            await googleSignup({
                credential,
                // the backend validates the raw value, so stray spaces would be a 400
                username: trimmed,
                language: getLang(),
                // spec §2.2: the personal link's token
                ...(waitlistToken ? { waitlistToken } : {}),
                // spec §3.4: this browser was a guest; its token goes along (api.ts), so it may keep its own name
                ...(isGuest ? { wasGuest: true } : {}),
            });
        } catch (error) {
            sendingRef.current = false;
            setSending(false);
            refused(error);
            return;
        }
        // A-3: a new account, or a sign-in to one made meanwhile: either way on to where the form's success goes, the
        // step busy until the page moves
        clearPendingGoogle();
        onSuccess();
    };

    /** The name as it is now passes the rule; if not, the rule shows. */
    const nameFits = () => {
        setCheck('tried');
        return trimmed !== '' && usernameRuleError(trimmed) === null;
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (sendingRef.current || !nameFits()) return;
        const pending = peekPendingGoogle();
        if (pending) void send(pending.credential);
        // nothing to send it with any more: Google again
        else setExpired(true);
    };

    // A-2: a new tap on Google's button after the token ran out
    const retry = (credential: string) => {
        if (sendingRef.current) return;
        setPendingGoogle({ credential, email: emailFromCredential(credential) ?? email });
        setExpired(false);
        setAlert(null);
        // another Google account: its address shows (SignupForm passes it on), and Make my account waits for a tap
        if (!sameGoogleAccount(credential, email)) return;
        if (nameFits()) void send(credential);
    };

    const next = ending === 'signIn' ? (
        <Button block onClick={() => navigate('/login', { state: returnState })}>{t.common.signIn}</Button>
    ) : ending === 'form' ? (
        <Button block onClick={onBack}>{t.auth.google.formLink}</Button>
    ) : expired ? (
        <GoogleButton onCredential={retry} />
    ) : (
        <Button type="submit" block loading={sending}>{sending ? t.auth.signUp.submitting : c.submit}</Button>
    );

    return (
        <>
            <div className="mb-6 text-center">
                <h1 ref={heading} tabIndex={-1} className="t-title">{c.heading}</h1>
                {email && (
                    <p className="t-callout mt-2 text-text-2">
                        {c.signingUpAs}{' '}<strong className="text-text wrap-anywhere">{email}</strong>
                    </p>
                )}
            </div>

            {/* noValidate: the rule below speaks the site's language, not the browser's */}
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
                {ending === null && (
                    <Input
                        label={t.forms.username}
                        name="username"
                        type="text"
                        autoComplete="username"
                        value={name}
                        onChange={(e) => {
                            setName(e.target.value);
                            setNameRefusal(null);
                        }}
                        onBlur={() => setCheck((now) => (now === 'off' ? 'left' : now))}
                        helper={t.errors.rules.username}
                        error={nameRefusal ?? ruleLine}
                    />
                )}
                <ErrorAlert message={alert} />
                {next}
                {ending === null && <TermsLine />}
            </form>

            <div className="mt-4 flex justify-center">
                <Button variant="quiet" disabled={sending} onClick={onBack}>{c.back}</Button>
            </div>
        </>
    );
}
