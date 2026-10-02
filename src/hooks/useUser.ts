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

export function useAllUsers() {
    const apiFunction = useMemo(() => () => userService.getAllUsers(), []);

    return useApi(apiFunction, {
        staleTime: 180000, // Cache for 3 minutes - leaderboard doesn't need constant updates
        immediate: true
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