import { useCallback } from 'react';
import { matchHistoryService } from '../services/matchHistoryService';
import { useApi } from './useApi';
import type { PlayerMatchHistoryDTO, PlayerMatchSummaryDTO } from '../types/user';

export function useMatchHistory(
    playerId?: string | null,
    page: number = 0,
    size: number = 20
) {
    const matchHistoryQuery = useApi(
        () => matchHistoryService.getMatchHistory(playerId!, page, size),
        { immediate: !!playerId }
    );

    const refetch = useCallback(() => {
        return matchHistoryQuery.refetch();
    }, [matchHistoryQuery]);

    return {
        matchHistory: matchHistoryQuery.data as PlayerMatchHistoryDTO[] | undefined,
        isLoading: matchHistoryQuery.isLoading,
        error: matchHistoryQuery.error,
        refetch,
    };
}

export function useMatchSummary(
    playerId?: string | null,
    page: number = 0,
    size: number = 20
) {
    const matchSummaryQuery = useApi(
        () => matchHistoryService.getMatchSummary(playerId!, page, size),
        { immediate: !!playerId }
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