import { useCallback, useEffect, useMemo, useState } from 'react';
import { lobbyService } from '../services';
import { useApi, useMutation } from './useApi';
import { usePolling } from './usePolling';
import type {
    LobbyDTO,
    LobbyUpdateDTO,
    CreateLobbyDTO,
    JoinLobbyRequestDTO,
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

/** /lobbies refreshes the open list this often while the tab is visible (D-16). */
export const LOBBY_LIST_POLL_MS = 5000;

export interface OpenLobbies {
    /** The last good list; null until the first answer. */
    lobbies: LobbyDTO[] | null;
    /** The first load (or Try again after it failed) is running. */
    loading: boolean;
    /** The first load failed: there is no list to show. */
    failed: boolean;
    /** The last poll failed; `lobbies` is the last good list. */
    pollFailed: boolean;
    /** Fetch now (Refresh, Try again). */
    refresh: () => Promise<void>;
}

/**
 * The open lobbies for /lobbies (spec §4.6): one GET /lobbies/open at mount and one per poll, every 5 s
 * while the tab is visible. A failed poll keeps the last good list on screen and only says so.
 */
export function useOpenLobbies(): OpenLobbies {
    const [state, setState] = useState<Omit<OpenLobbies, 'refresh'>>({ lobbies: null, loading: true, failed: false, pollFailed: false });

    const load = useCallback(async () => {
        setState((prev) => (prev.lobbies ? prev : { ...prev, loading: true, failed: false }));
        try {
            const lobbies = await lobbyService.getAllOpenLobbies();
            setState({ lobbies: Array.isArray(lobbies) ? lobbies : [], loading: false, failed: false, pollFailed: false });
        } catch {
            // a 401 has already ended the session (services/api.ts); anything else keeps what is on screen
            setState((prev) => (prev.lobbies ? { ...prev, pollFailed: true } : { ...prev, loading: false, failed: true }));
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);
    usePolling(load, LOBBY_LIST_POLL_MS, state.lobbies !== null);

    return { ...state, refresh: load };
}

export function useLobbies() {
    // Clean memoization like useUser does
    const getAllOpenLobbiesFunction = useMemo(() => () => lobbyService.getAllOpenLobbies(), []);

    const openLobbiesQuery = useApi(getAllOpenLobbiesFunction, {
        immediate: true,
        dependencies: [],
        staleTime: 10000
    });

    // Only fetch all lobbies if explicitly needed
    const getAllLobbiesFunction = useMemo(() => () => lobbyService.getAllLobbies(), []);
    const lobbiesQuery = useApi(getAllLobbiesFunction, {
        immediate: false,
        dependencies: []
    });

    // Rest of your mutations remain the same...
    const createMutation = useMutation((lobbyData: CreateLobbyDTO) =>
        lobbyService.createLobby(lobbyData)
    );
    const joinMutation = useMutation((data: { lobbyId: string; joinData: JoinLobbyRequestDTO }) =>
        lobbyService.joinLobby(data.lobbyId, data.joinData)
    );
    const leaveMutation = useMutation((lobbyId: string) =>
        lobbyService.leaveLobby(lobbyId)
    );
    const kickMutation = useMutation((data: { lobbyId: string; kickData: KickPlayerRequestDTO }) =>
        lobbyService.kickPlayer(data.lobbyId, data.kickData)
    );
    const switchTeamMutation = useMutation((data: { lobbyId: string; switchData: TeamSwitchRequestDTO }) =>
        lobbyService.switchTeam(data.lobbyId, data.switchData)
    );

    const createLobby = useCallback(async (lobbyData: CreateLobbyDTO) => {
        const result = await createMutation.mutate(lobbyData);
        await openLobbiesQuery.refetch();
        if (lobbiesQuery.data) {
            await lobbiesQuery.refetch();
        }
        return result;
    }, [createMutation, openLobbiesQuery, lobbiesQuery]);

    const joinLobby = useCallback(async (lobbyId: string, joinData: JoinLobbyRequestDTO) => {
        const result = await joinMutation.mutate({ lobbyId, joinData });
        await openLobbiesQuery.refetch();
        if (lobbiesQuery.data) {
            await lobbiesQuery.refetch();
        }
        return result;
    }, [joinMutation, openLobbiesQuery, lobbiesQuery]);

    const leaveLobby = useCallback(async (lobbyId: string) => {
        const result = await leaveMutation.mutate(lobbyId);
        await openLobbiesQuery.refetch();
        if (lobbiesQuery.data) {
            await lobbiesQuery.refetch();
        }
        return result;
    }, [leaveMutation, openLobbiesQuery, lobbiesQuery]);

    const kickPlayer = useCallback(async (lobbyId: string, kickData: KickPlayerRequestDTO) => {
        const result = await kickMutation.mutate({ lobbyId, kickData });
        await openLobbiesQuery.refetch();
        if (lobbiesQuery.data) {
            await lobbiesQuery.refetch();
        }
        return result;
    }, [kickMutation, openLobbiesQuery, lobbiesQuery]);

    const switchTeam = useCallback(async (lobbyId: string, switchData: TeamSwitchRequestDTO) => {
        const result = await switchTeamMutation.mutate({ lobbyId, switchData });
        await openLobbiesQuery.refetch();
        if (lobbiesQuery.data) {
            await lobbiesQuery.refetch();
        }
        return result;
    }, [switchTeamMutation, openLobbiesQuery, lobbiesQuery]);

    return {
        lobbies: lobbiesQuery.data,
        openLobbies: openLobbiesQuery.data,
        isLoading: openLobbiesQuery.isLoading,
        error: openLobbiesQuery.error || lobbiesQuery.error,
        createLobby,
        joinLobby,
        leaveLobby,
        kickPlayer,
        switchTeam,
        refetch: () => {
            openLobbiesQuery.refetch();
            if (lobbiesQuery.data) {
                lobbiesQuery.refetch();
            }
        },
        fetchAllLobbies: lobbiesQuery.execute,
        isCreating: createMutation.isLoading,
        isJoining: joinMutation.isLoading,
        isLeaving: leaveMutation.isLoading,
        isKicking: kickMutation.isLoading,
        isSwitchingTeam: switchTeamMutation.isLoading,
    };
}
