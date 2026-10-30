import { useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Input } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { authService } from '../../services/authService';
import { ApiError } from '../../services/api';
import { errorMessage, isNetworkOrServerFailure } from '../../utils/errorMessage';
import { passwordRuleError } from './credentialRules';
import { AuthFrame, AUTH_LINK } from './AuthFrame';
import { cat, useT } from '../../i18n/t';

type Outcome =
    | { kind: 'idle' }
    | { kind: 'pending' }
    | { kind: 'done' }
    | { kind: 'failed'; message: string; status: number };

/** /reset-password?token=... - the link from the reset mail (valid 15 minutes, single use). */
export function ResetPasswordPage() {
    const t = useT();
    const [searchParams] = useSearchParams();
    const token = (searchParams.get('token') ?? '').trim();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });
    // One post per submit. The ref stops a second submit that lands before React
    // re-renders the button as disabled, and stays set once an answer is final.
    const posting = useRef(false);

    const failed = outcome.kind === 'failed' ? outcome : null;
    // a network failure (status 0) or a 5xx: the backend spends the link before the write, so it may be spent
    const serverFailure = failed !== null && isNetworkOrServerFailure(failed.status);
    // 429: the limiter runs before the link is spent, so waiting is the remedy, not a new link
    const rateLimited = failed?.status === 429;
    const linkDead = !token || (failed !== null && !rateLimited);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (posting.current) return;
        const newErrors: Record<string, string> = {};
        const ruleError = passwordRuleError(newPassword);
        if (ruleError) newErrors.newPassword = ruleError;
        if (confirmPassword !== newPassword) newErrors.confirmPassword = cat().forms.passwordsDontMatch;
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        posting.current = true;
        setErrors({});
        setOutcome({ kind: 'pending' });
        try {
            // also ends this browser's session: a reset logs out every session
            await authService.resetPassword(token, newPassword);
            setOutcome({ kind: 'done' });
        } catch (error) {
            const status = error instanceof ApiError ? error.status : 0;
            const message = errorMessage(error, cat().errors.codes.LINK_INVALID);
            // the 400 field map {"newPassword": ...}: validation runs before the link is spent, so it is still usable
            if (status === 400 && message === cat().errors.rules.password) {
                posting.current = false;
                setErrors({ newPassword: message });
                setOutcome({ kind: 'idle' });
                return;
            }
            setOutcome({
                kind: 'failed',
                // their text is the browser's or Spring's ("Failed to fetch", "Internal Server Error")
                message: isNetworkOrServerFailure(status) ? cat().auth.reset.failed : message,
                status,
            });
        }
    };

    return (
        <AuthFrame>
            <h1 className="t-title text-center">{t.auth.reset.heading}</h1>

            <div className="mt-6">
                {!token ? (
                    <ErrorAlert message={t.errors.codes.LINK_INVALID} />
                ) : outcome.kind === 'done' ? (
                    <p className="t-body text-center text-success">{t.auth.reset.done}</p>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <Input
                            label={t.auth.reset.newPassword}
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            error={errors.newPassword}
                        />
                        <Input
                            label={t.auth.reset.confirmNewPassword}
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            error={errors.confirmPassword}
                        />
                        <ErrorAlert message={failed?.message ?? null} />
                        {rateLimited && <p className="t-footnote text-text-2">{t.auth.reset.rateLimited}</p>}
                        <Button
                            type="submit"
                            block
                            loading={outcome.kind === 'pending'}
                            disabled={outcome.kind !== 'idle'}
                        >
                            {t.auth.reset.submit}
                        </Button>
                    </form>
                )}
            </div>

            {outcome.kind === 'done' ? (
                <p className="t-callout mt-4 text-center">
                    <Link to="/login" className={`inline-flex min-h-11 items-center ${AUTH_LINK}`}>{t.common.signIn}</Link>
                </p>
            ) : linkDead && (
                <p className="t-callout mt-4 text-center text-text-2">
                    <Link to="/forgot-password" className={`inline-flex min-h-11 items-center ${AUTH_LINK}`}>{t.auth.reset.requestNewLink}</Link>
                    {serverFailure && ` ${t.auth.reset.keepsHappening}`}
                </p>
            )}
        </AuthFrame>
    );
}
