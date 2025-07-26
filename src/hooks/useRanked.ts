import { useState, useCallback } from 'react';
import { rankedService } from '../services/rankedService';
import { useMutation } from './useApi';

export function useRanked() {
    const [isInQueue, setIsInQueue] = useState(false);

    const joinQueueMutation = useMutation(rankedService.joinQueue);
    const leaveQueueMutation = useMutation(rankedService.leaveQueue);

    const joinQueue = useCallback(async () => {
        try {
            await joinQueueMutation.mutate(undefined);
            setIsInQueue(true);
        } catch (error) {
            setIsInQueue(false);
            throw error;
        }
    }, [joinQueueMutation]);

    const leaveQueue = useCallback(async () => {
        try {
            await leaveQueueMutation.mutate(undefined);
            setIsInQueue(false);
        } catch (error) {
            // Even if server call fails, assume we left the queue
            setIsInQueue(false);
            throw error;
        }
    }, [leaveQueueMutation]);

    return {
        isInQueue,
        joinQueue,
        leaveQueue,
        isJoining: joinQueueMutation.isLoading,
        isLeaving: leaveQueueMutation.isLoading,
        joinError: joinQueueMutation.error,
        leaveError: leaveQueueMutation.error,
    };
}