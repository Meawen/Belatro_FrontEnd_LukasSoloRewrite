import { useCallback, useMemo } from 'react';
import { matchService } from '../services/matchService';
import { useApi, useMutation } from './useApi';
import type { MatchDTO } from '../types';

export function useMatch(matchId?: string) {
    // Memoize API functions to prevent unnecessary re-executions
    const matchApiFunction = useMemo(() => {
        if (!matchId) {
            return () => Promise.reject(new Error('No match ID provided'));
        }
        return () => matchService.getMatch(matchId);
    }, [matchId]);

    const movesApiFunction = useMemo(() => {
        if (!matchId) {
            return () => Promise.reject(new Error('No match ID provided'));
        }
        return () => matchService.getMoves(matchId);
    }, [matchId]);

    const structuredMovesApiFunction = useMemo(() => {
        if (!matchId) {
            return () => Promise.reject(new Error('No match ID provided'));
        }
        return () => matchService.getStructuredMoves(matchId);
    }, [matchId]);

    const matchQuery = useApi(
        matchApiFunction,
        {
            immediate: !!matchId,
            dependencies: [matchId],
            staleTime: 120000 // Cache for 2 minutes
        }
    );

    const movesQuery = useApi(
        movesApiFunction,
        {
            immediate: !!matchId,
            dependencies: [matchId],
            staleTime: 120000 // Cache for 2 minutes
        }
    );

    const structuredMovesQuery = useApi(
        structuredMovesApiFunction,
        {
            immediate: !!matchId,
            dependencies: [matchId],
            staleTime: 120000 // Cache for 2 minutes
        }
    );

    const updateMutation = useMutation((data: { id: string; matchData: MatchDTO }) =>
        matchService.updateMatch(data.id, data.matchData)
    );

    const deleteMutation = useMutation(matchService.deleteMatch);

    const updateMatch = useCallback(async (matchData: MatchDTO) => {
        if (!matchId) throw new Error('Match ID is required');

        const result = await updateMutation.mutate({ id: matchId, matchData });
        matchQuery.refetch();
        return result;
    }, [matchId, updateMutation, matchQuery]);

    const deleteMatch = useCallback(async () => {
        if (!matchId) throw new Error('Match ID is required');
        return await deleteMutation.mutate(matchId);
    }, [matchId, deleteMutation]);

    const refetchAll = useCallback(() => {
        matchQuery.refetch();
        movesQuery.refetch();
        structuredMovesQuery.refetch();
    }, [matchQuery, movesQuery, structuredMovesQuery]);

    return {
        match: matchQuery.data,
        moves: movesQuery.data,
        structuredMoves: structuredMovesQuery.data,
        isLoading: matchQuery.isLoading,
        isMovesLoading: movesQuery.isLoading,
        isStructuredMovesLoading: structuredMovesQuery.isLoading,
        error: matchQuery.error,
        updateMatch,
        deleteMatch,
        refetch: refetchAll,
        isUpdating: updateMutation.isLoading,
        isDeleting: deleteMutation.isLoading,
    };
}

export function useAllMatches() {
    const apiFunction = useMemo(() => () => matchService.getAllMatches(), []);

    const matchesQuery = useApi(apiFunction, { staleTime: 60000 }); // Cache for 1 minute
    const createMutation = useMutation(matchService.createMatch);

    const createMatch = useCallback(async (matchData: MatchDTO) => {
        const result = await createMutation.mutate(matchData);
        await matchesQuery.refetch();
        return result;
    }, [createMutation, matchesQuery]);

    return {
        matches: matchesQuery.data,
        isLoading: matchesQuery.isLoading,
        error: matchesQuery.error,
        createMatch,
        refetch: matchesQuery.refetch,
        isCreating: createMutation.isLoading,
    };
}

export function useMatchByLobby(lobbyId?: string) {
    const apiFunction = useMemo(() => {
        if (!lobbyId) {
            return () => Promise.reject(new Error('No lobby ID provided'));
        }
        return () => matchService.getMatchByLobbyId(lobbyId);
    }, [lobbyId]);

    return useApi(
        apiFunction,
        {
            immediate: !!lobbyId,
            dependencies: [lobbyId],
            staleTime: 60000 // Cache for 1 minute
        }
    );
}