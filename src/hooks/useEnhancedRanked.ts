
import { useState, useCallback, useEffect, useRef } from 'react';
import { rankedService } from '../services';
import { useMutation } from './useApi';
import { useGameWebSocket } from './useGameWebSocket';
import type { MatchDTO, QueueStatusDTO } from '../types';
import { useAuth } from './useAuth';

export function useEnhancedRanked() {
    const [isInQueue, setIsInQueue] = useState(false);
    const [queueStatus, setQueueStatus] = useState<QueueStatusDTO | null>(null);
    const [foundMatch, setFoundMatch] = useState<MatchDTO | null>(null);

    // Track pending leave operations to avoid race conditions
    const pendingLeaveRef = useRef(false);
    const leaveTimeoutRef = useRef<number | null>(null);
    const initialSyncDoneRef = useRef(false);
    const manualStateOverrideRef = useRef(false);

    const { user, isAuthenticated, isLoading } = useAuth();

    // Use refs to avoid stale closures in WebSocket callbacks
    const isInQueueRef = useRef(isInQueue);
    const queueStatusRef = useRef(queueStatus);

    // Keep refs in sync with state
    useEffect(() => {
        isInQueueRef.current = isInQueue;
    }, [isInQueue]);

    useEffect(() => {
        queueStatusRef.current = queueStatus;
    }, [queueStatus]);

    const joinQueueMutation = useMutation(rankedService.joinQueue);
    const leaveQueueMutation = useMutation(rankedService.leaveQueue);

    // Create stable callback functions that don't have stale closures
    const handleQueueStatusUpdate = useCallback((status: QueueStatusDTO) => {
        console.log('Queue status update received:', status, 'pendingLeave:', pendingLeaveRef.current, 'manualOverride:', manualStateOverrideRef.current);

        // 🔥 FIX: Ignore ALL WebSocket updates when we're manually managing state
        if (manualStateOverrideRef.current) {
            console.log('🔇 Ignoring WebSocket update due to manual state override');
            return;
        }

        // 🔥 FIX: If we receive IN_QUEUE immediately after connecting but we think we're not in queue
        if (!initialSyncDoneRef.current && status.state === 'IN_QUEUE' && !isInQueueRef.current) {
            console.log('🔧 Backend thinks we are in queue but frontend does not - this might be stale data');
            console.log('🚫 Will ignore this initial IN_QUEUE status');
            initialSyncDoneRef.current = true;
            return; // Don't process this potentially stale status
        }

        initialSyncDoneRef.current = true;

        // Always update queueStatus for display purposes (unless we're overriding)
        setQueueStatus(status);

        if (status.state === 'IN_QUEUE') {
            // Only set to true if we're not pending a leave operation
            if (!pendingLeaveRef.current) {
                console.log('Setting isInQueue to true from WebSocket');
                setIsInQueue(true);
            } else {
                console.log('Ignoring IN_QUEUE status due to pending leave operation');
            }
        } else if (status.state === 'CANCELLED') {
            console.log('Setting isInQueue to false from WebSocket (cancelled)');
            setIsInQueue(false);
            setFoundMatch(null);
            // Clear pending leave since server confirms we left
            pendingLeaveRef.current = false;
            manualStateOverrideRef.current = false;
            if (leaveTimeoutRef.current) {
                clearTimeout(leaveTimeoutRef.current);
                leaveTimeoutRef.current = null;
            }
        }

        console.log('State update calls completed');
    }, []);

    const handleMatchFound = useCallback((match: MatchDTO) => {
        console.log('Match found received:', match);
        setFoundMatch(match);
        setIsInQueue(false);
        // Clear pending leave since we're now in a match
        pendingLeaveRef.current = false;
        manualStateOverrideRef.current = false;
        if (leaveTimeoutRef.current) {
            clearTimeout(leaveTimeoutRef.current);
            leaveTimeoutRef.current = null;
        }
    }, []);

    // WebSocket integration for real-time queue updates
    const { isConnected, isConnecting, subscribeToRankedQueue, unsubscribeFromRankedQueue, connectionError } = useGameWebSocket({
        onQueueStatusUpdate: handleQueueStatusUpdate,
        onMatchFound: handleMatchFound
    });

    // Auto-subscribe whenever WebSocket connects
    useEffect(() => {
        if (isConnected && user?.username) {
            console.log('WebSocket connected, auto-subscribing to ranked queue...');
            subscribeToRankedQueue();
        }
    }, [isConnected, user?.username, subscribeToRankedQueue]);

    // The connection is owned by services/gameSocket (one per tab); useGameWebSocket
    // holds it while this component is mounted.

    const joinQueue = useCallback(async () => {
        if (isLoading || !isAuthenticated || !user?.username) {
            throw new Error('Authentication not ready');
        }

        console.log('joinQueue called', { isConnected, isConnecting, hasUser: !!user?.username });
        try {
            // Clear any pending leave operations and manual overrides
            pendingLeaveRef.current = false;
            manualStateOverrideRef.current = false;
            if (leaveTimeoutRef.current) {
                clearTimeout(leaveTimeoutRef.current);
                leaveTimeoutRef.current = null;
            }

            // MATCH_FOUND arrives over the WebSocket; queueing without it would go unnoticed.
            if (!isConnected) {
                throw new Error('Not connected to the game server');
            }

            // Then make HTTP call to join queue
            console.log('Making HTTP call to join queue...');
            await joinQueueMutation.mutate(undefined);

            // Set isInQueue immediately after successful HTTP request
            console.log('HTTP call successful, setting isInQueue to true immediately');
            setIsInQueue(true);

        } catch (error) {
            console.error('Error in joinQueue:', error);
            setIsInQueue(false);
            throw error;
        }
    }, [joinQueueMutation, isConnected, user, isAuthenticated, isLoading]);

    const leaveQueue = useCallback(async () => {
        console.log('🚪 leaveQueue called');
        try {
            // 🔥 IMPROVED: Set manual override to ignore WebSocket updates
            manualStateOverrideRef.current = true;
            pendingLeaveRef.current = true;

            console.log('Making HTTP DELETE call...');
            await leaveQueueMutation.mutate(undefined);

            // Immediately update UI to reflect the leave action
            console.log('✅ HTTP DELETE successful, updating UI immediately');
            setIsInQueue(false);
            setQueueStatus(null);
            pendingLeaveRef.current = false;

            // 🔥 NEW: Temporarily unsubscribe from WebSocket to stop receiving stale messages
            if (unsubscribeFromRankedQueue) {
                console.log('📵 Temporarily unsubscribing from WebSocket queue updates...');
                unsubscribeFromRankedQueue();
            }

            // Wait a bit for backend to process, then re-subscribe
            leaveTimeoutRef.current = window.setTimeout(() => {
                console.log('🔄 Re-subscribing to WebSocket queue updates...');

                // Re-enable WebSocket updates
                manualStateOverrideRef.current = false;

                // Re-subscribe to get fresh state
                if (isConnected && subscribeToRankedQueue) {
                    subscribeToRankedQueue();
                }

                leaveTimeoutRef.current = null;
            }, 2000); // Wait 2 seconds for backend to process

        } catch (error) {
            console.error('Error leaving queue:', error);
            // Clear pending state on HTTP error
            pendingLeaveRef.current = false;
            manualStateOverrideRef.current = false;
            if (leaveTimeoutRef.current) {
                clearTimeout(leaveTimeoutRef.current);
                leaveTimeoutRef.current = null;
            }
            throw error;
        }
    }, [leaveQueueMutation, unsubscribeFromRankedQueue, isConnected, subscribeToRankedQueue]);

    const acceptMatch = useCallback(() => {
        // Clear match found state and transition to game
        setFoundMatch(null);
        setQueueStatus(null);
        pendingLeaveRef.current = false;
        manualStateOverrideRef.current = false;
        if (leaveTimeoutRef.current) {
            clearTimeout(leaveTimeoutRef.current);
            leaveTimeoutRef.current = null;
        }
    }, []);

    // Clean up timeout on unmount
    useEffect(() => {
        return () => {
            if (leaveTimeoutRef.current) {
                clearTimeout(leaveTimeoutRef.current);
            }
        };
    }, []);

    // Debug logging for state changes
    useEffect(() => {
        console.log('useEnhancedRanked state changed:', {
            isInQueue,
            queueStatus: queueStatus ? 'has data' : 'null',
            pendingLeave: pendingLeaveRef.current,
            manualOverride: manualStateOverrideRef.current
        });
    }, [isInQueue, queueStatus]);

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