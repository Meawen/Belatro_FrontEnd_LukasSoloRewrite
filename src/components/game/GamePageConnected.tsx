import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useBelatroGame } from '../../hooks/useBelatroGame';
import { Loading } from '../common';
import { GameTable } from './GameTable';
import { ReconnectBanner } from './ReconnectBanner';

export default function GamePageConnected() {
    const { gameId = '' } = useParams();
    // useBelatroGame keeps its views in state and does not reset them when the id
    // changes, so each game id gets its own mount: never the previous game's views.
    return <GamePage key={gameId} gameId={gameId} />;
}

function GamePage({ gameId }: { gameId: string }) {
    const navigate = useNavigate();
    const { user } = useAuth();

    const { publicView, privateView, isConnected, connectionError, error, actions } =
        useBelatroGame(gameId, () => navigate('/lobbies'));

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
