import { useEffect, useMemo } from 'react';
import { userService } from '../services/userService';
import { ApiError } from '../services/api';
import { useApi } from './useApi';

/** How long the ladder and a rating history count as fresh (ranks spec §4.3). */
export const RATINGS_STALE_MS = 60000;

/** A 404 from a chart route: the backend predates it (ranks spec §4.2), so that chart's panel isn't shown. */
export function isNotFound(error: unknown): boolean {
    return error instanceof ApiError && error.status === 404;
}

/**
 * Asks again when the tab comes back into view, e.g. after a game played in another tab. Not forced: useApi's
 * staleTime decides, so flipping between tabs doesn't refetch every time.
 */
function useRefetchWhenVisible(execute: () => Promise<unknown>, enabled: boolean) {
    useEffect(() => {
        if (!enabled) return;
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') execute().catch(() => {});
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, [execute, enabled]);
}

/** GET /user/ladder, for the Leaderboard's chart and the rank names and starts the Profile needs. */
export function useLadder(enabled: boolean = true) {
    const apiFunction = useMemo(() => () => userService.getLadder(), []);
    const query = useApi(apiFunction, {
        immediate: enabled,
        dependencies: [enabled],
        staleTime: RATINGS_STALE_MS,
    });
    useRefetchWhenVisible(query.execute, enabled);
    return query;
}

/** GET /user/{id}/rating-history, for your climb on your own Profile. */
export function useRatingHistory(userId?: string) {
    const apiFunction = useMemo(() => {
        if (!userId) {
            return () => Promise.reject(new Error('No user ID provided'));
        }
        return () => userService.getRatingHistory(userId);
    }, [userId]);
    const query = useApi(apiFunction, {
        immediate: !!userId,
        dependencies: [userId],
        staleTime: RATINGS_STALE_MS,
    });
    useRefetchWhenVisible(query.execute, !!userId);
    return query;
}
