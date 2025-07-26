import { useCallback } from 'react';
import { friendshipService } from '../services';
import { useApi, useMutation } from './useApi';
import type {CreateFriendshipDTO} from '../types';

export function useFriends(userId?: string) {
    const friendshipsQuery = useApi(
        () => friendshipService.getFriendshipsByUser(userId!),
        { immediate: !!userId }
    );

    const createMutation = useMutation(friendshipService.createFriendship);
    const acceptMutation = useMutation(friendshipService.acceptFriendship);
    const rejectMutation = useMutation(friendshipService.rejectFriendship);
    const cancelMutation = useMutation(friendshipService.cancelFriendship);
    const deleteMutation = useMutation(friendshipService.deleteFriendship);

    const sendFriendRequest = useCallback(async (friendshipData: CreateFriendshipDTO) => {
        const result = await createMutation.mutate(friendshipData);
        await friendshipsQuery.refetch();
        return result;
    }, [createMutation, friendshipsQuery]);

    const acceptFriendRequest = useCallback(async (friendshipId: string) => {
        const result = await acceptMutation.mutate(friendshipId);
        await friendshipsQuery.refetch();
        return result;
    }, [acceptMutation, friendshipsQuery]);

    const rejectFriendRequest = useCallback(async (friendshipId: string) => {
        const result = await rejectMutation.mutate(friendshipId);
        await friendshipsQuery.refetch();
        return result;
    }, [rejectMutation, friendshipsQuery]);

    const cancelFriendRequest = useCallback(async (friendshipId: string) => {
        const result = await cancelMutation.mutate(friendshipId);
        await friendshipsQuery.refetch();
        return result;
    }, [cancelMutation, friendshipsQuery]);

    const removeFriend = useCallback(async (friendshipId: string) => {
        const result = await deleteMutation.mutate(friendshipId);
        await friendshipsQuery.refetch();
        return result;
    }, [deleteMutation, friendshipsQuery]);

    return {
        friendships: friendshipsQuery.data || [],
        isLoading: friendshipsQuery.isLoading,
        error: friendshipsQuery.error,
        sendFriendRequest,
        acceptFriendRequest,
        rejectFriendRequest,
        cancelFriendRequest,
        removeFriend,
        refetch: friendshipsQuery.refetch,
        isSending: createMutation.isLoading,
        isAccepting: acceptMutation.isLoading,
        isRejecting: rejectMutation.isLoading,
        isCanceling: cancelMutation.isLoading,
        isRemoving: deleteMutation.isLoading,
    };
}

export function useAllFriendships() {
    return useApi(() => friendshipService.getAllFriendships());
}

export function useFriendship(friendshipId?: string) {
    return useApi(
        () => friendshipService.getFriendshipById(friendshipId!),
        { immediate: !!friendshipId }
    );
}