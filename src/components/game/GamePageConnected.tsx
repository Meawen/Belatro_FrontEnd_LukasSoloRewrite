import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useGameViews } from '../../hooks/useGameViews';
import { useMatchHands } from '../../hooks/useMatchHands';
import { useRematch } from '../../hooks/useRematch';
import { preloadCardArt } from '../../services/cardArt';
import { Board } from '../board/Board';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { Button } from '../ui/Button';
import { Loader } from '../ui/Loader';
import { Panel } from '../ui/Panel';
import { ReconnectBanner } from './ReconnectBanner';
import { rematchOffered } from './gameView';
import { cat, useT } from '../../i18n/t';

export default function GamePageConnected() {
    const t = useT();
    const { gameId = '' } = useParams();
    // useGameViews keeps its views in state and does not reset them when the id
    // changes, so each game id gets its own mount: never the previous game's views.
    // The table has its own error boundary (R-29): a crash in it leaves the app shell standing,
    // and the key gives the next game id a fresh boundary as well.
    return (
        <>
            {/* one h1 per page (spec §3.9) in every state, the crash screen too: the HUD names the table visually */}
            <h1 className="sr-only">{t.titles.game}</h1>
            <ErrorBoundary key={gameId}>
                <GamePage gameId={gameId} />
            </ErrorBoundary>
        </>
    );
}

/** The Reconnecting strip (R-30), at the top over the table or the loading screen. */
function ReconnectStrip() {
    return (
        <div className="fixed left-1/2 top-[calc(60px+var(--safe-top))] z-(--z-sheet) w-[min(420px,calc(100%-32px))] -translate-x-1/2">
            <ReconnectBanner />
        </div>
    );
}

function GamePage({ gameId }: { gameId: string }) {
    const t = useT();
    const navigate = useNavigate();
    const { user, isGuest } = useAuth();
    // spec §6: the game page's ways out. A member goes Doma; a guest goes to the landing page (a guest can't open the
    // Birtija or Doma) and may also sign up (Ruling 6). While a rematch is on offer, going also declines it for
    // everyone (R-45), as Leave did.
    const home = isGuest ? '/' : '/dashboard';

    const { view, publicView, isConnected, connectionError, error, notAvailable, actions } =
        useGameViews(gameId, () => navigate(home));
    const offered = publicView !== null && rematchOffered(publicView);
    const rematch = useRematch(gameId, offered);
    const go = (to: string) => {
        if (offered) rematch.leave(to);
        else navigate(to);
    };
    const hands = useMatchHands(gameId, publicView);

    // spec §3.6: all 39 images decoded once on entering the game, no React state per image
    useEffect(() => {
        void preloadCardArt();
    }, []);

    // R-25: someone declined the ranked match; the other three are back in the queue, which /play shows
    const declined = publicView?.gameState === 'CANCELLED' && publicView.endReason === 'DECLINED';
    useEffect(() => {
        if (declined) navigate('/play', { replace: true, state: { notice: cat().game.end.declined } });
    }, [declined, navigate]);

    // R-35: the server never sent this game, or said it isn't this player's: a way back, not a spinner
    if (notAvailable) {
        return (
            <div className="felt flex min-h-dvh items-center justify-center p-4 text-text">
                <Panel padding="lg" className="w-full max-w-md">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <p className="t-headline">{t.game.notYours}</p>
                        <Button onClick={() => navigate('/dashboard')}>{t.game.goHome}</Button>
                    </div>
                </Panel>
            </div>
        );
    }

    if (!view) {
        return (
            <div className="felt flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-text">
                <ReconnectStrip />
                {/* connecting, and connected while the first state comes: the same first frame as App's chunk fallback (spec §1.4 Loading) */}
                <Loader layout="block" text={t.common.loading} />
                {connectionError && <p role="alert" className="t-callout text-danger-text">{connectionError}</p>}
            </div>
        );
    }

    return (
        <>
            <Board
                state={view}
                me={user?.username ?? ''}
                actions={actions}
                error={error}
                isConnected={isConnected}
                hands={hands}
                rematch={rematch}
                onLeave={() => go(home)}
                guest={isGuest}
                onSignUp={isGuest ? () => go('/signup') : undefined}
            />
            <ReconnectStrip />
        </>
    );
}
