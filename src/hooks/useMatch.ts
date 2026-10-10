import { useCallback, useMemo } from 'react';
import { matchService } from '../services/matchService';
import { useApi, useMutation } from './useApi';
import type { MatchDTO } from '../types';

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
