import { useMemo } from 'react';
import { userService } from '../services/userService';
import { useApi } from './useApi';
import type { PaginationParams } from '../types';

export function useUser(userId?: string) {
    // Memoize the API function to prevent unnecessary re-executions
    const apiFunction = useMemo(() => {
        if (!userId) {
            return () => Promise.reject(new Error('No user ID provided'));
        }
        return () => userService.getUserById(userId);
    }, [userId]);

    const userQuery = useApi(
        apiFunction,
        {
            immediate: !!userId,
            dependencies: [userId],
            staleTime: 300000 // Cache for 5 minutes - user data doesn't change often
        }
    );

    return {
        user: userQuery.data,
        isLoading: userQuery.isLoading,
        error: userQuery.error,
        refetch: userQuery.refetch,
    };
}

/** Page size of the players list; the backend clamps it to 1..100. */
export const USERS_PAGE_SIZE = 20;

export function useUsersPage(page: number, q: string) {
    const apiFunction = useMemo(
        () => () => userService.getUsersPage({ page, size: USERS_PAGE_SIZE, q }),
        [page, q]
    );

    // staleTime 0: useApi caches per hook instance, not per page, so a cached
    // page 0 would otherwise be served for page 1.
    return useApi(apiFunction, {
        immediate: true,
        dependencies: [page, q],
        staleTime: 0,
    });
}

export function useUserHistory(playerId: string, pagination?: PaginationParams) {
    const apiFunction = useMemo(() => {
        if (!playerId) {
            return () => Promise.reject(new Error('No player ID provided'));
        }
        return () => userService.getUserHistory(playerId, pagination);
    }, [playerId, pagination?.page, pagination?.size]);

    return useApi(
        apiFunction,
        {
            immediate: !!playerId,
            dependencies: [playerId, pagination?.page, pagination?.size],
            staleTime: 180000 // Cache for 3 minutes
        }
    );
}

export function useUserHistorySummary(playerId: string, pagination?: PaginationParams) {
    const apiFunction = useMemo(() => {
        if (!playerId) {
            return () => Promise.reject(new Error('No player ID provided'));
        }
        return () => userService.getUserHistorySummary(playerId, pagination);
    }, [playerId, pagination?.page, pagination?.size]);

    return useApi(
        apiFunction,
        {
            immediate: !!playerId,
            dependencies: [playerId, pagination?.page, pagination?.size],
            staleTime: 180000 // Cache for 3 minutes
        }
    );
}

/**
 * Fired after this tab changed what GET /user/me returns (email, pending address, password).
 * Every useMe instance caches its own copy, and AppLayout's banner stays mounted across
 * navigation, so it re-fetches on this event instead of showing the old address until a reload.
 */
export const ME_CHANGED = 'stiglja:me-changed';

export function notifyMeChanged(): void {
    window.dispatchEvent(new Event(ME_CHANGED));
}

export function useMe(enabled: boolean = true) {
    const apiFunction = useMemo(() => () => userService.getMe(), []);
    const query = useApi(apiFunction, {
        immediate: enabled,
        dependencies: [enabled],
        staleTime: 60000,
    });
    // useApi keeps its last data when disabled; a mounted profile that switches to
    // someone else's id must not keep showing the viewer's own email and roles.
    return enabled ? query : { ...query, data: null };
}