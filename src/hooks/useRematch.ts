import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameWebSocket } from './useGameWebSocket';
import type { RematchFrame } from '../types/game';

/** How long the game-over screen waits for a rematch to start; the server keeps votes 2 minutes. */
const REMATCH_WINDOW_MS = 2 * 60 * 1000;

/** The game-over screen's rematch (R-45), for GameTable's `rematch` prop. */
export interface RematchState {
    /** How many of the four want a rematch, from the latest VOTE frame. */
    votes: number;
    /** Who declined: there will be no rematch. */
    cancelledBy: string | null;
    /** Two minutes passed without a START. */
    expired: boolean;
    /** Vote for a rematch (Play again). */
    playAgain: () => void;
    /** Decline the rematch for everyone, then go back to the lobbies (Leave). */
    leave: () => void;
}

/**
 * Rematch over /topic/games/{id}/rematch (RematchSocketController). `offered` is true once the game is
 * COMPLETED, or a ranked forfeit ended it (gameView.rematchOffered). When all four have voted, the
 * server starts a new casual game and every seat gets START with its id.
 */
export function useRematch(gameId: string, offered: boolean): RematchState {
    const navigate = useNavigate();
    const [votes, setVotes] = useState(0);
    const [cancelledBy, setCancelledBy] = useState<string | null>(null);
    const [expired, setExpired] = useState(false);

    const { subscribeToRematch, unsubscribeFromRematch, voteRematch, declineRematch } = useGameWebSocket({
        onRematchUpdate: (frame: RematchFrame) => {
            if (frame.type === 'VOTE') setVotes(frame.accepted.length);
            else if (frame.type === 'START') navigate(`/game/${frame.newGameId}`, { replace: true });
            else if (frame.type === 'CANCEL') setCancelledBy(frame.by);
        },
    });

    useEffect(() => {
        if (!offered) return;
        subscribeToRematch(gameId);
        return () => unsubscribeFromRematch(gameId);
    }, [gameId, offered, subscribeToRematch, unsubscribeFromRematch]);

    // Counted from the moment the game-over screen appears; the server's window is never shorter
    useEffect(() => {
        if (!offered) return;
        const timer = window.setTimeout(() => setExpired(true), REMATCH_WINDOW_MS);
        return () => window.clearTimeout(timer);
    }, [offered]);

    const playAgain = useCallback(() => {
        voteRematch(gameId);
    }, [gameId, voteRematch]);

    const leave = useCallback(() => {
        declineRematch(gameId);
        navigate('/lobbies');
    }, [gameId, declineRematch, navigate]);

    return { votes, cancelledBy, expired, playAgain, leave };
}
