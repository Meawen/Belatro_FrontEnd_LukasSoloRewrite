import { useCallback, useEffect, useState } from 'react';
import { useGameWebSocket } from './useGameWebSocket';
import type { Boja, GameCard, PrivateGameView, PublicGameView } from '../types/game';

/** How often a page that has no state yet asks the server again. */
const SNAPSHOT_RETRY_MS = 2000;

export function useBelatroGame(gameId: string, onDisconnect?: () => void) {
    const [publicView, setPublicView] = useState<PublicGameView | null>(null);
    const [privateView, setPrivateView] = useState<PrivateGameView | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [snapshotPending, setSnapshotPending] = useState(true);

    const {
        isConnected,
        connectionError,
        subscribeToGame,
        unsubscribeFromGame,
        refreshGameState,
        placeBid,
        playCard,
        challenge: sendChallenge,
    } = useGameWebSocket({
        onPublicGameUpdate: setPublicView,
        onPrivateGameUpdate: (view) => {
            setPrivateView(view);
            setPublicView(view.publicPart);
            setSnapshotPending(false);
        },
        onGameError: setError,
        onGameDisconnect: onDisconnect,
    });

    useEffect(() => {
        if (!gameId) return;
        subscribeToGame(gameId);
        return () => unsubscribeFromGame(gameId);
    }, [gameId, subscribeToGame, unsubscribeFromGame]);

    // After a disconnect the next state must come from a fresh snapshot.
    useEffect(() => {
        if (!isConnected) setSnapshotPending(true);
    }, [isConnected]);

    // The server pushes state only when something happens, and a page usually
    // subscribes after the deal was pushed. Ask for a snapshot and keep asking:
    // the SUBSCRIBE and this SEND are not ordered on the server's inbound thread
    // pool, so the first answer can race past the new subscription.
    useEffect(() => {
        if (!gameId || !isConnected || !snapshotPending) return;
        refreshGameState(gameId);
        const timer = window.setInterval(() => refreshGameState(gameId), SNAPSHOT_RETRY_MS);
        return () => window.clearInterval(timer);
    }, [gameId, isConnected, snapshotPending, refreshGameState]);

    const bidTrump = useCallback((trump: Boja) => {
        setError(null);
        placeBid(gameId, false, trump);
    }, [gameId, placeBid]);

    const passBid = useCallback(() => {
        setError(null);
        placeBid(gameId, true);
    }, [gameId, placeBid]);

    const play = useCallback((card: GameCard) => {
        setError(null);
        playCard(gameId, card, false);
    }, [gameId, playCard]);

    const challenge = useCallback(() => {
        setError(null);
        sendChallenge(gameId);
    }, [gameId, sendChallenge]);

    return {
        publicView,
        privateView,
        isConnected,
        connectionError,
        error,
        actions: { bidTrump, passBid, play, challenge },
    };
}
