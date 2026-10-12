import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal, Select, ErrorAlert } from '../common';
import { useLobbies, useLobby } from '../../hooks/useLobby';
import type { LobbyDTO, KickPlayerRequestDTO } from '../../types/lobby';
import type { UserSimpleDTO } from '../../types/user';
import { errorMessage } from '../../utils/errorMessage';

export interface LobbyControlsProps {
    lobby: LobbyDTO;
    currentUser: UserSimpleDTO | null;
    onUpdate: () => void;
}

export const LobbyControls: React.FC<LobbyControlsProps> = ({
                                                                lobby,
                                                                currentUser,
                                                                onUpdate
                                                            }) => {
    const [showKickModal, setShowKickModal] = useState(false);
    const [playerToKick, setPlayerToKick] = useState('');
    const [actionError, setActionError] = useState<string | null>(null);

    const {
        leaveLobby,
        kickPlayer,
        isLeaving,
        isKicking
    } = useLobbies();

    const {
        deleteLobby,
        isDeleting
    } = useLobby(lobby.id || undefined);
    const navigate = useNavigate();

    const isHost = currentUser?.id === lobby.hostUser?.id;
    const isPlayerInLobby = [
        ...(lobby.teamAPlayers || []),
        ...(lobby.teamBPlayers || []),
        ...(lobby.unassignedPlayers || [])
    ].some(player => player.id === currentUser?.id);

    const allPlayers = [
        ...(lobby.teamAPlayers || []),
        ...(lobby.teamBPlayers || []),
        ...(lobby.unassignedPlayers || [])
    ].filter(player => player.id !== currentUser?.id); // Can't kick yourself

    const handleLeaveLobby = async () => {
        if (!currentUser?.username || !lobby.id) return;

        const confirmed = window.confirm('Are you sure you want to leave this lobby?');
        if (!confirmed) return;

        try {
            setActionError(null);
            await leaveLobby(lobby.id);

            // Navigate back to lobby list
            navigate('/lobbies');
        } catch (error) {
            console.error('Failed to leave lobby:', error);
            setActionError(errorMessage(error, 'Failed to leave lobby'));
        }
    };

    const handleKickPlayer = async () => {
        if (!playerToKick || !currentUser?.username || !lobby.id) return;

        const playerName = allPlayers.find(p => p.id === playerToKick)?.username;
        const confirmed = window.confirm(`Are you sure you want to kick ${playerName}?`);
        if (!confirmed) return;

        try {
            setActionError(null);
            const kickData: KickPlayerRequestDTO = {
                usernameToKick: playerName || ''
            };

            await kickPlayer(lobby.id, kickData);
            setShowKickModal(false);
            setPlayerToKick('');
            onUpdate();
        } catch (error) {
            console.error('Failed to kick player:', error);
            setShowKickModal(false);
            setActionError(errorMessage(error, 'Failed to kick player'));
        }
    };

    const handleDeleteLobby = async () => {
        const confirmed = window.confirm(
            'Are you sure you want to delete this lobby? This action cannot be undone.'
        );
        if (!confirmed) return;

        try {
            setActionError(null);
            await deleteLobby();
            // Navigate back to lobby list
            navigate('/lobbies');
        } catch (error) {
            console.error('Failed to delete lobby:', error);
            setActionError(errorMessage(error, 'Failed to delete lobby'));
        }
    };

    if (!isPlayerInLobby) {
        return null; // User is not in this lobby
    }

    return (
        <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">Lobby Controls</h3>

            <ErrorAlert message={actionError} className="mb-4" />

            <div className="flex flex-wrap gap-3">
                {/* Leave Lobby - not for the host, whom the server answers 409 (delete instead) */}
                {!isHost && (
                    <Button
                        onClick={handleLeaveLobby}
                        variant="outline"
                        disabled={isLeaving}
                        className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-900/20"
                    >
                        {isLeaving ? 'Leaving...' : '🚪 Leave Lobby'}
                    </Button>
                )}

                {/* Host-only controls */}
                {isHost && (
                    <>
                        {/* Kick Player */}
                        {allPlayers.length > 0 && (
                            <Button
                                onClick={() => setShowKickModal(true)}
                                variant="outline"
                                disabled={isKicking}
                                className="border-orange-500/50 text-orange-400 hover:bg-orange-900/20"
                            >
                                👢 Kick Player
                            </Button>
                        )}

                        {/* Delete Lobby */}
                        <Button
                            onClick={handleDeleteLobby}
                            variant="outline"
                            disabled={isDeleting}
                            className="border-red-500/50 text-red-400 hover:bg-red-900/20"
                        >
                            {isDeleting ? 'Deleting...' : '🗑️ Delete Lobby'}
                        </Button>
                    </>
                )}
            </div>

            {/* Kick Player Modal */}
            <Modal
                isOpen={showKickModal}
                onClose={() => {
                    setShowKickModal(false);
                    setPlayerToKick('');
                }}
                title="Kick Player"
            >
                <div className="space-y-4">
                    <p className="text-slate-300">
                        Select a player to kick from the lobby:
                    </p>

                    <Select
                        label="Player to Kick"
                        value={playerToKick}
                        onChange={(e) => setPlayerToKick(e.target.value)}
                        options={[
                            { value: '', label: 'Select a player...' },
                            ...allPlayers.map(player => ({
                                value: player.id || '',
                                label: player.username || 'Unknown'
                            }))
                        ]}
                        required
                    />

                    <div className="bg-red-900/20 border border-red-500/30 p-3 rounded">
                        <p className="text-red-300 text-sm">
                            ⚠️ This will immediately remove the selected player from the lobby.
                        </p>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button
                            onClick={() => {
                                setShowKickModal(false);
                                setPlayerToKick('');
                            }}
                            variant="outline"
                            disabled={isKicking}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleKickPlayer}
                            variant="primary"
                            disabled={!playerToKick || isKicking}
                            className="flex-1 bg-red-600 hover:bg-red-700"
                        >
                            {isKicking ? 'Kicking...' : 'Kick Player'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};