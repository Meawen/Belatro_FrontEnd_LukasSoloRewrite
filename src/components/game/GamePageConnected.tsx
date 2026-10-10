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
import { DECLINED_NOTICE, rematchOffered } from './gameView';

export default function GamePageConnected() {
    const { gameId = '' } = useParams();
    // useGameViews keeps its views in state and does not reset them when the id
    // changes, so each game id gets its own mount: never the previous game's views.
    // The table has its own error boundary (R-29): a crash in it leaves the app shell standing,
    // and the key gives the next game id a fresh boundary as well.
    return (
        <ErrorBoundary key={gameId}>
            <GamePage gameId={gameId} />
        </ErrorBoundary>
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
    const navigate = useNavigate();
    const { user } = useAuth();

    const { view, publicView, isConnected, connectionError, error, notAvailable, actions } =
        useGameViews(gameId, () => navigate('/lobbies'));
    const rematch = useRematch(gameId, publicView !== null && rematchOffered(publicView));
    const hands = useMatchHands(gameId, publicView);

    // spec §3.6: all 39 images decoded once on entering the game, no React state per image
    useEffect(() => {
        void preloadCardArt();
    }, []);

    // R-25: someone declined the ranked match; the other three are back in the queue, which /play shows
    const declined = publicView?.gameState === 'CANCELLED' && publicView.endReason === 'DECLINED';
    useEffect(() => {
        if (declined) navigate('/play', { replace: true, state: { notice: DECLINED_NOTICE } });
    }, [declined, navigate]);

    // R-35: the server never sent this game, or said it isn't this player's: a way back, not a spinner
    if (notAvailable) {
        return (
            <div className="felt flex min-h-dvh items-center justify-center p-4 text-text">
                <Panel padding="lg" className="w-full max-w-md">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <p className="t-headline">This game isn't yours or has ended</p>
                        <Button onClick={() => navigate('/dashboard')}>Back to dashboard</Button>
                    </div>
                </Panel>
            </div>
        );
    }

    if (!view) {
        return (
            <div className="felt flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-text">
                <ReconnectStrip />
                <Loader layout="block" text={isConnected ? 'Loading game state...' : 'Connecting to game...'} />
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
                onLeave={() => navigate('/lobbies')}
            />
            <ReconnectStrip />
        </>
    );
}
