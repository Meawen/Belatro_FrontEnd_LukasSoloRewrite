import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useBelatroGame } from '../../hooks/useBelatroGame';
import { Button, Loading } from '../common';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { GameTable } from './GameTable';
import { ReconnectBanner } from './ReconnectBanner';

export default function GamePageConnected() {
    const { gameId = '' } = useParams();
    // useBelatroGame keeps its views in state and does not reset them when the id
    // changes, so each game id gets its own mount: never the previous game's views.
    // The table has its own error boundary (R-29): a crash in it leaves the app shell standing,
    // and the key gives the next game id a fresh boundary as well.
    return (
        <ErrorBoundary key={gameId}>
            <GamePage gameId={gameId} />
        </ErrorBoundary>
    );
}

function GamePage({ gameId }: { gameId: string }) {
    const navigate = useNavigate();
    const { user } = useAuth();

    const { publicView, privateView, isConnected, connectionError, error, notAvailable, actions } =
        useBelatroGame(gameId, () => navigate('/lobbies'));

    // R-35: the server never sent this game, or said it isn't this player's: a way back, not a spinner
    if (notAvailable) {
        return (
            <div className="card max-w-md mx-auto text-center space-y-4">
                <p className="text-lg text-white">This game isn't yours or has ended</p>
                <Button variant="primary" onClick={() => navigate('/dashboard')}>Back to dashboard</Button>
            </div>
        );
    }

    if (!publicView) {
        return (
            <>
                <ReconnectBanner />
                <div className="flex flex-col items-center justify-center min-h-96 gap-4">
                    <Loading size="large" text={isConnected ? 'Loading game state...' : 'Connecting to game...'} />
                    {connectionError && <p role="alert" className="text-red-300 text-sm">{connectionError}</p>}
                </div>
            </>
        );
    }

    return (
        <>
            <ReconnectBanner />
            <GameTable
                publicView={publicView}
                privateView={privateView}
                me={user?.username ?? ''}
                error={error}
                onPass={actions.passBid}
                onCallTrump={actions.bidTrump}
                onPlayCard={actions.play}
                onChallenge={actions.challenge}
                onLeave={() => navigate('/lobbies')}
            />
        </>
    );
}
