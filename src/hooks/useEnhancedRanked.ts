import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { ApiError, rankedService } from '../services';
import { gameSocket } from '../services/gameSocket';
import { useMutation } from './useApi';
import type { MatchDTO, QueueStatusDTO } from '../types';

const QUEUE_STATUS_DESTINATION = '/user/queue/ranked/status';
const MATCH_FOUND_DESTINATION = '/user/queue/match-found';

/**
 * The tab's ranked queue (R-33). RankedQueueProvider runs it once, around the routes, so
 * PlayButton, QueueStatus and MatchFoundModal share one state and a player queued on /play
 * still gets "Match found" on any other page.
 *
 * Its two subscriptions live as long as the provider (they cost nothing without a socket).
 * The socket itself is held only on /play (joining needs it: MATCH_FOUND arrives over it),
 * while queued, and while a found match waits for an answer.
 */
export function useRankedQueueState() {
    const [isInQueue, setIsInQueue] = useState(false);
    const [queueStatus, setQueueStatus] = useState<QueueStatusDTO | null>(null);
    const [foundMatch, setFoundMatch] = useState<MatchDTO | null>(null);

    // Track pending leave operations to avoid race conditions
    const pendingLeaveRef = useRef(false);
    const leaveTimeoutRef = useRef<number | null>(null);
    const manualStateOverrideRef = useRef(false);

    const { pathname } = useLocation();
    const socketState = useSyncExternalStore(gameSocket.onStateChange, gameSocket.getState);
    const isConnected = socketState.isConnected;

    const joinQueueMutation = useMutation(rankedService.joinQueue);
    const leaveQueueMutation = useMutation(rankedService.leaveQueue);

    const clearLeaveTimeout = useCallback(() => {
        if (leaveTimeoutRef.current) {
            clearTimeout(leaveTimeoutRef.current);
            leaveTimeoutRef.current = null;
        }
    }, []);

    const handleQueueStatusUpdate = useCallback((status: QueueStatusDTO) => {
        // A Leave is in flight or just answered: frames already on their way would undo it
        if (manualStateOverrideRef.current) return;

        // Always update queueStatus for display purposes
        setQueueStatus(status);

        if (status.state === 'IN_QUEUE') {
            // The first IN_QUEUE counts too (R-38): after a reload, or when another tab queued,
            // the server's status push every 2 s is how this tab learns it is queued.
            // Only set to true if we're not pending a leave operation
            if (!pendingLeaveRef.current) setIsInQueue(true);
        } else if (status.state === 'CANCELLED') {
            setIsInQueue(false);
            setFoundMatch(null);
            // Clear pending leave since server confirms we left
            pendingLeaveRef.current = false;
            manualStateOverrideRef.current = false;
            clearLeaveTimeout();
        }
    }, [clearLeaveTimeout]);

    const handleMatchFound = useCallback((match: MatchDTO) => {
        setFoundMatch(match);
        setIsInQueue(false);
        // Clear pending leave since we're now in a match
        pendingLeaveRef.current = false;
        manualStateOverrideRef.current = false;
        clearLeaveTimeout();
    }, [clearLeaveTimeout]);

    // Listen for the provider's lifetime; frames only flow while something holds the socket.
    useEffect(() => {
        const stopStatus = gameSocket.subscribe(QUEUE_STATUS_DESTINATION, (body) => {
            let status: QueueStatusDTO;
            try {
                status = JSON.parse(body);
            } catch (e) {
                console.warn('queue status parse failed', e);
                return;
            }
            handleQueueStatusUpdate(status);
        });
        const stopMatchFound = gameSocket.subscribe(MATCH_FOUND_DESTINATION, (body) => {
            let match: MatchDTO;
            try {
                match = JSON.parse(body);
            } catch (e) {
                console.warn('match-found parse failed', e);
                return;
            }
            handleMatchFound(match);
        });
        return () => {
            stopStatus();
            stopMatchFound();
        };
    }, [handleQueueStatusUpdate, handleMatchFound]);

    // A refused join or leave answers one /play visit: the provider outlives pages, so a 429
    // cooldown or a 403 "verify your email" would otherwise greet the next visit after it stopped being true.
    const onPlay = pathname === '/play';
    const resetJoin = joinQueueMutation.reset;
    const resetLeave = leaveQueueMutation.reset;
    useEffect(() => {
        if (onPlay) return;
        resetJoin();
        resetLeave();
    }, [onPlay, resetJoin, resetLeave]);

    const holdSocket = pathname === '/play' || isInQueue || foundMatch !== null;
    useEffect(() => {
        if (!holdSocket) return;
        return gameSocket.acquire();
    }, [holdSocket]);

    const joinQueue = useCallback(async () => {
        // Clear any pending leave operations and manual overrides
        pendingLeaveRef.current = false;
        manualStateOverrideRef.current = false;
        clearLeaveTimeout();

        // MATCH_FOUND arrives over the WebSocket; queueing without it would go unnoticed.
        if (!isConnected) {
            throw new Error('Not connected to the game server');
        }

        try {
            await joinQueueMutation.mutate(undefined);
        } catch (error) {
            // 409 "Already queued": this player queued from another tab or before a reload.
            // They are queued, so show it (Leave) instead of an error (R-38).
            if (error instanceof ApiError && error.status === 409) {
                joinQueueMutation.reset();
                setIsInQueue(true);
                return;
            }
            setIsInQueue(false);
            throw error;
        }

        // Set isInQueue immediately after successful HTTP request
        setIsInQueue(true);
    }, [joinQueueMutation, isConnected, clearLeaveTimeout]);

    const leaveQueue = useCallback(async () => {
        try {
            // Ignore queue frames until the server has processed the leave
            manualStateOverrideRef.current = true;
            pendingLeaveRef.current = true;

            await leaveQueueMutation.mutate(undefined);

            // Immediately update UI to reflect the leave action
            setIsInQueue(false);
            setQueueStatus(null);
            pendingLeaveRef.current = false;

            // Frames the server sent before it processed the leave may still arrive:
            // keep ignoring them for 2 s, then listen again.
            clearLeaveTimeout();
            leaveTimeoutRef.current = window.setTimeout(() => {
                manualStateOverrideRef.current = false;
                leaveTimeoutRef.current = null;
            }, 2000);
        } catch (error) {
            // Clear pending state on HTTP error
            pendingLeaveRef.current = false;
            manualStateOverrideRef.current = false;
            clearLeaveTimeout();
            throw error;
        }
    }, [leaveQueueMutation, clearLeaveTimeout]);

    const acceptMatch = useCallback(() => {
        // Clear match found state and transition to game
        setFoundMatch(null);
        setQueueStatus(null);
        pendingLeaveRef.current = false;
        manualStateOverrideRef.current = false;
        clearLeaveTimeout();
    }, [clearLeaveTimeout]);

    // Clean up timeout on unmount
    useEffect(() => clearLeaveTimeout, [clearLeaveTimeout]);

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
        isWebSocketConnected: socketState.isConnected,
        isWebSocketConnecting: socketState.isConnecting,
        webSocketError: socketState.error,
    };
}

export type RankedQueue = ReturnType<typeof useRankedQueueState>;

export const RankedQueueContext = createContext<RankedQueue | null>(null);

/** The app's ranked queue, from RankedQueueProvider (components/game/RankedQueueProvider.tsx). */
export function useEnhancedRanked(): RankedQueue {
    const queue = useContext(RankedQueueContext);
    if (!queue) {
        throw new Error('useEnhancedRanked must be used inside RankedQueueProvider');
    }
    return queue;
}
