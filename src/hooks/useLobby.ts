import { useCallback, useMemo } from 'react';
import { lobbyService } from '../services';
import { useApi, useMutation } from './useApi';
import type {
    LobbyUpdateDTO,
    CreateLobbyDTO,
    JoinLobbyRequestDTO,
    LeaveLobbyRequestDTO,
    KickPlayerRequestDTO,
    TeamSwitchRequestDTO,
} from '../types';

export function useLobby(lobbyId?: string) {
    const apiFunction = useMemo(() => {
        if (!lobbyId) {
            return () => Promise.reject(new Error('No lobby ID provided'));
        }
        return () => lobbyService.getLobby(lobbyId);
    }, [lobbyId]);

    const lobbyQuery = useApi(
        apiFunction,
        {
            immediate: !!lobbyId,
            dependencies: [lobbyId]
        }
    );

    const updateMutation = useMutation((data: { lobbyId: string; updateData: LobbyUpdateDTO }) =>
        lobbyService.updateLobby(data.lobbyId, data.updateData)
    );
    const deleteMutation = useMutation((lobbyId: string) =>
        lobbyService.deleteLobby(lobbyId)
    );
    const startMatchMutation = useMutation((lobbyId: string) =>
        lobbyService.startMatch(lobbyId)
    );

    const updateLobby = useCallback(async (updateData: LobbyUpdateDTO) => {
        if (!lobbyId) throw new Error('Lobby ID is required');
        const result = await updateMutation.mutate({ lobbyId, updateData });
        await lobbyQuery.refetch();
        return result;
    }, [lobbyId, updateMutation, lobbyQuery]);

    const deleteLobby = useCallback(async () => {
        if (!lobbyId) throw new Error('Lobby ID is required');
        return await deleteMutation.mutate(lobbyId);
    }, [lobbyId, deleteMutation]);

    const startMatch = useCallback(async () => {
        if (!lobbyId) throw new Error('Lobby ID is required');
        const result = await startMatchMutation.mutate(lobbyId);
        await lobbyQuery.refetch();
        return result;
    }, [lobbyId, startMatchMutation, lobbyQuery]);

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
    // Memoize the API functions to prevent infinite loops
    const getAllLobbiesFunction = useMemo(() => () => lobbyService.getAllLobbies(), []);
    const getAllOpenLobbiesFunction = useMemo(() => () => lobbyService.getAllOpenLobbies(), []);

    const lobbiesQuery = useApi(getAllLobbiesFunction, {
        immediate: true,
        dependencies: [] // Empty array since function is memoized
    });

    const openLobbiesQuery = useApi(getAllOpenLobbiesFunction, {
        immediate: true,
        dependencies: [] // Empty array since function is memoized
    });

    const createMutation = useMutation((lobbyData: CreateLobbyDTO) =>
        lobbyService.createLobby(lobbyData)
    );
    const joinMutation = useMutation((data: { lobbyId: string; joinData: JoinLobbyRequestDTO }) =>
        lobbyService.joinLobby(data.lobbyId, data.joinData)
    );
    const leaveMutation = useMutation((data: { lobbyId: string; leaveData?: LeaveLobbyRequestDTO }) =>
        lobbyService.leaveLobby(data.lobbyId, data.leaveData)
    );
    const kickMutation = useMutation((data: { lobbyId: string; kickData: KickPlayerRequestDTO }) =>
        lobbyService.kickPlayer(data.lobbyId, data.kickData)
    );
    const switchTeamMutation = useMutation((data: { lobbyId: string; switchData: TeamSwitchRequestDTO }) =>
        lobbyService.switchTeam(data.lobbyId, data.switchData)
    );

    const createLobby = useCallback(async (lobbyData: CreateLobbyDTO) => {
        const result = await createMutation.mutate(lobbyData);
        await lobbiesQuery.refetch();
        await openLobbiesQuery.refetch();
        return result;
    }, [createMutation, lobbiesQuery, openLobbiesQuery]);

    const joinLobby = useCallback(async (lobbyId: string, joinData: JoinLobbyRequestDTO) => {
        const result = await joinMutation.mutate({ lobbyId, joinData });
        await lobbiesQuery.refetch();
        await openLobbiesQuery.refetch();
        return result;
    }, [joinMutation, lobbiesQuery, openLobbiesQuery]);

    const leaveLobby = useCallback(async (lobbyId: string, leaveData?: LeaveLobbyRequestDTO) => {
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

    const switchTeam = useCallback(async (lobbyId: string, switchData: TeamSwitchRequestDTO) => {
        const result = await switchTeamMutation.mutate({ lobbyId, switchData });
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