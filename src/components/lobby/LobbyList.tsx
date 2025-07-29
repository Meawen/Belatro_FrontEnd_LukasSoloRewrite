import React, { useState, useCallback, useMemo } from 'react';
import { LobbyDetailsPopup } from './LobbyDetailsPopup.tsx';
import { CreateLobbyForm } from './CreateLobbyForm';
import { Loading, Button, Modal, Input } from '../common';
import { useAuth } from '../../hooks/useAuth';
import { useLobbies } from '../../hooks/useLobby';
import type { LobbyDTO } from '../../types/lobby';

export interface LobbyListProps {
    showOnlyOpen?: boolean;
}

export const LobbyList: React.FC<LobbyListProps> = ({
                                                        showOnlyOpen = true
                                                    }) => {
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [selectedLobby, setSelectedLobby] = useState<LobbyDTO | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'players' | 'created'>('created');

    const { user } = useAuth();

    const {
        lobbies,
        openLobbies,
        isLoading,
        error,
        refetch,
        isCreating
    } = useLobbies();

    // Get base lobby data - show cached data immediately
    const baseLobbies: LobbyDTO[] = useMemo(() => {
        const data = showOnlyOpen ? openLobbies : lobbies;
        return Array.isArray(data) ? data : [];
    }, [showOnlyOpen, openLobbies, lobbies]);

    // Filter and sort lobbies
    const filteredLobbies = useMemo(() => {
        let filtered = [...baseLobbies];

        // Search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(lobby =>
                lobby.name?.toLowerCase().includes(term) ||
                lobby.hostUser?.username?.toLowerCase().includes(term)
            );
        }

        // Sort
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return (a.name || '').localeCompare(b.name || '');
                case 'players':
                    const aPlayers = (a.teamAPlayers?.length || 0) + (b.teamBPlayers?.length || 0) + (a.unassignedPlayers?.length || 0);
                    const bPlayers = (b.teamAPlayers?.length || 0) + (b.teamBPlayers?.length || 0) + (b.unassignedPlayers?.length || 0);
                    return bPlayers - aPlayers;
                case 'created':
                default:
                    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
            }
        });

        return filtered;
    }, [baseLobbies, searchTerm, sortBy]);

    const handleLobbyClick = useCallback((lobby: LobbyDTO) => {
        setSelectedLobby(lobby);
    }, []);

    const handleLobbyCreated = useCallback(async () => {
        setShowCreateForm(false);
        refetch();
    }, [refetch]);

    const handleJoinSuccess = useCallback(() => {
        refetch();
    }, [refetch]);

    const handleRefresh = useCallback(() => {
        refetch();
    }, [refetch]);

    // Don't show initial loading if we have cached data
    const showInitialLoading = isLoading && baseLobbies.length === 0;

    if (showInitialLoading) {
        return (
            <div className="min-h-[300px] flex items-center justify-center">
                <Loading size="large" text="Loading games..." />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-900 to-green-800 border border-emerald-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-sm flex items-center justify-center text-emerald-900 font-bold text-sm">
                            🃏
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Belot Lobby</h2>
                            <p className="text-sm text-emerald-200">
                                {filteredLobbies.length} games found
                                {isLoading && <span className="text-amber-400 ml-2">● Updating...</span>}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            onClick={handleRefresh}
                            variant="outline"
                            size="small"
                            disabled={isLoading}
                            className="bg-emerald-800 border-emerald-600 hover:bg-emerald-700 text-emerald-100"
                        >
                            {isLoading ? '⟳' : '🔄'} Refresh
                        </Button>
                        <Button
                            onClick={() => setShowCreateForm(true)}
                            variant="primary"
                            size="small"
                            disabled={isCreating}
                            className="bg-amber-600 hover:bg-amber-500 border-amber-500 text-emerald-900 font-bold"
                        >
                            Create Game
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-semibold text-emerald-200 mb-1">SEARCH</label>
                        <Input
                            type="text"
                            placeholder="Game or host name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-emerald-950 border-emerald-700 text-white placeholder-emerald-400 h-8 text-sm focus:border-amber-500 focus:ring-amber-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-emerald-200 mb-1">SORT BY</label>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="w-full h-8 bg-emerald-950 border border-emerald-700 rounded text-white text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                        >
                            <option value="created">Newest First</option>
                            <option value="name">Name</option>
                            <option value="players">Most Players</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-red-400 text-sm">
                        <span>⚠️</span>
                        <span>Connection error - showing cached data</span>
                    </div>
                </div>
            )}

            {/* Games List */}
            <div className="bg-emerald-900 border border-emerald-700 rounded-lg overflow-hidden">
                <div className="bg-emerald-800 border-b border-emerald-700 px-4 py-2">
                    <div className="grid grid-cols-11 gap-4 text-xs font-semibold text-emerald-200 uppercase">
                        <div className="col-span-5">Game Name</div>
                        <div className="col-span-2">Host</div>
                        <div className="col-span-2">Players</div>
                        <div className="col-span-2">Status</div>
                    </div>
                </div>

                <div className="max-h-[500px] overflow-y-auto">
                    {filteredLobbies.length === 0 ? (
                        <div className="p-8 text-center">
                            <div className="text-4xl text-amber-500 mb-3">🃏</div>
                            <h3 className="text-lg font-semibold text-white mb-2">No Games Found</h3>
                            <p className="text-emerald-300 mb-4">
                                {searchTerm
                                    ? 'No games match your search. Try a different term or create a new game.'
                                    : 'No games are currently available. Be the first to create one!'
                                }
                            </p>
                            <Button
                                onClick={() => setShowCreateForm(true)}
                                variant="primary"
                                size="small"
                                className="bg-amber-600 hover:bg-amber-500 text-emerald-900 font-bold"
                            >
                                Create New Game
                            </Button>
                        </div>
                    ) : (
                        filteredLobbies.map((lobby, index) => (
                            <LobbyRow
                                key={lobby.id || index}
                                lobby={lobby}
                                currentUser={user}
                                onRowClick={() => handleLobbyClick(lobby)}
                                isEven={index % 2 === 0}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Modals */}
            <Modal
                isOpen={showCreateForm}
                onClose={() => setShowCreateForm(false)}
                title="Create New Game"
            >
                <CreateLobbyForm
                    onSuccess={handleLobbyCreated}
                    onCancel={() => setShowCreateForm(false)}
                />
            </Modal>

            {selectedLobby && (
                <LobbyDetailsPopup
                    lobby={selectedLobby}
                    isOpen={!!selectedLobby}
                    onClose={() => setSelectedLobby(null)}
                    onJoinSuccess={handleJoinSuccess}
                />
            )}
        </div>
    );
};

// Lobby row component
interface LobbyRowProps {
    lobby: LobbyDTO;
    currentUser: any;
    onRowClick: () => void;
    isEven: boolean;
}

const LobbyRow: React.FC<LobbyRowProps> = ({ lobby, currentUser, onRowClick, isEven }) => {
    const isHost = currentUser?.id === lobby.hostUser?.id;
    const isPlayerInLobby = [
        ...(lobby.teamAPlayers || []),
        ...(lobby.teamBPlayers || []),
        ...(lobby.unassignedPlayers || [])
    ].some(player => player?.id === currentUser?.id);

    const totalPlayers = (lobby.teamAPlayers?.length || 0) +
        (lobby.teamBPlayers?.length || 0) +
        (lobby.unassignedPlayers?.length || 0);

    const getStatusColor = () => {
        switch (lobby.status) {
            case 'WAITING': return 'text-amber-400';
            case 'CLOSED': return 'text-red-400';
            default: return 'text-emerald-300';
        }
    };

    return (
        <div
            className={`px-4 py-3 border-b border-emerald-800/50 hover:bg-emerald-800/50 cursor-pointer transition-colors ${
                isEven ? 'bg-emerald-900/30' : 'bg-emerald-900/60'
            }`}
            onClick={onRowClick}
        >
            <div className="grid grid-cols-11 gap-4 items-center text-sm">
                {/* Game Name */}
                <div className="col-span-5 flex items-center gap-2">
                    <span className="text-white font-medium truncate">
                        {lobby.name || 'Unnamed Game'}
                    </span>
                    {lobby.privateLobby && <span className="text-amber-400 text-xs">🔒</span>}
                    {isHost && <span className="text-xs bg-amber-600 px-1 rounded text-emerald-900 font-bold">HOST</span>}
                    {isPlayerInLobby && <span className="text-xs bg-emerald-600 px-1 rounded text-white">JOINED</span>}
                </div>

                {/* Host */}
                <div className="col-span-2 text-emerald-200 truncate">
                    {lobby.hostUser?.username || 'Unknown'}
                </div>

                {/* Players */}
                <div className="col-span-2 text-emerald-200">
                    <span className={totalPlayers >= 4 ? 'text-red-400' : 'text-white'}>
                        {totalPlayers}/4
                    </span>
                </div>

                {/* Status */}
                <div className="col-span-2">
                    <span className={`text-xs font-semibold ${getStatusColor()}`}>
                        {lobby.status === 'WAITING' ? 'OPEN' : lobby.status || 'UNKNOWN'}
                    </span>
                </div>
            </div>
        </div>
    );
};