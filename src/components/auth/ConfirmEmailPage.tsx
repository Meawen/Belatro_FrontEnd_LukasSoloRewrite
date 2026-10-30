import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { authService } from '../../services/authService';
import { ApiError } from '../../services/api';
import { errorMessage, isNetworkOrServerFailure } from '../../utils/errorMessage';
import { safeReturnPath } from '../../routing/returnPath';
import { AuthFrame, AUTH_LINK } from './AuthFrame';
import { useReturnState } from './returnState';
import { cat, useT } from '../../i18n/t';
import type { Catalog } from '../../i18n/catalog/types';

type Outcome =
    | { kind: 'idle' }
    | { kind: 'pending' }
    | { kind: 'confirmed' }
    | { kind: 'failed'; message: string; status: number };

/**
 * A reload is a new page view and may post again. After a 429 the link is unspent (the limiter
 * runs first); after a network failure or a 5xx the reload is the only way to find out.
 */
function reloadHint(outcome: Outcome, t: Catalog): string | null {
    if (outcome.kind !== 'failed') return null;
    if (outcome.status === 429) return t.auth.confirm.reloadLater;
    return isNetworkOrServerFailure(outcome.status) ? t.auth.confirm.reload : null;
}

/** What the reader can do after a failure, or null when there is nothing to offer. */
function nextStep(token: string, outcome: Outcome): 'newLink' | 'changeAddress' | null {
    if (!token) return 'newLink';
    // 429: the link is not spent, only rate-limited; trying again later is the remedy.
    if (outcome.kind !== 'failed' || outcome.status === 429) return null;
    // 409: the address stays pending but can never be confirmed, so a new link would fail too.
    return outcome.status === 409 ? 'changeAddress' : 'newLink';
}

/**
 * /confirm-email?token=... - the link from the confirmation mail.
 * Confirming takes a click rather than happening on load: the token is
 * single-use, and StrictMode's double effects (or a mail scanner that runs
 * scripts) would otherwise spend it before the reader sees the page.
 */
export function ConfirmEmailPage() {
    const t = useT();
    const [searchParams] = useSearchParams();
    const token = (searchParams.get('token') ?? '').trim();
    const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });
    // The link is posted once and its first answer is final. The ref stops a second
    // click that lands before React re-renders the button as disabled.
    const posted = useRef(false);
    const signedIn = authService.isAuthenticated();
    // the return path (spec §4.1): signed in, Continue goes there; signed out, sign-in is handed it
    const returnState = useReturnState();
    const hint = nextStep(token, outcome);
    const reload = reloadHint(outcome, t);

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
                message: isNetworkOrServerFailure(status) ? cat().auth.confirm.failed : errorMessage(error, cat().errors.codes.LINK_INVALID),
                status,
            });
        }
    };

    return (
        <AuthFrame>
            <div className="flex flex-col items-center gap-4 text-center">
                <h1 className="t-title">{t.auth.confirm.heading}</h1>

                {!token ? (
                    <ErrorAlert message={t.errors.codes.LINK_INVALID} className="w-full text-left" />
                ) : outcome.kind === 'confirmed' ? (
                    <>
                        <p className="t-body text-success">{t.auth.confirm.confirmed}</p>
                        <Link
                            to={signedIn ? safeReturnPath(returnState?.from) : '/login'}
                            state={signedIn ? undefined : returnState}
                            className={`inline-flex min-h-11 items-center ${AUTH_LINK}`}
                        >
                            {t.common.continue}
                        </Link>
                    </>
                ) : (
                    <>
                        {outcome.kind === 'failed' && <ErrorAlert message={outcome.message} className="w-full text-left" />}
                        <Button
                            block
                            onClick={handleConfirm}
                            loading={outcome.kind === 'pending'}
                            disabled={outcome.kind !== 'idle'}
                        >
                            {t.auth.confirm.button}
                        </Button>
                    </>
                )}

                {reload && <p className="t-footnote text-text-2">{reload}</p>}

                {hint && (
                    <p className="t-footnote text-text-2">
                        {signedIn ? (
                            // X-11: e-mail management lives in Settings
                            <>{hint === 'newLink' ? t.auth.confirm.newLinkInSettings : t.auth.confirm.changeAddressInSettings}{' '}<Link to="/settings" className={AUTH_LINK}>{t.auth.confirm.settingsLink}</Link>.</>
                        ) : (
                            <><Link to="/login" state={returnState} className={AUTH_LINK}>{t.common.signIn}</Link>{' '}{hint === 'newLink' ? t.auth.confirm.toNewLink : t.auth.confirm.toChangeAddress}</>
                        )}
                    </p>
                )}
            </div>
        </AuthFrame>
    );
}
