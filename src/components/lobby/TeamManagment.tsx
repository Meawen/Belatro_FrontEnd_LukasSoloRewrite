import React from 'react';
import { Button } from '../common';
import { useLobbies } from '../../hooks/useLobby';
import type { LobbyDTO } from '../../types/lobby';
import type { UserSimpleDTO } from '../../types/user';

export interface TeamManagementProps {
    lobby: LobbyDTO;
    currentUser: UserSimpleDTO | null;
    onUpdate: () => void;
}

export const TeamManagement: React.FC<TeamManagementProps> = ({
                                                                  lobby,
                                                                  currentUser,
                                                                  onUpdate
                                                              }) => {
    const { switchTeam, isSwitchingTeam } = useLobbies();

    const handleSwitchTeam = async (targetTeam: string) => {
        if (!currentUser?.id || !lobby.id) return;

        try {
            await switchTeam({
                lobbyId: lobby.id,
                userId: currentUser.id,
                targetTeam
            });
            onUpdate();
        } catch (error) {
            console.error('Failed to switch team:', error);
        }
    };

    const isPlayerInTeamA = lobby.teamAPlayers?.some(p => p.id === currentUser?.id);
    const isPlayerInTeamB = lobby.teamBPlayers?.some(p => p.id === currentUser?.id);
    const isPlayerUnassigned = lobby.unassignedPlayers?.some(p => p.id === currentUser?.id);
    const isPlayerInLobby = isPlayerInTeamA || isPlayerInTeamB || isPlayerUnassigned;

    if (!isPlayerInLobby) {
        return null; // User is not in this lobby
    }

    return (
        <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">Team Management</h3>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Team A */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-blue-400 font-semibold">Team A</h4>
                        <span className="text-slate-400 text-sm">
              {lobby.teamAPlayers?.length || 0}/2
            </span>
                    </div>

                    <div className="space-y-2 min-h-[120px] p-3 bg-blue-900/10 border border-blue-500/20 rounded">
                        {lobby.teamAPlayers?.map(player => (
                            <div
                                key={player.id}
                                className={`p-2 bg-blue-900/30 border border-blue-500/30 rounded flex items-center justify-between ${
                                    player.id === currentUser?.id ? 'ring-2 ring-blue-400' : ''
                                }`}
                            >
                                <span className="text-white font-medium">{player.username}</span>
                                {player.id === currentUser?.id && (
                                    <span className="badge badge-blue text-xs">You</span>
                                )}
                            </div>
                        ))}

                        {(!lobby.teamAPlayers || lobby.teamAPlayers.length === 0) && (
                            <div className="text-slate-500 text-center py-8">
                                No players in Team A
                            </div>
                        )}
                    </div>

                    {!isPlayerInTeamA && (lobby.teamAPlayers?.length || 0) < 2 && (
                        <Button
                            onClick={() => handleSwitchTeam('A')}
                            variant="outline"
                            size="small"
                            disabled={isSwitchingTeam}
                            className="w-full border-blue-500/50 hover:bg-blue-900/20"
                        >
                            {isSwitchingTeam ? 'Switching...' : 'Join Team A'}
                        </Button>
                    )}
                </div>

                {/* Team B */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-red-400 font-semibold">Team B</h4>
                        <span className="text-slate-400 text-sm">
              {lobby.teamBPlayers?.length || 0}/2
            </span>
                    </div>

                    <div className="space-y-2 min-h-[120px] p-3 bg-red-900/10 border border-red-500/20 rounded">
                        {lobby.teamBPlayers?.map(player => (
                            <div
                                key={player.id}
                                className={`p-2 bg-red-900/30 border border-red-500/30 rounded flex items-center justify-between ${
                                    player.id === currentUser?.id ? 'ring-2 ring-red-400' : ''
                                }`}
                            >
                                <span className="text-white font-medium">{player.username}</span>
                                {player.id === currentUser?.id && (
                                    <span className="badge badge-red text-xs">You</span>
                                )}
                            </div>
                        ))}

                        {(!lobby.teamBPlayers || lobby.teamBPlayers.length === 0) && (
                            <div className="text-slate-500 text-center py-8">
                                No players in Team B
                            </div>
                        )}
                    </div>

                    {!isPlayerInTeamB && (lobby.teamBPlayers?.length || 0) < 2 && (
                        <Button
                            onClick={() => handleSwitchTeam('B')}
                            variant="outline"
                            size="small"
                            disabled={isSwitchingTeam}
                            className="w-full border-red-500/50 hover:bg-red-900/20"
                        >
                            {isSwitchingTeam ? 'Switching...' : 'Join Team B'}
                        </Button>
                    )}
                </div>

                {/* Unassigned */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-slate-400 font-semibold">Unassigned</h4>
                        <span className="text-slate-400 text-sm">
              {lobby.unassignedPlayers?.length || 0}
            </span>
                    </div>

                    <div className="space-y-2 min-h-[120px] p-3 bg-slate-900/20 border border-slate-500/20 rounded">
                        {lobby.unassignedPlayers?.map(player => (
                            <div
                                key={player.id}
                                className={`p-2 bg-slate-800/50 border border-slate-500/30 rounded flex items-center justify-between ${
                                    player.id === currentUser?.id ? 'ring-2 ring-slate-400' : ''
                                }`}
                            >
                                <span className="text-white font-medium">{player.username}</span>
                                {player.id === currentUser?.id && (
                                    <span className="badge badge-gray text-xs">You</span>
                                )}
                            </div>
                        ))}

                        {(!lobby.unassignedPlayers || lobby.unassignedPlayers.length === 0) && (
                            <div className="text-slate-500 text-center py-8">
                                No unassigned players
                            </div>
                        )}
                    </div>

                    {!isPlayerUnassigned && (
                        <Button
                            onClick={() => handleSwitchTeam('UNASSIGNED')}
                            variant="outline"
                            size="small"
                            disabled={isSwitchingTeam}
                            className="w-full border-slate-500/50 hover:bg-slate-800/20"
                        >
                            {isSwitchingTeam ? 'Switching...' : 'Leave Team'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};