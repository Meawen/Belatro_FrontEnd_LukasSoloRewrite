
import { useState, useCallback, useEffect } from 'react';
import { rankedService } from '../services';
import { useMutation } from './useApi';
import { useGameWebSocket, type QueueStatusDTO, type MatchDTO } from './useGameWebSocket';
import { useAuth } from './useAuth';

export function useEnhancedRanked() {
    const [isInQueue, setIsInQueue] = useState(false);
    const [queueStatus, setQueueStatus] = useState<QueueStatusDTO | null>(null);
    const [foundMatch, setFoundMatch] = useState<MatchDTO | null>(null);

    const { user, token, isAuthenticated, isLoading } = useAuth();

    // Add debug logging but only when values change
    const debugAuth = useCallback(() => {
        console.log('=== useEnhancedRanked Debug ===');
        console.log('Auth loading:', isLoading);
        console.log('Auth user:', user);
        console.log('Auth token:', token);
        console.log('Auth isAuthenticated:', isAuthenticated);
    }, [user, token, isAuthenticated, isLoading]);

    // Only log when auth state actually changes
    useEffect(() => {
        debugAuth();
    }, [debugAuth]);

    const joinQueueMutation = useMutation(rankedService.joinQueue);
    const leaveQueueMutation = useMutation(rankedService.leaveQueue);

    // WebSocket integration for real-time queue updates
    const { isConnected, isConnecting, connect, subscribeToRankedQueue, connectionError } = useGameWebSocket({
        onQueueStatusUpdate: (status: QueueStatusDTO) => {
            console.log('Queue status update:', status);
            setQueueStatus(status);

            if (status.state === 'IN_QUEUE') {
                setIsInQueue(true);
            } else if (status.state === 'CANCELLED') {
                setIsInQueue(false);
                setFoundMatch(null);
            }
        },
        onMatchFound: (match: MatchDTO) => {
            console.log('Match found:', match);
            setFoundMatch(match);
            setIsInQueue(false);
        }
    });

    // Only attempt connection when auth is fully loaded and user is available
    useEffect(() => {
        // Wait for auth to finish loading
        if (isLoading) {
            console.log('useEnhancedRanked: Auth still loading, waiting...');
            return;
        }

        console.log('useEnhancedRanked: checking WebSocket connection...', {
            isConnected,
            isConnecting,
            connectionError,
            hasUser: !!user,
            hasUsername: !!user?.username,
            isAuthenticated
        });

        // Only try to connect if fully authenticated with user data
        if (isAuthenticated && user?.username && !isConnected && !isConnecting && !connectionError) {
            console.log('Attempting to connect WebSocket...');
            connect().catch((error: any) => {
                console.error('Failed to auto-connect WebSocket:', error);
            });
        }
    }, [connect, isConnected, isConnecting, connectionError, user, isAuthenticated, isLoading]);

    const joinQueue = useCallback(async () => {
        // Wait for auth to be ready
        if (isLoading || !isAuthenticated || !user?.username) {
            throw new Error('Authentication not ready');
        }

        console.log('joinQueue called', { isConnected, isConnecting, hasUser: !!user?.username });
        try {
            // First, ensure WebSocket is connected
            if (!isConnected) {
                console.log('WebSocket not connected, connecting...');
                await connect();
            }

            // Subscribe to WebSocket channels
            console.log('Subscribing to ranked queue...');
            subscribeToRankedQueue();

            // Then make HTTP call to join queue
            console.log('Making HTTP call to join queue...');
            await joinQueueMutation.mutate(undefined);
            console.log('HTTP call successful, setting isInQueue to true');
            setIsInQueue(true);
        } catch (error) {
            console.error('Error in joinQueue:', error);
            setIsInQueue(false);
            throw error;
        }
    }, [joinQueueMutation, isConnected, connect, subscribeToRankedQueue, user, isAuthenticated, isLoading]);

    const leaveQueue = useCallback(async () => {
        console.log('leaveQueue called');
        try {
            await leaveQueueMutation.mutate(undefined);
            setIsInQueue(false);
            setQueueStatus(null);
            console.log('Successfully left queue');
        } catch (error) {
            console.error('Error leaving queue:', error);
            // Even if server call fails, assume we left the queue
            setIsInQueue(false);
            setQueueStatus(null);
            throw error;
        }
    }, [leaveQueueMutation]);

    const acceptMatch = useCallback(() => {
        // Clear match found state and transition to game
        setFoundMatch(null);
        setQueueStatus(null);
    }, []);

    return {
        // Queue state
        isInQueue,
        queueStatus,
        foundMatch,

        // Actions
        joinQueue,
        leaveQueue,
        acceptMatch,

        // Loading states
        isJoining: joinQueueMutation.isLoading,
        isLeaving: leaveQueueMutation.isLoading,

        // Errors
        joinError: joinQueueMutation.error,
        leaveError: leaveQueueMutation.error,

        // WebSocket state
        isWebSocketConnected: isConnected,
        isWebSocketConnecting: isConnecting,
        webSocketError: connectionError,
    };
}