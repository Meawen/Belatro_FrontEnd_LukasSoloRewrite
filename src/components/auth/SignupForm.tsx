import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Input, Loader } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { errorMessage, isNetworkOrServerFailure } from '../../utils/errorMessage';
import { EMAIL_PATTERN, passwordRuleError, usernameRuleError } from './credentialRules';
import { AUTH_LINK } from './AuthFrame';
import { GoogleSignIn } from './GoogleButton';
import { GoogleNameStep } from './GoogleNameStep';
import { TermsLine } from './TermsLine';
import { useReturnState } from './returnState';
import { cat, useT } from '../../i18n/t';
import { WaitlistForm } from './WaitlistForm';
import { useSignupStatus } from '../../hooks/useSignupStatus';
import { clearPendingGoogle, peekPendingGoogle, subscribePendingGoogle } from '../../services/googleSignIn';

export interface SignupFormProps {
    onSuccess?: () => void;
}

/**
 * Create an account (spec §4.2). "Sign in" is the other URL (X-2) and carries the return path (§4.1). While signup is
 * full it is the waitlist (WaitlistForm, spec §2.2); `?invite=` is a personal link that signs up anyway. After Google
 * said a new account needs a name, it is Google's name step (GoogleNameStep, Google sign-in spec §3.3).
 */
