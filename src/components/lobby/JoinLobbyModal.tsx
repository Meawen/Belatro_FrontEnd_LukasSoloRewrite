import React, { useState } from 'react';
import { Button, Input } from '../common';
import { useLobbies } from '../../hooks/useLobby';
import { useAuth } from '../../hooks/useAuth';
import type { LobbyDTO, JoinLobbyRequestDTO } from '../../types/lobby';

export interface JoinLobbyModalProps {
    lobby: LobbyDTO;
    onSuccess: () => void;
    onCancel: () => void;
}

export const JoinLobbyModal: React.FC<JoinLobbyModalProps> = ({
                                                                  lobby,
                                                                  onSuccess,
                                                                  onCancel
                                                              }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const { joinLobby, isJoining } = useLobbies();
    const { user } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!user?.id) {
            setError('You must be logged in to join a lobby');
            return;
        }

        const isPrivate = lobby.privateLobby === true;
        if (isPrivate && !password.trim()) {
            setError('Password is required for private lobbies');
            return;
        }

        try {
            const joinData: JoinLobbyRequestDTO = {
                lobbyId: lobby.id,
                userId: user.id,
                password: isPrivate ? password : null
            };

            await joinLobby(joinData);
            onSuccess();
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to join lobby');
        }
    };

    const totalPlayers =
        (lobby.teamAPlayers?.length || 0) +
        (lobby.teamBPlayers?.length || 0) +
        (lobby.unassignedPlayers?.length || 0);

    const isPrivate = lobby.privateLobby === true;

    return (
        <div className="space-y-6">
            {/* Lobby Info */}
            <div className="card bg-slate-800/50">
                <h3 className="text-lg font-semibold text-white mb-3">
                    {lobby.name || 'Unnamed Lobby'}
                </h3>

                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-400">Host:</span>
                        <span className="text-white">{lobby.hostUser?.username}</span>
                    </div>

                    <div className="flex justify-between">
                        <span className="text-slate-400">Game Mode:</span>
                        <span className="text-white capitalize">{lobby.gameMode}</span>
                    </div>

                    <div className="flex justify-between">
                        <span className="text-slate-400">Players:</span>
                        <span className="text-white">{totalPlayers}/4</span>
                    </div>

                    {isPrivate && (
                        <div className="flex justify-between">
                            <span className="text-slate-400">Type:</span>
                            <span className="text-yellow-400">🔒 Private</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Password Input (if needed) */}
            {isPrivate && (
                <form onSubmit={handleSubmit}>
                    <Input
                        label="Lobby Password"
                        type="password"
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            if (error) setError(null);
                        }}
                        placeholder="Enter lobby password..."
                        required
                        autoFocus
                    />
                </form>
            )}

            {/* Error */}
            {error && (
                <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-500/30">
                    {error}
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={isJoining}
                    className="flex-1"
                >
                    Cancel
                </Button>
                <Button
                    type="button"
                    variant="primary"
                    onClick={handleSubmit}
                    disabled={isJoining || (isPrivate && !password.trim())}
                    className="flex-1"
                >
                    {isJoining ? 'Joining...' : 'Join Lobby'}
                </Button>
            </div>
        </div>
    );
};