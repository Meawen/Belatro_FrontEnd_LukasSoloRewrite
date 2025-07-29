import { useCallback, useMemo } from 'react';
import { userService } from '../services/userService';
import { useApi, useMutation } from './useApi';
import type { UserUpdateDTO, PaginationParams } from '../types';

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

    const updateMutation = useMutation((data: { id: string; userData: UserUpdateDTO }) =>
        userService.updateUser(data.id, data.userData)
    );

    const deleteMutation = useMutation((id: string) =>
        userService.deleteUser(id)
    );

    const updateUser = useCallback(async (userData: UserUpdateDTO) => {
        if (!userId) throw new Error('User ID is required');

        const result = await updateMutation.mutate({ id: userId, userData });
        // Refetch user data after update
        userQuery.refetch();
        return result;
    }, [userId, updateMutation, userQuery]);

    const deleteUser = useCallback(async () => {
        if (!userId) throw new Error('User ID is required');

        return await deleteMutation.mutate(userId);
    }, [userId, deleteMutation]);

    return {
        user: userQuery.data,
        isLoading: userQuery.isLoading,
        error: userQuery.error,
        updateUser,
        deleteUser,
        refetch: userQuery.refetch,
        isUpdating: updateMutation.isLoading,
        isDeleting: deleteMutation.isLoading,
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