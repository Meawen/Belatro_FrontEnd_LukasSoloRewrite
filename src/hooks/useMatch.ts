import { useCallback } from 'react';
import { matchService } from '../services/matchService';
import { useApi, useMutation } from './useApi';
import type {MatchDTO} from '../types';

export function useMatch(matchId?: string) {
    const matchQuery = useApi(
        () => matchService.getMatch(matchId!),
        { immediate: !!matchId }
    );

    const movesQuery = useApi(
        () => matchService.getMoves(matchId!),
        { immediate: !!matchId }
    );

    const structuredMovesQuery = useApi(
        () => matchService.getStructuredMoves(matchId!),
        { immediate: !!matchId }
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
    const matchesQuery = useApi(() => matchService.getAllMatches());
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
    return useApi(
        () => matchService.getMatchByLobbyId(lobbyId!),
        { immediate: !!lobbyId }
    );
}