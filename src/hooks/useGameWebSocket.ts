// src/hooks/useGameWebSocket.ts
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { gameSocket } from '../services/gameSocket';
import type { MatchDTO } from '../types/match';
import type { Boja, GameCard, PrivateGameView, PublicGameView, QueueStatusDTO, RematchFrame } from '../types/game';

interface GameWebSocketOptions {
    onQueueStatusUpdate?: (status: QueueStatusDTO) => void;
    onMatchFound?: (match: MatchDTO) => void;
    onPublicGameUpdate?: (view: PublicGameView) => void;
    onPrivateGameUpdate?: (view: PrivateGameView) => void;
    /**
     * Snapshot tagging (UI redesign spec §5.3.1): when given, the /app/queue/games/{id} answer and the
     * first private frame after subscribing or after a lost connection come here instead of
     * onPrivateGameUpdate. Without it, they go to onPrivateGameUpdate as before.
     */
    onGameSnapshot?: (view: PrivateGameView) => void;
    onGameError?: (message: string) => void;
    onGameDisconnect?: () => void;
    onRematchUpdate?: (frame: RematchFrame) => void;
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
    // The next private frame is a snapshot: set on subscribing and whenever the connection is lost
    const freshRef = useRef(false);

    useEffect(() => gameSocket.onStateChange(() => {
        if (!gameSocket.getState().isConnected) freshRef.current = true;
    }), []);

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
        freshRef.current = true;
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
                const view: PrivateGameView = JSON.parse(body);
                const { onGameSnapshot, onPrivateGameUpdate } = optionsRef.current;
                if (freshRef.current && onGameSnapshot) {
                    freshRef.current = false;
                    onGameSnapshot(view);
                } else {
                    onPrivateGameUpdate?.(view);
                }
            } catch (e) {
                console.error('private game parse failed', e);
            }
        });
        // Rejected moves (InvalidMoveException) come back as a plain string.
        track(`game-${gameId}-errors`, '/user/queue/errors', (body) => {
            optionsRef.current.onGameError?.(body.replace(/^"|"$/g, ''));
        });
        // R-35: a SUBSCRIBE to this /app destination is answered once, on this subscription, with the
        // caller's PrivateGameView (GameSocketController's @SubscribeMapping("/queue/games/{gameId}")),
        // and with nothing for a game that is gone or not theirs. gameSocket re-sends it after every
        // reconnect, so the table re-snapshots then too (R-30).
        track(`game-${gameId}-snapshot`, `/app/queue/games/${gameId}`, (body) => {
            try {
                const view: PrivateGameView = JSON.parse(body);
                const { onGameSnapshot, onPrivateGameUpdate } = optionsRef.current;
                freshRef.current = false;
                (onGameSnapshot ?? onPrivateGameUpdate)?.(view);
            } catch (e) {
                console.error('game snapshot parse failed', e);
            }
        });
    }, [track]);

    const unsubscribeFromGame = useCallback((gameId: string) => {
        untrack(`game-${gameId}-public`);
        untrack(`game-${gameId}-private`);
        untrack(`game-${gameId}-errors`);
        untrack(`game-${gameId}-snapshot`);
    }, [untrack]);

    /* ---------- Rematch (R-45): RematchSocketController ---------- */
    const subscribeToRematch = useCallback((gameId: string) => {
        track(`rematch-${gameId}`, `/topic/games/${gameId}/rematch`, (body) => {
            try {
                optionsRef.current.onRematchUpdate?.(JSON.parse(body));
            } catch (e) {
                console.warn('rematch parse failed', e);
            }
        });
    }, [track]);

    const unsubscribeFromRematch = useCallback((gameId: string) => {
        untrack(`rematch-${gameId}`);
    }, [untrack]);

    const voteRematch = useCallback((gameId: string): boolean =>
        gameSocket.publish(`/app/games/${gameId}/rematch/vote`, {}), []);

    const declineRematch = useCallback((gameId: string): boolean =>
        gameSocket.publish(`/app/games/${gameId}/rematch/decline`, {}), []);

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

        // rematch (R-45)
        subscribeToRematch,
        unsubscribeFromRematch,
        voteRematch,
        declineRematch,

        // actions
        playCard,
        placeBid,
        challenge,
        refreshGameState,
        cancelMatch,
    };
}
