import React, { useState } from 'react';
import { LobbyCard } from './LobbyCard';
import { CreateLobbyForm } from './CreateLobbyForm';
import { JoinLobbyModal } from './JoinLobbyModal';
import { Loading, Button, Modal } from '../common';
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
    const [showJoinModal, setShowJoinModal] = useState(false);
    const { user } = useAuth();

    const {
        lobbies,
        openLobbies,
        isLoading,
        error,
        refetch,
        isCreating
    } = useLobbies();

    // Ensure we're working with arrays
    const displayedLobbies: LobbyDTO[] = Array.isArray(showOnlyOpen ? openLobbies : lobbies)
        ? (showOnlyOpen ? openLobbies : lobbies) as unknown as LobbyDTO[]
        : [];

    const handleJoinLobby = (lobby: LobbyDTO) => {
        setSelectedLobby(lobby);
        setShowJoinModal(true);
    };

    const handleLobbyCreated = async () => {
        setShowCreateForm(false);
        await refetch();
    };

    const handleLobbyJoined = async () => {
        setShowJoinModal(false);
        setSelectedLobby(null);
        await refetch();
    };

    if (isLoading) {
        return <Loading size="large" text="Loading lobbies..." />;
    }

    if (error) {
        const errorMessage = typeof error === 'string' ? error : 'Failed to load lobbies';

        return (
            <div className="card bg-red-900/20 border-red-500/30">
                <div className="flex items-center gap-3">
                    <div className="text-red-400 text-2xl">⚠️</div>
                    <div>
                        <h3 className="text-red-400 font-semibold">Error Loading Lobbies</h3>
                        <p className="text-red-300 text-sm">{errorMessage}</p>
                    </div>
                </div>
                <Button
                    onClick={refetch}
                    variant="outline"
                    size="small"
                    className="mt-4"
                >
                    Try Again
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">
                        {showOnlyOpen ? 'Open Lobbies' : 'All Lobbies'}
                    </h2>
                    <p className="text-slate-400">
                        {displayedLobbies.length || 0} {displayedLobbies.length === 1 ? 'lobby' : 'lobbies'} found
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button
                        onClick={refetch}
                        variant="outline"
                        size="small"
                    >
                        🔄 Refresh
                    </Button>
                    <Button
                        onClick={() => setShowCreateForm(true)}
                        variant="primary"
                        disabled={isCreating}
                    >
                        ➕ Create Lobby
                    </Button>
                </div>
            </div>

            {/* Lobbies Grid */}
            {displayedLobbies.length === 0 ? (
                <div className="card text-center py-12">
                    <div className="text-slate-500 text-6xl mb-4">🎪</div>
                    <h3 className="text-xl font-semibold text-white mb-2">No Lobbies Found</h3>
                    <p className="text-slate-400 mb-6">
                        {showOnlyOpen
                            ? "There are no open lobbies right now. Why not create one?"
                            : "No lobbies exist yet. Be the first to create one!"
                        }
                    </p>
                    <Button
                        onClick={() => setShowCreateForm(true)}
                        variant="primary"
                    >
                        Create First Lobby
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {displayedLobbies.map((lobby: LobbyDTO) => (
                        <LobbyCard
                            key={lobby.id}
                            lobby={lobby}
                            currentUser={user}
                            onJoin={() => handleJoinLobby(lobby)}
                            onRefresh={refetch}
                        />
                    ))}
                </div>
            )}

            {/* Create Lobby Modal */}
            <Modal
                isOpen={showCreateForm}
                onClose={() => setShowCreateForm(false)}
                title="Create New Lobby"
            >
                <CreateLobbyForm
                    onSuccess={handleLobbyCreated}
                    onCancel={() => setShowCreateForm(false)}
                />
            </Modal>

            {/* Join Lobby Modal */}
            <Modal
                isOpen={showJoinModal}
                onClose={() => {
                    setShowJoinModal(false);
                    setSelectedLobby(null);
                }}
                title="Join Lobby"
            >
                {selectedLobby && (
                    <JoinLobbyModal
                        lobby={selectedLobby}
                        onSuccess={handleLobbyJoined}
                        onCancel={() => {
                            setShowJoinModal(false);
                            setSelectedLobby(null);
                        }}
                    />
                )}
            </Modal>
        </div>
    );
};