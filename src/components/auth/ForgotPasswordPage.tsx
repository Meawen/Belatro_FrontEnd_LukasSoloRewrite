import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { authService } from '../../services/authService';
import { ApiError } from '../../services/api';
import { errorMessage, isNetworkOrServerFailure } from '../../utils/errorMessage';
import { EMAIL_PATTERN } from './credentialRules';
import { AuthFrame, AUTH_LINK } from './AuthFrame';
import { useReturnState } from './returnState';
import { cat, useT } from '../../i18n/t';

/** /forgot-password (spec §4.3) on the auth frame. "Back to sign in" carries the return path (§4.1). */
export function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [hint, setHint] = useState<string | null>(null);
    const [sent, setSent] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    // stops a second submit that lands before React re-renders the button as disabled
    const sending = useRef(false);
    const returnState = useReturnState();
    const t = useT();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (sending.current) return;
        const address = email.trim();
        setHint(null);
        if (!EMAIL_PATTERN.test(address)) {
            setError(cat().forms.emailInvalid);
            return;
        }
        setError(null);
        sending.current = true;
        setIsSubmitting(true);
        try {
            await authService.forgotPassword(address);
            setSent(true);
        } catch (err) {
            const status = err instanceof ApiError ? err.status : 0;
            // a network failure or a 5xx carries the browser's or Spring's text ("Failed to fetch", "Internal Server Error")
            setError(isNetworkOrServerFailure(status) ? cat().errors.generic : errorMessage(err, cat().errors.generic));
            if (status === 429) setHint(cat().errors.waitAndRetry);
        } finally {
            sending.current = false;
            setIsSubmitting(false);
        }
    };

    return (
        <AuthFrame>
            <h1 className="t-title text-center">{t.auth.forgot.heading}</h1>

            {sent ? (
                // The same sentence whether or not the address has an account.
                <p className="t-body mt-6 text-center">
                    {t.auth.forgot.sent}
                </p>
            ) : (
                <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
                    <Input
                        label={t.forms.email}
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t.forms.emailPlaceholder}
                    />
                    <ErrorAlert message={error} />
                    {hint && <p className="t-footnote text-text-2">{hint}</p>}
                    <Button type="submit" block loading={isSubmitting}>
                        {t.auth.forgot.submit}
                    </Button>
                </form>
            )}

            <p className="t-callout mt-4 text-center">
                <Link to="/login" state={returnState} className={`inline-flex min-h-11 items-center ${AUTH_LINK}`}>
                    {t.auth.forgot.back}
                </Link>
            </p>
        </AuthFrame>
    );
}
