import { useCallback } from 'react';
import { lobbyService } from '../services';
import { useApi, useMutation } from './useApi';
import type {
    LobbyDTO,
    JoinLobbyRequestDTO,
    LeaveLobbyRequestDTO,
    KickPlayerRequestDTO,
    TeamSwitchRequestDTO,
} from '../types';

export function useLobby(lobbyId?: string) {
    const lobbyQuery = useApi(
        () => lobbyService.getLobby(lobbyId!),
        { immediate: !!lobbyId }
    );

    const updateMutation = useMutation(lobbyService.updateLobby);
    const deleteMutation = useMutation(lobbyService.deleteLobby);
    const startMatchMutation = useMutation(lobbyService.startMatch);

    const updateLobby = useCallback(async (lobbyData: LobbyDTO) => {
        const result = await updateMutation.mutate(lobbyData);
        await lobbyQuery.refetch();
        return result;
    }, [updateMutation, lobbyQuery]);

    const deleteLobby = useCallback(async () => {
        if (!lobbyId) throw new Error('Lobby ID is required');
        return await deleteMutation.mutate(lobbyId);
    }, [lobbyId, deleteMutation]);

    const startMatch = useCallback(async () => {
        if (!lobbyId) throw new Error('Lobby ID is required');
        return await startMatchMutation.mutate(lobbyId);
    }, [lobbyId, startMatchMutation]);

    return {
        lobby: lobbyQuery.data,
        isLoading: lobbyQuery.isLoading,
        error: lobbyQuery.error,
        updateLobby,
        deleteLobby,
        startMatch,
        refetch: lobbyQuery.refetch,
        isUpdating: updateMutation.isLoading,
        isDeleting: deleteMutation.isLoading,
        isStartingMatch: startMatchMutation.isLoading,
    };
}

export function useLobbies() {
    const lobbiesQuery = useApi(() => lobbyService.getAllLobbies());
    const openLobbiesQuery = useApi(() => lobbyService.getAllOpenLobbies());

    const createMutation = useMutation(lobbyService.createLobby);
    const joinMutation = useMutation(lobbyService.joinLobby);
    const leaveMutation = useMutation((data: { lobbyId: string; leaveData: LeaveLobbyRequestDTO }) =>
        lobbyService.leaveLobby(data.lobbyId, data.leaveData)
    );
    const kickMutation = useMutation((data: { lobbyId: string; kickData: KickPlayerRequestDTO }) =>
        lobbyService.kickPlayer(data.lobbyId, data.kickData)
    );
    const switchTeamMutation = useMutation(lobbyService.switchTeam);

    const createLobby = useCallback(async (lobbyData: LobbyDTO) => {
        const result = await createMutation.mutate(lobbyData);
        await lobbiesQuery.refetch();
        await openLobbiesQuery.refetch();
        return result;
    }, [createMutation, lobbiesQuery, openLobbiesQuery]);

    const joinLobby = useCallback(async (joinData: JoinLobbyRequestDTO) => {
        const result = await joinMutation.mutate(joinData);
        await lobbiesQuery.refetch();
        await openLobbiesQuery.refetch();
        return result;
    }, [joinMutation, lobbiesQuery, openLobbiesQuery]);

    const leaveLobby = useCallback(async (lobbyId: string, leaveData: LeaveLobbyRequestDTO) => {
        const result = await leaveMutation.mutate({ lobbyId, leaveData });
        await lobbiesQuery.refetch();
        await openLobbiesQuery.refetch();
        return result;
    }, [leaveMutation, lobbiesQuery, openLobbiesQuery]);

    const kickPlayer = useCallback(async (lobbyId: string, kickData: KickPlayerRequestDTO) => {
        const result = await kickMutation.mutate({ lobbyId, kickData });
        await lobbiesQuery.refetch();
        await openLobbiesQuery.refetch();
        return result;
    }, [kickMutation, lobbiesQuery, openLobbiesQuery]);

    const switchTeam = useCallback(async (switchData: TeamSwitchRequestDTO) => {
        const result = await switchTeamMutation.mutate(switchData);
        await lobbiesQuery.refetch();
        await openLobbiesQuery.refetch();
        return result;
    }, [switchTeamMutation, lobbiesQuery, openLobbiesQuery]);

    return {
        lobbies: lobbiesQuery.data,
        openLobbies: openLobbiesQuery.data,
        isLoading: lobbiesQuery.isLoading || openLobbiesQuery.isLoading,
        error: lobbiesQuery.error || openLobbiesQuery.error,
        createLobby,
        joinLobby,
        leaveLobby,
        kickPlayer,
        switchTeam,
        refetch: () => {
            lobbiesQuery.refetch();
            openLobbiesQuery.refetch();
        },
        isCreating: createMutation.isLoading,
        isJoining: joinMutation.isLoading,
        isLeaving: leaveMutation.isLoading,
        isKicking: kickMutation.isLoading,
        isSwitchingTeam: switchTeamMutation.isLoading,
    };
}