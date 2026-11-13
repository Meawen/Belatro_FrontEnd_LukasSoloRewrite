import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthFrame } from '../components/auth/AuthFrame';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { Button, type ButtonVariant } from '../components/ui';
import { useActiveGame } from '../hooks/useActiveGame';
import { useBotGame } from '../hooks/useBotGame';
import { usePageTitle } from '../routing/usePageTitle';
import { ApiError } from '../services/api';
import { authService } from '../services/authService';
import { betaService } from '../services/betaService';
import { errorMessage, isNetworkOrServerFailure } from '../utils/errorMessage';
import { getLang } from '../i18n/lang';
import { cat, useT } from '../i18n/t';
import type { Catalog } from '../i18n/catalog/types';

type Outcome =
    | { kind: 'idle' }
    | { kind: 'pending' }
    | { kind: 'confirmed' }
    | { kind: 'failed'; message: string; status: number };

/**
 * A reload is a new page view and may post again. After a 429 the link is unspent (the limiter runs first); after a
 * network failure or a 5xx the reload is the only way to find out (as ConfirmEmailPage).
 */
function reloadHint(outcome: Outcome, t: Catalog): string | null {
    if (outcome.kind !== 'failed') return null;
    if (outcome.status === 429) return t.auth.confirm.reloadLater;
    return isNetworkOrServerFailure(outcome.status) ? t.auth.confirm.reload : null;
}

/**
 * /waitlist/confirm?token=… (spec §2.2), the link in the waitlist's confirmation mail, reachable signed in or out.
 * Confirming takes a click, as ConfirmEmailPage does: a mail scanner that runs scripts must not confirm someone's
 * address. A dead link (no token, or the server's WAITLIST_LINK_INVALID for an expired or unknown one, Ruling 42) offers
 * to join again, through /signup, which shows whichever form applies; every outcome offers a game against bots now.
 */
export function WaitlistConfirmPage() {
    const t = useT();
    usePageTitle(t.titles.waitlist);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = (searchParams.get('token') ?? '').trim();
    const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });
    // The link is posted once and its first answer is final. The ref stops a second click that lands before React
    // re-renders the button as disabled.
    const posted = useRef(false);
    // as Škola bele's end: nothing is asked before the bots are refused with ALREADY_IN_GAME (a guest's game still runs),
    // then the running game is looked up and offered (R4 review: this page shows no banner)
    const [lookUp, setLookUp] = useState(false);
    const { gameId: running } = useActiveGame(lookUp);
    const bots = useBotGame({ onAlreadyInGame: () => setLookUp(true) });
    const reload = reloadHint(outcome, t);
    const dead = !token || (outcome.kind === 'failed' && outcome.status !== 429 && !isNetworkOrServerFailure(outcome.status));

    // a visitor with no session becomes a guest first (spec §3), decided at click time from storage, as the landing page does
    const playBots = () =>
        void bots.play(authService.isAuthenticated() ? undefined : () => authService.startGuest(getLang()));

    // the game against bots; with a game running, the way back to it comes first in the bots' place (spec §8, Ruling 71)
    const botsWays = (variant: ButtonVariant) => (
        <>
            {running && <Button variant={variant} block onClick={() => navigate(`/game/${running}`)}>{t.shell.activeGame.action}</Button>}
            <Button variant={running ? 'secondary' : variant} block loading={bots.starting} onClick={playBots}>{t.guest.needsAccount.bots}</Button>
            <ErrorAlert message={bots.error} className="w-full text-left" />
        </>
    );

    const confirm = async () => {
        if (posted.current) return;
        posted.current = true;
        setOutcome({ kind: 'pending' });
        try {
            await betaService.confirmWaitlist(token);
            setOutcome({ kind: 'confirmed' });
        } catch (error) {
            const status = error instanceof ApiError ? error.status : 0;
            setOutcome({
                kind: 'failed',
                // their text is the browser's or Spring's ("Failed to fetch", "Internal Server Error")
                message: isNetworkOrServerFailure(status) ? cat().auth.waitlistConfirm.failed : errorMessage(error, cat().errors.codes.WAITLIST_LINK_INVALID),
                status,
            });
        }
    };

    return (
        <AuthFrame>
            <div className="flex flex-col items-center gap-4 text-center">
                <h1 className="t-title">{t.auth.waitlistConfirm.heading}</h1>

                {dead ? (
                    <>
                        <ErrorAlert message={!token ? t.errors.codes.WAITLIST_LINK_INVALID : outcome.kind === 'failed' ? outcome.message : null} className="w-full text-left" />
                        <Button block onClick={() => navigate('/signup')}>{t.auth.waitlistConfirm.again}</Button>
                        {botsWays('secondary')}
                    </>
                ) : outcome.kind === 'confirmed' ? (
                    <>
                        <p className="t-body text-success">{t.auth.waitlistConfirm.confirmed}</p>
                        {botsWays('primary')}
                    </>
                ) : (
                    <>
                        {outcome.kind === 'failed' && <ErrorAlert message={outcome.message} className="w-full text-left" />}
                        <Button block onClick={confirm} loading={outcome.kind === 'pending'} disabled={outcome.kind !== 'idle'}>
                            {t.auth.waitlistConfirm.button}
                        </Button>
                        {reload && <p className="t-footnote text-text-2">{reload}</p>}
                    </>
                )}
            </div>
        </AuthFrame>
    );
}
