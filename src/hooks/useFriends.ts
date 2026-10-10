import { useCallback, useMemo, useRef } from 'react';
import { friendshipService } from '../services';
import { useApi, useMutation } from './useApi';
import type { CreateFriendshipDTO, Friendship } from '../types';

// Global cache to share friendship data across all hook instances
const friendshipCache = new Map<string, {
    data: Friendship[];
    timestamp: number;
    isLoading: boolean;
}>();

const CACHE_DURATION = 120000; // 2 minutes
const MAX_CACHE_SIZE = 50; // Prevent memory leaks

// Clean up old cache entries
const cleanupCache = () => {
    const now = Date.now();
    const entries = Array.from(friendshipCache.entries());

    // Remove expired entries
    entries.forEach(([key, value]) => {
        if (now - value.timestamp > CACHE_DURATION) {
            friendshipCache.delete(key);
        }
    });

    // If still too large, remove oldest entries
    if (friendshipCache.size > MAX_CACHE_SIZE) {
        const sortedEntries = entries
            .sort(([,a], [,b]) => a.timestamp - b.timestamp)
            .slice(0, friendshipCache.size - MAX_CACHE_SIZE);

        sortedEntries.forEach(([key]) => {
            friendshipCache.delete(key);
        });
    }
};

export function useFriends(userId?: string) {
    const requestCountRef = useRef(0);
    const cacheKey = userId ? `friendships_${userId}` : '';

    // Memoize the API function to prevent unnecessary re-executions
    const apiFunction = useMemo(() => {
        if (!userId) {
            return () => Promise.reject(new Error('No user ID provided'));
        }

        return async () => {
            // Check global cache first
            const cached = friendshipCache.get(cacheKey);
            const now = Date.now();

            if (cached && (now - cached.timestamp < CACHE_DURATION) && !cached.isLoading) {
                console.log(`useFriends: Using cached data for ${userId}`);
                return cached.data;
            }

            // Prevent duplicate requests
            if (cached?.isLoading) {
                console.log(`useFriends: Request already in progress for ${userId}`);
                // Wait for the existing request
                return new Promise<Friendship[]>((resolve) => {
                    const checkCache = () => {
                        const currentCached = friendshipCache.get(cacheKey);
                        if (currentCached && !currentCached.isLoading) {
                            resolve(currentCached.data);
                        } else {
                            setTimeout(checkCache, 100);
                        }
                    };
                    setTimeout(checkCache, 100);
                });
            }

            // Mark as loading in cache
            friendshipCache.set(cacheKey, {
                data: cached?.data || [],
                timestamp: cached?.timestamp || 0,
                isLoading: true
            });

            console.log(`useFriends: Making fresh API request for ${userId} (request #${++requestCountRef.current})`);

            try {
                const result = await friendshipService.getFriendshipsByUser(userId);

                // Update cache with new data
                friendshipCache.set(cacheKey, {
                    data: result,
                    timestamp: now,
                    isLoading: false
                });

                // Cleanup old cache entries
                cleanupCache();

                return result;
            } catch (error) {
                // Mark as not loading on error, but keep old data if available
                const errorCached = friendshipCache.get(cacheKey);
                if (errorCached) {
                    friendshipCache.set(cacheKey, {
                        ...errorCached,
                        isLoading: false
                    });
                }
                throw error;
            }
        };
    }, [userId, cacheKey]);

    const friendshipsQuery = useApi(
        apiFunction,
        {
            immediate: !!userId,
            dependencies: [userId], // Only depend on userId
            staleTime: CACHE_DURATION // Use same cache duration
        }
    );

    const createMutation = useMutation(friendshipService.createFriendship);
    const acceptMutation = useMutation(friendshipService.acceptFriendship);
    const rejectMutation = useMutation(friendshipService.rejectFriendship);
    const cancelMutation = useMutation(friendshipService.cancelFriendship);
    const deleteMutation = useMutation(friendshipService.deleteFriendship);

    // Optimized refetch that updates global cache
    const refetchFriendships = useCallback(async () => {
        if (!userId) return;

        // Clear cache to force fresh data
        friendshipCache.delete(cacheKey);
        return friendshipsQuery.refetch();
    }, [userId, cacheKey, friendshipsQuery]);

    const sendFriendRequest = useCallback(async (friendshipData: CreateFriendshipDTO) => {
        const result = await createMutation.mutate(friendshipData);
        // Clear cache to force refresh
        friendshipCache.delete(cacheKey);
        await refetchFriendships();
        return result;
    }, [createMutation, refetchFriendships, cacheKey]);

    const acceptFriendRequest = useCallback(async (friendshipId: string) => {
        const result = await acceptMutation.mutate(friendshipId);
        friendshipCache.delete(cacheKey);
        await refetchFriendships();
        return result;
    }, [acceptMutation, refetchFriendships, cacheKey]);

    const rejectFriendRequest = useCallback(async (friendshipId: string) => {
        const result = await rejectMutation.mutate(friendshipId);
        friendshipCache.delete(cacheKey);
        await refetchFriendships();
        return result;
    }, [rejectMutation, refetchFriendships, cacheKey]);

    const cancelFriendRequest = useCallback(async (friendshipId: string) => {
        const result = await cancelMutation.mutate(friendshipId);
        friendshipCache.delete(cacheKey);
        await refetchFriendships();
        return result;
    }, [cancelMutation, refetchFriendships, cacheKey]);

    const removeFriend = useCallback(async (friendshipId: string) => {
        const result = await deleteMutation.mutate(friendshipId);
        friendshipCache.delete(cacheKey);
        await refetchFriendships();
        return result;
    }, [deleteMutation, refetchFriendships, cacheKey]);

    return {
        friendships: friendshipsQuery.data || [],
        isLoading: friendshipsQuery.isLoading,
        error: friendshipsQuery.error,
        sendFriendRequest,
        acceptFriendRequest,
        rejectFriendRequest,
        cancelFriendRequest,
        removeFriend,
        refetch: refetchFriendships,
        isSending: createMutation.isLoading,
        isAccepting: acceptMutation.isLoading,
        isRejecting: rejectMutation.isLoading,
        isCanceling: cancelMutation.isLoading,
        isRemoving: deleteMutation.isLoading,
    };
}

/** What useFriends gives: the signed-in player's friendships and the actions on them. */
export type FriendsState = ReturnType<typeof useFriends>;

export function useAllFriendships() {
    const apiFunction = useMemo(() => () => friendshipService.getAllFriendships(), []);
    return useApi(apiFunction, { staleTime: CACHE_DURATION });
}

export function useFriendship(friendshipId?: string) {
    const apiFunction = useMemo(() => {
        if (!friendshipId) {
            return () => Promise.reject(new Error('No friendship ID provided'));
        }
        return () => friendshipService.getFriendshipById(friendshipId);
    }, [friendshipId]);

    return useApi(
        apiFunction,
        {
            immediate: !!friendshipId,
            dependencies: [friendshipId],
            staleTime: CACHE_DURATION
        }
    );
}

// Utility function to clear all friendship caches (useful for debugging or logout)
export function clearFriendshipCache() {
    friendshipCache.clear();
    console.log('Friendship cache cleared');
}