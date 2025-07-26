import { useCallback } from 'react';
import { userService } from '../services/userService';
import { useApi, useMutation } from './useApi';
import type {UserUpdateDTO, PaginationParams} from '../types';

export function useUser(userId?: string) {
    const userQuery = useApi(
        () => userService.getUserById(userId!),
        { immediate: !!userId }
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
    return useApi(() => userService.getAllUsers());
}

export function useUserHistory(playerId: string, pagination?: PaginationParams) {
    return useApi(
        () => userService.getUserHistory(playerId, pagination),
        { immediate: !!playerId }
    );
}

export function useUserHistorySummary(playerId: string, pagination?: PaginationParams) {
    return useApi(
        () => userService.getUserHistorySummary(playerId, pagination),
        { immediate: !!playerId }
    );
}