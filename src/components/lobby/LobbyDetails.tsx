import React from 'react';
import { TeamManagement } from './TeamManagment.tsx';
import { LobbyControls } from './LobbyControls';
import { Loading, Button } from '../common';
import { useLobby } from '../../hooks/useLobby';
import { useAuth } from '../../hooks/useAuth';

export interface LobbyDetailsProps {
    lobbyId: string;
}

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

    if (isLoading) {
        return <Loading size="large" text="Loading lobby..." />;
    }

    if (error || !lobby) {
        const errorMessage = error ? (typeof error === 'string' ? error : 'Failed to load lobby') : 'Lobby not found';

        return (
            <div className="card bg-red-900/20 border-red-500/30">
                <div className="flex items-center gap-3">
                    <div className="text-red-400 text-2xl">⚠️</div>
                    <div>
                        <h3 className="text-red-400 font-semibold">Error Loading Lobby</h3>
                        <p className="text-red-300 text-sm">{errorMessage}</p>
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

    const canStartMatch = isHost &&
        (lobby.teamAPlayers?.length || 0) >= 1 &&
        (lobby.teamBPlayers?.length || 0) >= 1;

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
                            onClick={startMatch}
                            variant="primary"
                            disabled={!canStartMatch || isStartingMatch}
                        >
                            {isStartingMatch ? 'Starting...' : '🚀 Start Match'}
                        </Button>
                    )}
                </div>
            </div>

            {/* Start Match Requirements */}
            {isHost && !canStartMatch && (
                <div className="card bg-yellow-900/20 border-yellow-500/30">
                    <div className="flex items-center gap-3">
                        <div className="text-yellow-400 text-xl">⚠️</div>
                        <div>
                            <h3 className="text-yellow-400 font-semibold">Cannot Start Match</h3>
                            <p className="text-yellow-300 text-sm">
                                Each team needs at least 1 player to start a match.
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