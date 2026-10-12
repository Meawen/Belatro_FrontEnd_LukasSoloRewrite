import { useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Input } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { authService } from '../../services/authService';
import { ApiError } from '../../services/api';
import { errorMessage, INVALID_LINK, isNetworkOrServerFailure } from '../../utils/errorMessage';
import { PASSWORD_RULE_MESSAGE, passwordRuleError } from './credentialRules';
import { AuthFrame, AUTH_LINK } from './AuthFrame';

type Outcome =
    | { kind: 'idle' }
    | { kind: 'pending' }
    | { kind: 'done' }
    | { kind: 'failed'; message: string; status: number };

const COULD_NOT_RESET = 'We could not reset your password.';

/** /reset-password?token=... - the link from the reset mail (valid 15 minutes, single use). */
export function ResetPasswordPage() {
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
        if (confirmPassword !== newPassword) newErrors.confirmPassword = 'Passwords do not match';
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
            const message = errorMessage(error, INVALID_LINK);
            // the 400 field map {"newPassword": ...}: validation runs before the link is spent, so it is still usable
            if (status === 400 && message === PASSWORD_RULE_MESSAGE) {
                posting.current = false;
                setErrors({ newPassword: message });
                setOutcome({ kind: 'idle' });
                return;
            }
            setOutcome({
                kind: 'failed',
                // their text is the browser's or Spring's ("Failed to fetch", "Internal Server Error")
                message: isNetworkOrServerFailure(status) ? COULD_NOT_RESET : message,
                status,
            });
        }
    };

    return (
        <AuthFrame>
            <h1 className="t-title text-center">Choose a new password</h1>

            <div className="mt-6">
                {!token ? (
                    <ErrorAlert message={INVALID_LINK} />
                ) : outcome.kind === 'done' ? (
                    <p className="t-body text-center text-success">Your password has been reset. Sign in with your new password.</p>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <Input
                            label="New password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            error={errors.newPassword}
                        />
                        <Input
                            label="Confirm new password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            error={errors.confirmPassword}
                        />
                        <ErrorAlert message={failed?.message ?? null} />
                        {rateLimited && <p className="t-footnote text-text-2">Wait a while, then reload this page to try again.</p>}
                        <Button
                            type="submit"
                            block
                            loading={outcome.kind === 'pending'}
                            disabled={outcome.kind !== 'idle'}
                        >
                            Reset password
                        </Button>
                    </form>
                )}
            </div>

            {outcome.kind === 'done' ? (
                <p className="t-callout mt-4 text-center">
                    <Link to="/login" className={`inline-flex min-h-11 items-center ${AUTH_LINK}`}>Sign in</Link>
                </p>
            ) : linkDead && (
                <p className="t-callout mt-4 text-center text-text-2">
                    <Link to="/forgot-password" className={`inline-flex min-h-11 items-center ${AUTH_LINK}`}>Request a new link</Link>
                    {serverFailure && ' if this keeps happening.'}
                </p>
            )}
        </AuthFrame>
    );
}
