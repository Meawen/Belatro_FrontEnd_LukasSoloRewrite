import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { useBotGame } from '../../hooks/useBotGame';
import { ApiError } from '../../services/api';
import { authService } from '../../services/authService';
import { betaService } from '../../services/betaService';
import { errorMessage, isNetworkOrServerFailure } from '../../utils/errorMessage';
import { EMAIL_PATTERN } from './credentialRules';
import { AUTH_LINK } from './AuthFrame';
import { useReturnState } from './returnState';
import { getLang } from '../../i18n/lang';
import { cat, useT } from '../../i18n/t';

export interface WaitlistFormProps {
    /** The address typed into the sign-up form before it turned into this one. */
    initialEmail?: string;
    /** What happened, above the form (spec §8): the last place went meanwhile, or the personal link was dead. */
    notice?: string | null;
}

/**
 * "Red za stol" (spec §2.2): /signup while signup is full. It says so, takes an email address in the site's language,
 * and offers a game against bots as a guest right now. Joining answers alike for every address (B7: 202), so the
 * answer promises no mail.
 */
export function WaitlistForm({ initialEmail = '', notice = null }: WaitlistFormProps) {
    const t = useT();
    const returnState = useReturnState();
    const [email, setEmail] = useState(initialEmail);
    const [fieldError, setFieldError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    // the address that joined: the answer panel names it
    const [joined, setJoined] = useState<string | null>(null);
    // stops a second submit that lands before React re-renders the button as loading
    const sendingRef = useRef(false);
    const [sending, setSending] = useState(false);
    const bots = useBotGame();

    // a visitor with no session becomes a guest first (spec §3), decided at click time from storage, as the landing
    // page does; a signed-in member never reaches /signup (PublicRoute), so "authenticated" here means a guest
    const playBots = () =>
        void bots.play(authService.isAuthenticated() ? undefined : () => authService.startGuest(getLang()));

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (sendingRef.current) return;
        const address = email.trim();
        if (!address) {
            setFieldError(cat().forms.emailRequired);
            return;
        }
        if (!EMAIL_PATTERN.test(address)) {
            setFieldError(cat().forms.emailInvalid);
            return;
        }
        sendingRef.current = true;
        setSending(true);
        setSubmitError(null);
        try {
            await betaService.joinWaitlist(address, getLang());
            setJoined(address);
        } catch (error) {
            const status = error instanceof ApiError ? error.status : 0;
            // their text is the browser's or Spring's; a 429 (RATE_LIMITED) and a 400 (VALIDATION) say what to do
            setSubmitError(isNetworkOrServerFailure(status) ? cat().errors.generic : errorMessage(error, cat().errors.generic));
        } finally {
            sendingRef.current = false;
            setSending(false);
        }
    };

    if (joined) {
        return (
            <div className="flex flex-col gap-4 text-center">
                <h1 className="t-title">{t.auth.signUp.checkInbox.heading}</h1>
                {/* B7 answers every address alike, and a listed one gets no mail: no promise of one */}
                <p className="t-body text-text-2">
                    {t.auth.waitlist.joinedBefore}{' '}<strong className="text-text">{joined}</strong>{t.auth.waitlist.joinedAfter}
                </p>
                <Button block loading={bots.starting} onClick={playBots}>{t.guest.needsAccount.bots}</Button>
                <ErrorAlert message={bots.error} />
            </div>
        );
    }

    return (
        <>
            <div className="mb-6 text-center">
                <h1 className="t-title">{t.auth.waitlist.title}</h1>
                <p className="t-callout mt-2 text-text-2">{t.auth.waitlist.lead}</p>
            </div>

            <ErrorAlert message={notice} className="mb-4" />

            {/* noValidate: the check below speaks the site's language, not the browser's */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                <Input
                    label={t.forms.email}
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                        setEmail(e.target.value);
                        setFieldError(null);
                    }}
                    error={fieldError ?? undefined}
                    helper={t.auth.waitlist.confirmFirst}
                    placeholder={t.forms.emailPlaceholder}
                />
                <ErrorAlert message={submitError} />
                <Button type="submit" block loading={sending}>
                    {t.auth.waitlist.submit}
                </Button>
            </form>

            <div className="mt-6 flex flex-col items-center gap-3 text-center">
                <p className="t-callout text-text-2">{t.auth.waitlist.guestNow}</p>
                <Button variant="secondary" block loading={bots.starting} onClick={playBots}>{t.guest.needsAccount.bots}</Button>
                <ErrorAlert message={bots.error} />
            </div>

            <p className="t-callout mt-4 text-center text-text-2">
                {t.auth.signUp.haveAccount}{' '}
                <Link to="/login" state={returnState} className={`inline-flex min-h-11 items-center ${AUTH_LINK}`}>
                    {t.common.signIn}
                </Link>
            </p>
        </>
    );
}
