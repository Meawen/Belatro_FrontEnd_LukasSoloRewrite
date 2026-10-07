// src/hooks/useGameWebSocket.ts
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { gameSocket } from '../services/gameSocket';
import type { MatchDTO } from '../types/match';
import type { Boja, GameCard, PrivateGameView, PublicGameView, QueueStatusDTO } from '../types/game';

/** Display card of the mock boards in src/MockComponents (UI names such as 'Herc'/'As'), not the wire card. */
export interface Card {
    suit: string;
    rank: string;
}

interface GameWebSocketOptions {
    onQueueStatusUpdate?: (status: QueueStatusDTO) => void;
    onMatchFound?: (match: MatchDTO) => void;
    onPublicGameUpdate?: (view: PublicGameView) => void;
    onPrivateGameUpdate?: (view: PrivateGameView) => void;
    onGameError?: (message: string) => void;
    onGameDisconnect?: () => void;
}

/**
 * Per-component access to the tab's single STOMP connection (services/gameSocket).
 * Holds the connection while mounted and drops this component's subscriptions on unmount.
 */
export function useGameWebSocket(options: GameWebSocketOptions = {}) {
    const state = useSyncExternalStore(gameSocket.onStateChange, gameSocket.getState);
    const optionsRef = useRef(options);
    optionsRef.current = options;
    const unsubscribersRef = useRef(new Map<string, () => void>());

    useEffect(() => {
        const release = gameSocket.acquire();
        const unsubscribers = unsubscribersRef.current;
        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
            unsubscribers.clear();
            release();
        };
    }, []);

    const track = useCallback((key: string, destination: string, onBody: (body: string) => void) => {
        unsubscribersRef.current.get(key)?.();
        unsubscribersRef.current.set(key, gameSocket.subscribe(destination, onBody));
    }, []);

    const untrack = useCallback((key: string) => {
        unsubscribersRef.current.get(key)?.();
        unsubscribersRef.current.delete(key);
    }, []);

    /* ---------- Ranked queue channels ---------- */
    const subscribeToRankedQueue = useCallback(() => {
        track('queueStatus', '/user/queue/ranked/status', (body) => {
            try {
                optionsRef.current.onQueueStatusUpdate?.(JSON.parse(body));
            } catch (e) {
                console.warn('queue status parse failed', e);
            }
        });
        track('matchFound', '/user/queue/match-found', (body) => {
            try {
                optionsRef.current.onMatchFound?.(JSON.parse(body));
            } catch (e) {
                console.warn('match-found parse failed', e);
            }
        });
    }, [track]);

    const unsubscribeFromRankedQueue = useCallback(() => {
        untrack('queueStatus');
        untrack('matchFound');
    }, [untrack]);

    /* ---------- Game channels ---------- */
    const subscribeToGame = useCallback((gameId: string) => {
        track(`game-${gameId}-public`, `/topic/games/${gameId}`, (body) => {
            // On cancel the backend sends this bare string on the JSON topic.
            if (body === 'DISCONNECT') {
                optionsRef.current.onGameDisconnect?.();
                return;
            }
            try {
                optionsRef.current.onPublicGameUpdate?.(JSON.parse(body));
            } catch (e) {
                console.error('public game parse failed', e);
            }
        });
        track(`game-${gameId}-private`, `/user/queue/games/${gameId}`, (body) => {
            try {
                optionsRef.current.onPrivateGameUpdate?.(JSON.parse(body));
            } catch (e) {
                console.error('private game parse failed', e);
            }
        });
        // Rejected moves (InvalidMoveException) come back as a plain string.
        track(`game-${gameId}-errors`, '/user/queue/errors', (body) => {
            optionsRef.current.onGameError?.(body.replace(/^"|"$/g, ''));
        });
    }, [track]);

    const unsubscribeFromGame = useCallback((gameId: string) => {
        untrack(`game-${gameId}-public`);
        untrack(`game-${gameId}-private`);
        untrack(`game-${gameId}-errors`);
    }, [untrack]);

    /* ---------- Actions: backend PlayCardMsg / BidMsg; the actor is the JWT principal ---------- */
    // Moves say whether they went out (R-30): false while the socket is down
    const playCard = useCallback((gameId: string, card: GameCard, declareBela: boolean): boolean =>
        gameSocket.publish(`/app/games/${gameId}/play`, { card, declareBela }), []);

    const placeBid = useCallback((gameId: string, pass: boolean, trump?: Boja): boolean =>
        gameSocket.publish(`/app/games/${gameId}/bid`, { pass, trump: trump ?? null }), []);

    const challenge = useCallback((gameId: string): boolean =>
        gameSocket.publish(`/app/games/${gameId}/challenge`, {}), []);

    const refreshGameState = useCallback((gameId: string) => {
        gameSocket.publish(`/app/games/${gameId}/refresh`, {});
    }, []);

    const cancelMatch = useCallback((gameId: string) => {
        gameSocket.publish(`/app/games/${gameId}/cancel`, {});
    }, []);

    return {
        // status
        isConnected: state.isConnected,
        isConnecting: state.isConnecting,
        connectionError: state.error,

        // ranked queue
        subscribeToRankedQueue,
        unsubscribeFromRankedQueue,

        // game
        subscribeToGame,
        unsubscribeFromGame,

        // actions
        playCard,
        placeBid,
        challenge,
        refreshGameState,
        cancelMatch,
    };
}
