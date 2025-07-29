import React, { useState } from 'react';
import { Button, Modal, Input } from '../common';
import { useAuth } from '../../hooks/useAuth';
import { useLobbies } from '../../hooks/useLobby';
import type { LobbyDTO } from '../../types/lobby';

interface LobbyDetailsPopupProps {
    lobby: LobbyDTO;
    isOpen: boolean;
    onClose: () => void;
    onJoinSuccess?: () => void;
}

export const LobbyDetailsPopup: React.FC<LobbyDetailsPopupProps> = ({
                                                                        lobby,
                                                                        isOpen,
                                                                        onClose,
                                                                        onJoinSuccess
                                                                    }) => {
    const [password, setPassword] = useState('');
    const [showPasswordInput, setShowPasswordInput] = useState(false);
    const { user } = useAuth();
    const { joinLobby, isJoining } = useLobbies();
    const isPlayerInLobby = [
        ...(lobby.teamAPlayers || []),
        ...(lobby.teamBPlayers || []),
        ...(lobby.unassignedPlayers || [])
    ].some(player => player?.id === user?.id);

    const totalPlayers = (lobby.teamAPlayers?.length || 0) +
        (lobby.teamBPlayers?.length || 0) +
        (lobby.unassignedPlayers?.length || 0);

    const handleJoinClick = () => {
        if (lobby.privateLobby && !showPasswordInput) {
            setShowPasswordInput(true);
            return;
        }
        handleJoinLobby();
    };

    const handleJoinLobby = async () => {
        if (!user?.id || !lobby.id) return;

        try {
            await joinLobby(lobby.id, {
                lobbyId: lobby.id,
                userId: user.id,
                password: lobby.privateLobby ? password : null
            });
            onJoinSuccess?.();
            onClose();
        } catch (error) {
            console.error('Failed to join lobby:', error);
            // Reset password on error
            if (lobby.privateLobby) {
                setPassword('');
                setShowPasswordInput(true);
            }
        }
    };

    const handleEnterLobby = () => {
        window.location.href = `/lobby/${lobby.id}`;
    };

    const renderTeamSection = (title: string, players: any[] | null, teamColor: string) => {
        if (!players || players.length === 0) return null;

        return (
            <div className="mb-4">
                <h4 className={`text-sm font-semibold mb-2 ${teamColor}`}>
                    {title} ({players.length})
                </h4>
                <div className="space-y-1">
                    {players.map((player, index) => (
                        <div key={player.id || index} className="flex items-center gap-2 text-sm">
                            <div className={`w-2 h-2 rounded ${teamColor.replace('text-', 'bg-')}`} />
                            <span className="text-white">{player.username}</span>
                            {player.id === lobby.hostUser?.id && (
                                <span className="text-xs bg-amber-600 px-1 rounded text-emerald-900 font-bold">HOST</span>
                            )}
                            {player.id === user?.id && (
                                <span className="text-xs bg-emerald-600 px-1 rounded text-white">YOU</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={lobby.name || 'Game Details'}
            size="medium"
        >
            <div className="space-y-6">
                {/* Game Info */}
                <div className="bg-emerald-800 rounded-lg p-4 border border-emerald-700">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-emerald-300">Host:</span>
                            <span className="text-white ml-2 font-medium">
                                {lobby.hostUser?.username || 'Unknown'}
                            </span>
                        </div>
                        <div>
                            <span className="text-emerald-300">Game Mode:</span>
                            <span className="text-white ml-2 capitalize">
                                {lobby.gameMode || 'Casual'}
                            </span>
                        </div>
                        <div>
                            <span className="text-emerald-300">Players:</span>
                            <span className={`ml-2 font-medium ${
                                totalPlayers >= 4 ? 'text-red-400' : 'text-amber-400'
                            }`}>
                                {totalPlayers}/4
                            </span>
                        </div>
                        <div>
                            <span className="text-emerald-300">Status:</span>
                            <span className={`ml-2 font-medium ${
                                lobby.status === 'WAITING' ? 'text-amber-400' : 'text-red-400'
                            }`}>
                                {lobby.status === 'WAITING' ? 'Open' : lobby.status || 'Unknown'}
                            </span>
                        </div>
                        {lobby.privateLobby && (
                            <div className="col-span-2">
                                <span className="text-emerald-300">Privacy:</span>
                                <span className="text-amber-400 ml-2">🔒 Private Game</span>
                            </div>
                        )}
                        {lobby.createdAt && (
                            <div className="col-span-2">
                                <span className="text-emerald-300">Created:</span>
                                <span className="text-white ml-2">
                                    {new Date(lobby.createdAt).toLocaleString()}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Players */}
                <div className="bg-emerald-800 rounded-lg p-4 border border-emerald-700">
                    <h3 className="text-white font-semibold mb-4">Players</h3>

                    {totalPlayers === 0 ? (
                        <div className="text-center py-6 text-emerald-400">
                            <div className="text-3xl mb-2">🃏</div>
                            <p>No players in this game yet</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {renderTeamSection('Team A', lobby.teamAPlayers, 'text-blue-400')}
                            {renderTeamSection('Team B', lobby.teamBPlayers, 'text-red-400')}
                            {renderTeamSection('Unassigned', lobby.unassignedPlayers, 'text-emerald-400')}
                        </div>
                    )}
                </div>

                {/* Password Input (if needed) */}
                {showPasswordInput && lobby.privateLobby && (
                    <div className="bg-emerald-800 rounded-lg p-4 border border-emerald-700">
                        <h3 className="text-white font-semibold mb-3">🔒 Enter Password</h3>
                        <Input
                            type="password"
                            placeholder="Game password..."
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleJoinLobby()}
                            className="mb-3 bg-emerald-900 border-emerald-600 focus:border-amber-500 focus:ring-amber-500"
                            autoFocus
                        />
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <Button
                        onClick={onClose}
                        variant="outline"
                        className="flex-1 border-emerald-600 text-emerald-300 hover:bg-emerald-600"
                    >
                        Close
                    </Button>

                    {isPlayerInLobby ? (
                        <Button
                            onClick={handleEnterLobby}
                            variant="primary"
                            className="flex-1 bg-amber-600 hover:bg-amber-500 text-emerald-900 font-bold"
                        >
                            Enter Game
                        </Button>
                    ) : lobby.status === 'WAITING' && totalPlayers < 4 ? (
                        <Button
                            onClick={handleJoinClick}
                            variant="primary"
                            className="flex-1 bg-amber-600 hover:bg-amber-500 text-emerald-900 font-bold"
                            disabled={isJoining}
                        >
                            {isJoining ? 'Joining...' :
                                lobby.privateLobby && !showPasswordInput ? 'Join Private Game' : 'Join Game'}
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            className="flex-1 border-red-600 text-red-400"
                            disabled
                        >
                            {lobby.status === 'CLOSED' ? 'Game Closed' : 'Game Full'}
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
};