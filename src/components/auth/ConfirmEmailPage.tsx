import React, { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../common';
import { authService } from '../../services/authService';
import { ApiError } from '../../services/api';
import { errorMessage } from '../../utils/errorMessage';

type Outcome =
    | { kind: 'idle' }
    | { kind: 'pending' }
    | { kind: 'confirmed' }
    | { kind: 'failed'; message: string; status: number };

const INVALID_LINK = 'This link is invalid or has expired';
const COULD_NOT_CONFIRM = 'We could not confirm your email address.';

/** A network failure (status 0) or a 5xx: no usable answer, and the link may or may not be spent. */
function isNetworkOrServerFailure(status: number): boolean {
    return status === 0 || status >= 500;
}

/**
 * A reload is a new page view and may post again. After a 429 the link is unspent (the limiter
 * runs first); after a network failure or a 5xx the reload is the only way to find out.
 */
function reloadHint(outcome: Outcome): string | null {
    if (outcome.kind !== 'failed') return null;
    if (outcome.status === 429) return 'Reload this page later to try again.';
    return isNetworkOrServerFailure(outcome.status) ? 'Reload this page to try again.' : null;
}

/** What the reader can do after a failure, or null when there is nothing to offer. */
function nextStep(token: string, outcome: Outcome): string | null {
    if (!token) return 'send a new link';
    // 429: the link is not spent, only rate-limited; trying again later is the remedy.
    if (outcome.kind !== 'failed' || outcome.status === 429) return null;
    // 409: the address stays pending but can never be confirmed, so a new link would fail too.
    return outcome.status === 409 ? 'change your email address' : 'send a new link';
}

/**
 * /confirm-email?token=... - the link from the confirmation mail.
 * Confirming takes a click rather than happening on load: the token is
 * single-use, and StrictMode's double effects (or a mail scanner that runs
 * scripts) would otherwise spend it before the reader sees the page.
 */
export const ConfirmEmailPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = (searchParams.get('token') ?? '').trim();
    const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });
    // The link is posted once and its first answer is final. The ref stops a second
    // click that lands before React re-renders the button as disabled.
    const posted = useRef(false);
    const signedIn = authService.isAuthenticated();
    const hint = nextStep(token, outcome);
    const reload = reloadHint(outcome);

    const handleConfirm = async () => {
        if (posted.current) return;
        posted.current = true;
        setOutcome({ kind: 'pending' });
        try {
            await authService.confirmEmail(token);
            setOutcome({ kind: 'confirmed' });
        } catch (error) {
            const status = error instanceof ApiError ? error.status : 0;
            setOutcome({
                kind: 'failed',
                // their text is the browser's or Spring's ("Failed to fetch", "Internal Server Error")
                message: isNetworkOrServerFailure(status) ? COULD_NOT_CONFIRM : errorMessage(error, INVALID_LINK),
                status,
            });
        }
    };

    return (
        <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-4">
            <div className="card max-w-md w-full text-center space-y-4">
                <h1 className="text-2xl font-bold text-white">Confirm your email address</h1>

                {!token ? (
                    <p role="alert" className="text-red-300">{INVALID_LINK}</p>
                ) : outcome.kind === 'confirmed' ? (
                    <>
                        <p className="text-emerald-200">Your email address is confirmed.</p>
                        <Link
                            to={signedIn ? '/dashboard' : '/login'}
                            className="text-yellow-500 hover:text-yellow-400 font-medium"
                        >
                            Continue
                        </Link>
                    </>
                ) : (
                    <>
                        {outcome.kind === 'failed' && (
                            <p role="alert" className="text-red-300">{outcome.message}</p>
                        )}
                        <Button
                            variant="primary"
                            fullWidth
                            onClick={handleConfirm}
                            isLoading={outcome.kind === 'pending'}
                            disabled={outcome.kind !== 'idle'}
                        >
                            Confirm email address
                        </Button>
                    </>
                )}

                {reload && <p className="text-sm text-slate-400">{reload}</p>}

                {hint && (
                    <p className="text-sm text-slate-400">
                        {signedIn ? (
                            <>You can {hint} from <Link to="/profile" className="text-yellow-500 hover:text-yellow-400">your profile</Link>.</>
                        ) : (
                            <><Link to="/login" className="text-yellow-500 hover:text-yellow-400">Sign in</Link> to {hint}.</>
                        )}
                    </p>
                )}
            </div>
        </div>
    );
};
