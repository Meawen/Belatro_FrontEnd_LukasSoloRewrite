import { useCallback } from 'react';
import { adminService } from '../services';
import { useApi, useMutation } from './useApi';

export function useAdmin() {
    const usersQuery = useApi(() => adminService.listUsers());
    const forgetUserMutation = useMutation(adminService.forgetUser);

    const forgetUser = useCallback(async (userId: string) => {
        const result = await forgetUserMutation.mutate(userId);
        // the user is gone: a failed refresh shows as the list's own error, never as a failed delete (spec §8)
        await usersQuery.refetch().catch(() => {});
        return result;
    }, [forgetUserMutation, usersQuery]);

    return {
        users: usersQuery.data || [],
        isLoading: usersQuery.isLoading,
        error: usersQuery.error,
        forgetUser,
        refetch: usersQuery.refetch,
        isForgettingUser: forgetUserMutation.isLoading,
    };
}