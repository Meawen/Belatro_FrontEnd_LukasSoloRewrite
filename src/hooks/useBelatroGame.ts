import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameWebSocket } from './useGameWebSocket';
import type { Boja, GameCard, GamePhase, PrivateGameView, PublicGameView } from '../types/game';

/** How long a page waits for its snapshot before asking again with /refresh (R-35). */
const SNAPSHOT_WAIT_MS = 3000;
/** /refresh requests per connection when the snapshot subscription brought nothing (R-35). */
const MAX_REFRESHES = 3;

/** Shown when a move could not be sent because the socket is down (R-30). */
const NOT_SENT_MESSAGE = 'Not sent — reconnecting';

export function useBelatroGame(gameId: string, onDisconnect?: () => void) {
    const [publicView, setPublicView] = useState<PublicGameView | null>(null);
    const [privateView, setPrivateView] = useState<PrivateGameView | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [snapshotPending, setSnapshotPending] = useState(true);
    const [refreshesSent, setRefreshesSent] = useState(0);
    // R-35: the game is gone or not this player's; the page shows a way back and sends nothing more
    const [notAvailable, setNotAvailable] = useState(false);
    // The newest phase, also between a frame and the render it causes (see onGameDisconnect)
    const lastPhase = useRef<GamePhase | null>(null);

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
        onPublicGameUpdate: (view) => {
            lastPhase.current = view.gameState;
            setPublicView(view);
        },
        onPrivateGameUpdate: (view) => {
            lastPhase.current = view.publicPart.gameState;
            setPrivateView(view);
            setPublicView(view.publicPart);
            setSnapshotPending(false);
        },
        onGameError: (message) => {
            // R-24's answers for a game that is gone or not this player's. The error queue is per user,
            // not per game, so "Game not found" only ends a page that has no game of its own yet.
            if (message === `Not a participant in game ${gameId}`
                || (message === 'Game not found' && privateView === null)) {
                setNotAvailable(true);
                return;
            }
            setError(message);
        },
        // R-31: a cancelled game stays on its end screen, which says why. The backend sends DISCONNECT
        // right behind the CANCELLED view, often before React has rendered it, hence the ref.
        // DISCONNECT still moves on when no CANCELLED view came first (an older backend).
        onGameDisconnect: () => {
            if (lastPhase.current !== 'CANCELLED') onDisconnect?.();
        },
    });

    useEffect(() => {
        if (!gameId || notAvailable) return;
        subscribeToGame(gameId);
        return () => unsubscribeFromGame(gameId);
    }, [gameId, notAvailable, subscribeToGame, unsubscribeFromGame]);

    // After a disconnect the next state must come from a fresh snapshot, with a fresh allowance of refreshes.
    useEffect(() => {
        if (!isConnected) {
            setSnapshotPending(true);
            setRefreshesSent(0);
        }
    }, [isConnected]);

    // R-35: the server pushes state only when something happens, and a page usually subscribes after
    // the deal was pushed. subscribeToGame's SUBSCRIBE to /app/queue/games/{id} brings the snapshot on
    // every (re)connect. Only if nothing arrives within 3 s ask with /refresh, up to 3 times (its
    // answer comes on the private queue, whose SUBSCRIBE it can race on the server's inbound pool).
    // After that the game is gone or not this player's. The old 2-s loop asked forever.
    // A finished table needs no snapshot: its game expires a while after the end, so a late reconnect
    // hears nothing, and the result with Play again must stay on screen.
    const ended = publicView?.gameState === 'COMPLETED' || publicView?.gameState === 'CANCELLED';
    useEffect(() => {
        if (!gameId || !isConnected || !snapshotPending || notAvailable || ended) return;
        const timer = window.setTimeout(() => {
            if (refreshesSent >= MAX_REFRESHES) {
                setNotAvailable(true);
                return;
            }
            refreshGameState(gameId);
            setRefreshesSent((sent) => sent + 1);
        }, SNAPSHOT_WAIT_MS);
        return () => window.clearTimeout(timer);
    }, [gameId, isConnected, snapshotPending, notAvailable, ended, refreshesSent, refreshGameState]);

    // R-30: a move made while the socket is down is not lost silently
    const report = useCallback((sent: boolean) => setError(sent ? null : NOT_SENT_MESSAGE), []);

    const bidTrump = useCallback((trump: Boja) => {
        report(placeBid(gameId, false, trump));
    }, [gameId, placeBid, report]);

    const passBid = useCallback(() => {
        report(placeBid(gameId, true));
    }, [gameId, placeBid, report]);

    // R-32: declareBela comes from the table's bela prompt
    const play = useCallback((card: GameCard, declareBela = false) => {
        report(playCard(gameId, card, declareBela));
    }, [gameId, playCard, report]);

    const challenge = useCallback(() => {
        report(sendChallenge(gameId));
    }, [gameId, sendChallenge, report]);

    return {
        publicView,
        privateView,
        isConnected,
        connectionError,
        error,
        notAvailable,
        actions: { bidTrump, passBid, play, challenge },
    };
}