export function SignupForm({ onSuccess }: SignupFormProps) {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [createdEmail, setCreatedEmail] = useState<string | null>(null);

    const { signup, isSignupLoading, isGuest } = useAuth();
    const returnState = useReturnState();
    const t = useT();
    const [searchParams] = useSearchParams();
    // spec §2.2: the personal link from the waitlist's spot email (/signup?invite=…); it admits even while signup is full
    const invite = (searchParams.get('invite') ?? '').trim();
    // with a personal link the open form's state doesn't matter (B7), so nothing is asked
    const status = useSignupStatus(!invite);
    // the form turned into the waitlist after a submit or Google's answer (Google sign-in A-8): full meanwhile, or a dead
    // link while full; the line says which, and the address is the one typed, or Google's
    const [waitlist, setWaitlist] = useState<{ notice: string; email: string } | null>(null);
    // P-1, S2 A-1: a Google credential waiting for a name (Google's needsName, here or on /login) opens the name step. The
    // step stays open with the address it shows until its way back or the waitlist closes it, though the credential may
    // go before then (a success, an expired token); a new credential (another Google account) changes the address
    const pending = useSyncExternalStore(subscribePendingGoogle, peekPendingGoogle, peekPendingGoogle);
    const [nameStep, setNameStep] = useState<{ email: string } | null>(pending && { email: pending.email });
    const [seenPending, setSeenPending] = useState(pending);
    if (pending !== seenPending) {
        setSeenPending(pending);
        if (pending) setNameStep({ email: pending.email });
    }
    // S1 A-8: at the cap the waitlist wins, with Google's address in it, and the credential goes (no name step can use it)
    useEffect(() => {
        if (status === 'full' && peekPendingGoogle()) clearPendingGoogle();
    }, [status, pending]);
    // the check-inbox panel replaces the form that had focus: focus moves to its heading, where reading starts again
    const inboxHeading = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        if (createdEmail) inboxHeading.current?.focus();
    }, [createdEmail]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.username.trim()) {
            newErrors.username = cat().forms.usernameRequired;
        } else {
            const usernameError = usernameRuleError(formData.username.trim());
            if (usernameError) newErrors.username = usernameError;
        }

        if (!formData.email.trim()) {
            newErrors.email = cat().forms.emailRequired;
        } else if (!EMAIL_PATTERN.test(formData.email)) {
            newErrors.email = cat().forms.emailInvalid;
        }

        if (!formData.password) {
            newErrors.password = cat().forms.passwordRequired;
        } else {
            const passwordError = passwordRuleError(formData.password);
            if (passwordError) newErrors.password = passwordError;
        }

        if (!formData.confirmPassword) {
            newErrors.confirmPassword = cat().auth.signUp.confirmPasswordRequired;
        } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = cat().forms.passwordsDontMatch;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        try {
            setErrors({}); // Clear any previous errors

            await signup({
                // the backend validates the raw value, so stray spaces would be a 400
                username: formData.username.trim(),
                email: formData.email.trim(),
                password: formData.password,
                // spec §2.2: the personal link's token
                ...(invite ? { waitlistToken: invite } : {}),
                // spec §9: this browser was a guest. Its token goes with the request (api.ts), so the server may let it keep its
                // own name, and ends that guest after the account exists (Rulings 5, 42)
                ...(isGuest ? { wasGuest: true } : {}),
            });

            // The account works now; the address still needs its confirmation link.
            setCreatedEmail(formData.email.trim());
        } catch (error) {
            console.error('Signup error:', error);
            // a 500 while the backend's session store is down, or no answer: not the raw text
            const httpStatus = error instanceof ApiError ? error.status : 0;
            const code = error instanceof ApiError ? error.code : undefined;
            // spec §2.2, §8: full meanwhile (Review focus 2), or a dead personal link while full: the waitlist, saying which
            if (code === 'SIGNUP_FULL' || code === 'INVITE_LINK_INVALID') {
                setWaitlist({ notice: errorMessage(error, cat().errors.generic), email: formData.email.trim() });
                return;
            }
            // Ruling 5: at signup, IN_GAME is a guest keeping its own name while still seated, not a rename (its catalog line)
            const inGame = code === 'IN_GAME' ? cat().auth.signUp.inGame : null;
            setErrors({
                submit: isNetworkOrServerFailure(httpStatus) ? cat().errors.generic : inGame ?? errorMessage(error, cat().auth.signUp.failed)
            });
        }
    };

    if (createdEmail) {
        return (
            <div className="flex flex-col gap-4 text-center">
                <h1 ref={inboxHeading} tabIndex={-1} className="t-title">{t.auth.signUp.checkInbox.heading}</h1>
                {/* The same answer comes for an address another account holds, and that one gets no
                    link (spec section 1), so this must not promise a mail. */}
                <p className="t-body text-text-2">
                    {t.auth.signUp.checkInbox.before}{' '}<strong className="text-text">{createdEmail}</strong>{t.auth.signUp.checkInbox.after}
                </p>
                <p className="t-body text-text-2">{t.auth.signUp.checkInbox.removal}</p>
                <Button block onClick={() => onSuccess?.()}>
                    {t.common.continue}
                </Button>
            </div>
        );
    }

    if (waitlist !== null) return <WaitlistForm initialEmail={waitlist.email} notice={waitlist.notice} />;
    // Google at the cap on /login came here with its address (A-8); the waitlist reads it once, so it stays as the credential goes
    if (status === 'full') return <WaitlistForm initialEmail={nameStep?.email} />;
    if (status === 'asking') return <Loader text={t.common.loading} />;
    if (nameStep) {
        return (
            <GoogleNameStep
                email={nameStep.email}
                waitlistToken={invite || undefined}
                onSuccess={() => onSuccess?.()}
                onWaitlist={(notice, email) => {
                    setNameStep(null);
                    setWaitlist({ notice, email });
                }}
                onBack={() => {
                    clearPendingGoogle();
                    setNameStep(null);
                }}
            />
        );
    }

    return (
        <>
            <div className="mb-6 text-center">
                <h1 className="t-title">{t.auth.signUp.createAccount}</h1>
                <p className="t-callout mt-2 text-text-2">{invite ? t.auth.signUp.inviteSubtitle : t.auth.signUp.subtitle}</p>
            </div>

            <GoogleSignIn
                onSignedIn={() => onSuccess?.()}
                waitlistToken={invite || undefined}
                onWaitlist={(notice, email) => setWaitlist({ notice, email })}
            />

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                    label={t.forms.username}
                    name="username"
                    type="text"
                    value={formData.username}
                    onChange={handleChange}
                    error={errors.username}
                    placeholder={t.auth.signUp.usernamePlaceholder}
                />

                <Input
                    label={t.forms.email}
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    error={errors.email}
                    placeholder={t.forms.emailPlaceholder}
                />

                <Input
                    label={t.forms.password}
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    error={errors.password}
                    placeholder={t.auth.signUp.passwordPlaceholder}
                />

                <Input
                    label={t.auth.signUp.confirmPassword}
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    error={errors.confirmPassword}
                    placeholder={t.auth.signUp.confirmPasswordPlaceholder}
                />

                <ErrorAlert message={errors.submit ?? null} />

                <Button type="submit" block loading={isSignupLoading}>
                    {isSignupLoading ? t.auth.signUp.submitting : t.auth.signUp.createAccount}
                </Button>

                <TermsLine />
            </form>

            <p className="t-callout mt-4 text-center text-text-2">
                {t.auth.signUp.haveAccount}{' '}
                <Link to="/login" state={returnState} className={`inline-flex min-h-11 items-center ${AUTH_LINK}`}>
                    {t.common.signIn}
                </Link>
            </p>
        </>
    );
}
