import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../common';
import type { LobbyDTO } from '../../types/lobby';
import type { UserSimpleDTO } from '../../types/user';

export interface LobbyCardProps {
    lobby: LobbyDTO;
    currentUser: UserSimpleDTO | null;
    onJoin: () => void;
    onRefresh: () => void;
}

export const LobbyCard: React.FC<LobbyCardProps> = ({
                                                        lobby,
                                                        currentUser,
                                                        onJoin
                                                    }) => {
    const navigate = useNavigate();
    const isHost = currentUser?.id === lobby.hostUser?.id;
    const isPlayerInLobby = [
        ...(lobby.teamAPlayers || []),
        ...(lobby.teamBPlayers || []),
        ...(lobby.unassignedPlayers || [])
    ].some(player => player.id === currentUser?.id);

    const totalPlayers =
        (lobby.teamAPlayers?.length || 0) +
        (lobby.teamBPlayers?.length || 0) +
        (lobby.unassignedPlayers?.length || 0);

    const getStatusBadge = () => {
        switch (lobby.status) {
            case 'WAITING':
                return <span className="badge badge-green">Open</span>;
            case 'CLOSED':
                return <span className="badge badge-red">Closed</span>;
            default:
                return <span className="badge badge-gray">Unknown</span>;
        }
    };

    const getGameModeIcon = () => {
        switch (lobby.gameMode?.toLowerCase()) {
            case 'casual':
                return '🎮';
            case 'ranked':
                return '🏆';
            default:
                return '🃏';
        }
    };

    return (
        <div className="card hover:border-purple-500/50 transition-all duration-200">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-white truncate">
                            {lobby.name || 'Unnamed Lobby'}
                        </h3>
                        {lobby.privateLobby && (
                            <span className="text-yellow-400 text-sm">🔒</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <span>{getGameModeIcon()}</span>
                        <span className="capitalize">{lobby.gameMode || 'Unknown'}</span>
                        <span>•</span>
                        {getStatusBadge()}
                    </div>
                </div>
            </div>

            {/* Host Info */}
            <div className="mb-4">
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-400">Host:</span>
                    <span className="text-white font-medium">
            {lobby.hostUser?.username || 'Unknown'}
          </span>
                    {isHost && (
                        <span className="badge badge-blue text-xs">You</span>
                    )}
                </div>
            </div>

            {/* Players */}
            <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-slate-400">Players</span>
                    <span className="text-white">{totalPlayers}/4</span>
                </div>

                <div className="space-y-2">
                    {/* Team A */}
                    {lobby.teamAPlayers && lobby.teamAPlayers.length > 0 && (
                        <div>
                            <div className="text-xs text-blue-400 mb-1">Team A</div>
                            <div className="flex flex-wrap gap-1">
                                {lobby.teamAPlayers.map(player => (
                                    <span
                                        key={player.id}
                                        className="badge badge-blue text-xs"
                                    >
                    {player.username}
                  </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Team B */}
                    {lobby.teamBPlayers && lobby.teamBPlayers.length > 0 && (
                        <div>
                            <div className="text-xs text-red-400 mb-1">Team B</div>
                            <div className="flex flex-wrap gap-1">
                                {lobby.teamBPlayers.map(player => (
                                    <span
                                        key={player.id}
                                        className="badge badge-red text-xs"
                                    >
                    {player.username}
                  </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Unassigned */}
                    {lobby.unassignedPlayers && lobby.unassignedPlayers.length > 0 && (
                        <div>
                            <div className="text-xs text-slate-400 mb-1">Unassigned</div>
                            <div className="flex flex-wrap gap-1">
                                {lobby.unassignedPlayers.map(player => (
                                    <span
                                        key={player.id}
                                        className="badge badge-gray text-xs"
                                    >
                    {player.username}
                  </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Created Time */}
            {lobby.createdAt && (
                <div className="text-xs text-slate-500 mb-4">
                    Created {new Date(lobby.createdAt).toLocaleString()}
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
                {isPlayerInLobby ? (
                    <Button
                        variant="primary"
                        size="small"
                        className="flex-1"
                        onClick={() => {
                            // Navigate to lobby details
                            navigate(`/lobby/${lobby.id}`);
                        }}
                    >
                        Enter Lobby
                    </Button>
                ) : lobby.status === 'WAITING' && totalPlayers < 4 ? (
                    <Button
                        variant="outline"
                        size="small"
                        className="flex-1"
                        onClick={onJoin}
                    >
                        Join Lobby
                    </Button>
                ) : (
                    <Button
                        variant="outline"
                        size="small"
                        className="flex-1"
                        disabled
                    >
                        {lobby.status === 'CLOSED' ? 'Closed' : 'Full'}
                    </Button>
                )}
            </div>
        </div>
    );
};