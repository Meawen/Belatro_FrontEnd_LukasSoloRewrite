import { useCallback, useEffect, useRef, useState } from 'react';
import { matchService } from '../services/matchService';
import { errorMessage } from '../utils/errorMessage';
import { endedHand } from '../components/board/model/hands';
import type { PublicGameView } from '../types/game';
import type { HandDTO } from '../types/match';

/** Retries for the hand just ended while the store lags behind the view (spec §5.3.3 Hand result). */
const RETRY_MS = 500;
const RETRIES = 3;

export interface MatchHands {
    /** The match's hands so far (GET /matches/{id}/structured-moves); null until the first answer. */
    hands: HandDTO[] | null;
    /** In HAND_COMPLETE or COMPLETED, the hand that just ended once the store has it whole; else null. */
    ended: HandDTO | null;
    loading: boolean;
    error: string | null;
    /** Fetch now (opening Bela Blok or the peek); a fetch in flight is followed by one more, never two at once. */
    refresh: () => void;
}

type Scores = { a: number; b: number };

/**
 * The structured moves of the game being played (spec §5.2): fetched on mount, on entering HAND_COMPLETE
 * (and again if its scores change there: a successful challenge), and on demand. For HAND_COMPLETE it
 * expects the hand just ended and retries up to 3 × 500 ms until the store has it whole.
 */
export function useMatchHands(gameId: string, view: PublicGameView | null): MatchHands {
    const [hands, setHands] = useState<HandDTO[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inFlight = useRef(false);
    // a request made while one was in flight: undefined = none; null = no expectation
    const queued = useRef<Scores | null | undefined>(undefined);
    const retryTimer = useRef<number | null>(null);
    const alive = useRef(true);

    const load = useCallback((expect: Scores | null, attempt: number) => {
        if (inFlight.current) {
            queued.current = expect ?? queued.current ?? null;
            return;
        }
        inFlight.current = true;
        setLoading(true);
        matchService.getStructuredMoves(gameId).then(
            (answer) => {
                if (!alive.current) return;
                setHands(answer);
                setError(null);
                if (expect && !endedHand(answer, expect) && attempt < RETRIES) {
                    retryTimer.current = window.setTimeout(() => load(expect, attempt + 1), RETRY_MS);
                }
            },
            (e: unknown) => {
                if (alive.current) setError(errorMessage(e, "Couldn't load the hands"));
            },
        ).finally(() => {
            inFlight.current = false;
            if (!alive.current) return;
            setLoading(false);
            const next = queued.current;
            if (next !== undefined) {
                queued.current = undefined;
                load(next, 0);
            }
        });
    }, [gameId]);

    useEffect(() => {
        alive.current = true;
        load(null, 0);
        return () => {
            alive.current = false;
            if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
        };
    }, [load]);

    const phase = view?.gameState ?? null;
    const a = view?.teamAScore ?? 0;
    const b = view?.teamBScore ?? 0;
    const lastAsked = useRef<string | null>(null);
    useEffect(() => {
        const key = phase === 'HAND_COMPLETE' ? `${a}:${b}` : null;
        if (key !== null && key !== lastAsked.current) load({ a, b }, 0);
        lastAsked.current = key;
    }, [phase, a, b, load]);

    const refresh = useCallback(() => load(null, 0), [load]);
    const ended = phase === 'HAND_COMPLETE' || phase === 'COMPLETED' ? endedHand(hands, { a, b }) : null;
    return { hands, ended, loading, error, refresh };
}
