import React, { useEffect, useRef, useState } from 'react';
import { TeamManagement } from './TeamManagment.tsx';
import { LobbyControls } from './LobbyControls';
import { Loading, Button, ErrorAlert } from '../common';
import { useLobby } from '../../hooks/useLobby';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from "react-router-dom";
import { matchService } from "../../services/matchService";
import { ApiError } from '../../services/api';
import { errorMessage } from '../../utils/errorMessage';

export interface LobbyDetailsProps {
    lobbyId: string;
}

// A casual start pushes nothing over STOMP: members learn about it by polling.
const LOBBY_POLL_MS = 3000;

export const LobbyDetails: React.FC<LobbyDetailsProps> = ({ lobbyId }) => {
    const {
        lobby,
        isLoading,
        error,
        refetch,
        startMatch,
        isStartingMatch
    } = useLobby(lobbyId);

    const { user } = useAuth();
    const navigate = useNavigate();
    const [startError, setStartError] = useState<string | null>(null);
    const [pollError, setPollError] = useState<string | null>(null);
    const [followError, setFollowError] = useState<string | null>(null);
    const hasLobby = lobby != null;

    // A failed poll keeps the last good lobby on screen and only says so;
    // the next successful poll clears the message. Nothing polls before a lobby
    // has loaded, so a failed first load keeps its error card and Try Again button.
    const refetchRef = useRef(refetch);
    refetchRef.current = refetch;
    useEffect(() => {
        if (!hasLobby) return;
        const timer = window.setInterval(() => {
            refetchRef.current().then(
                () => setPollError(null),
                (e) => setPollError(`Could not refresh the lobby: ${errorMessage(e, 'unknown error')}`),
            );
        }, LOBBY_POLL_MS);
        return () => window.clearInterval(timer);
    }, [hasLobby]);

    const isMember = [
        ...(lobby?.teamAPlayers ?? []),
        ...(lobby?.teamBPlayers ?? []),
        ...(lobby?.unassignedPlayers ?? []),
    ].some((player) => player?.id === user?.id);
    const lobbyClosed = lobby?.status === 'CLOSED';

    // Once the host starts, the lobby closes and every member follows it into the
    // game. The lobby is saved CLOSED before its match exists, so a 404 means
    // "not yet": try again after the next poll interval. Any other failure is
    // shown (in its own state, so a good lobby poll can't blink it away) and
    // retried too. `replace`: Back from the game must not land on this page,
    // which would follow straight back in.
    useEffect(() => {
        if (!lobbyClosed || !isMember) return;
        let cancelled = false;
        let retry: number | undefined;
        const follow = () => {
            matchService.getMatchByLobbyId(lobbyId)
                .then((match) => {
                    if (!cancelled && match?.id) navigate(`/game/${match.id}`, { replace: true });
                })
                .catch((e) => {
                    if (cancelled) return;
                    const notYet = e instanceof ApiError && e.status === 404;
                    setFollowError(notYet ? null : `Could not open the match: ${errorMessage(e, 'unknown error')}`);
                    retry = window.setTimeout(follow, LOBBY_POLL_MS);
                });
        };
        follow();
        return () => {
            cancelled = true;
            if (retry) window.clearTimeout(retry);
        };
    }, [lobbyClosed, isMember, lobbyId, navigate]);

    // Only the first load shows a spinner; later polls keep the page in place.
    if (isLoading && !lobby) {
        return <Loading size="large" text="Loading lobby..." />;
    }

    // Only a failed first load replaces the page; a failed poll leaves the last lobby up.
    if (!lobby) {
        const loadError = error ? errorMessage(error, 'Failed to load lobby') : 'Lobby not found';

        return (
            <div className="card bg-red-900/20 border-red-500/30">
                <div className="flex items-center gap-3">
                    <div className="text-red-400 text-2xl">⚠️</div>
                    <div>
                        <h3 className="text-red-400 font-semibold">Error Loading Lobby</h3>
                        <p className="text-red-300 text-sm">{loadError}</p>
                    </div>
                </div>
                <div className="flex gap-3 mt-4">
                    <Button
                        onClick={refetch}
                        variant="outline"
                        size="small"
                    >
                        Try Again
                    </Button>
                    <Button
                        onClick={() => window.history.back()}
                        variant="primary"
                        size="small"
                    >
                        Go Back
                    </Button>
                </div>
            </div>
        );
    }

    const isHost = user?.id === lobby.hostUser?.id;
    const totalPlayers =
        (lobby.teamAPlayers?.length || 0) +
        (lobby.teamBPlayers?.length || 0) +
        (lobby.unassignedPlayers?.length || 0);

    const teamACount = lobby.teamAPlayers?.length ?? 0;
    const teamBCount = lobby.teamBPlayers?.length ?? 0;

    const canStartMatch = Boolean(isHost && teamACount === 2 && teamBCount === 2);

    const handleStartMatch = async () => {
        setStartError(null);
        try {
            const match = await startMatch();
            if (match?.id) navigate(`/game/${match.id}`, { replace: true });
        } catch (e) {
            setStartError(errorMessage(e, 'Failed to start match'));
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold text-white">
                            {lobby.name || 'Unnamed Lobby'}
                        </h1>
                        {lobby.privateLobby && (
                            <span className="text-yellow-400 text-xl">🔒</span>
                        )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-1">
              {lobby.gameMode === 'RANKED' ? '🏆' : '🎮'}
                <span className="capitalize">{lobby.gameMode}</span>
            </span>
                        <span>•</span>
                        <span>Host: {lobby.hostUser?.username}</span>
                        <span>•</span>
                        <span>{totalPlayers}/4 Players</span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <Button
                        onClick={refetch}
                        variant="outline"
                        size="small"
                    >
                        🔄 Refresh
                    </Button>

                    {isHost && (
                        <Button
                            onClick={handleStartMatch}
                            variant="primary"
                            disabled={!canStartMatch || isStartingMatch}
                        >
                            {isStartingMatch ? "Starting..." : "🚀 Start Match"}
                        </Button>
                    )}
                </div>
            </div>

            <ErrorAlert message={startError} />
            <ErrorAlert message={pollError ?? followError} />

            {/* Start Match Requirements */}
            {isHost && !canStartMatch && (
                <div className="card bg-yellow-900/20 border-yellow-500/30">
                    <div className="flex items-center gap-3">
                        <div className="text-yellow-400 text-xl">⚠️</div>
                        <div>
                            <h3 className="text-yellow-400 font-semibold">Cannot Start Match</h3>
                            <p className="text-yellow-300 text-sm">
                                Each team needs exactly 2 players, and nobody may be unassigned.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Team Management */}
            <TeamManagement
                lobby={lobby}
                currentUser={user}
                onUpdate={refetch}
            />

            {/* Lobby Controls */}
            <LobbyControls
                lobby={lobby}
                currentUser={user}
                onUpdate={refetch}
            />

            {/* Lobby Info */}
            <div className="card">
                <h3 className="text-lg font-semibold text-white mb-4">Lobby Information</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-slate-400">Created:</span>
                        <div className="text-white">
                            {lobby.createdAt ? new Date(lobby.createdAt).toLocaleString() : 'Unknown'}
                        </div>
                    </div>

                    <div>
                        <span className="text-slate-400">Status:</span>
                        <div className="text-white">
                            {lobby.status === 'WAITING' ? (
                                <span className="text-green-400">Open for Players</span>
                            ) : (
                                <span className="text-red-400">Closed</span>
                            )}
                        </div>
                    </div>

                    <div>
                        <span className="text-slate-400">Lobby Type:</span>
                        <div className="text-white">
                            {lobby.privateLobby ? (
                                <span className="text-yellow-400">🔒 Private</span>
                            ) : (
                                <span className="text-green-400">🌐 Public</span>
                            )}
                        </div>
                    </div>

                    <div>
                        <span className="text-slate-400">Game Mode:</span>
                        <div className="text-white capitalize">
                            {lobby.gameMode === 'RANKED' ? '🏆 Ranked' : '🎮 Casual'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
