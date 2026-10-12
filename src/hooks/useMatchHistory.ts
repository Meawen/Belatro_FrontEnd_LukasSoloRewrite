import { useCallback, useMemo } from 'react';
import { matchHistoryService } from '../services/matchHistoryService';
import { useApi } from './useApi';
import type { PlayerMatchSummaryDTO } from '../types/user';

export function useMatchSummary(
    playerId?: string | null,
    page: number = 0,
    size: number = 20
) {
    // Memoize API function to prevent unnecessary re-executions
    const apiFunction = useMemo(() => {
        if (!playerId) {
            return () => Promise.reject(new Error('No player ID provided'));
        }
        return () => matchHistoryService.getMatchSummary(playerId, page, size);
    }, [playerId, page, size]);

    const matchSummaryQuery = useApi(
        apiFunction,
        {
            immediate: !!playerId,
            dependencies: [playerId, page, size],
            staleTime: 90000 // Cache for 1.5 minutes
        }
    );

    const refetch = useCallback(() => {
        return matchSummaryQuery.refetch();
    }, [matchSummaryQuery]);

    return {
        matchSummary: matchSummaryQuery.data as PlayerMatchSummaryDTO[] | undefined,
        isLoading: matchSummaryQuery.isLoading,
        error: matchSummaryQuery.error,
        refetch,
    };
}