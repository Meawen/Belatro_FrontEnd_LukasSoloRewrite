import { useEffect, useState } from 'react';
import { ApiError } from '../../services/api';
import { matchService } from '../../services/matchService';
import type { HandDTO, MatchDTO, MoveDTO } from '../../types/match';

export interface MatchDetailsData {
    /** GET /matches/{id}, once it has answered with a match. */
    match: MatchDTO | null;
    /** The match, or a found match's structured moves, are still on their way ("Loading match…"). */
    loading: boolean;
    /** The match is missing: a 404, or an answer without an id ("Match data is not available"). */
    notFound: boolean;
    /** The match failed to load for another reason; `retry` asks again. */
    failed: boolean;
    /** GET /matches/{id}/structured-moves, in order; null until they answer, and when they failed. */
    hands: HandDTO[] | null;
    /** Only the structured moves failed: "Couldn't load the hands", with `retryHands`. */
    handsFailed: boolean;
    /** `retryHands` is asking again. */
    handsLoading: boolean;
    /** GET /matches/{id}/moves, asked only when the match has no structured hands (the raw fallback). */
    moves: MoveDTO[] | null;
    retry: () => void;
    retryHands: () => void;
}

type MatchLoad = { status: 'loading' } | { status: 'found'; match: MatchDTO } | { status: 'missing' } | { status: 'failed' };
type HandsLoad = { status: 'loading' | 'retrying' | 'failed' } | { status: 'done'; hands: HandDTO[] };

/**
 * One match for its details page (spec §4.9): three existing routes, no new one. The match and its
 * structured moves are asked at once; the raw moves only when there are no structured hands. The page
 * mounts it per id (keyed), so nothing from another match lingers.
 */
export function useMatchDetails(id: string): MatchDetailsData {
    const [matchLoad, setMatchLoad] = useState<MatchLoad>({ status: 'loading' });
    const [handsLoad, setHandsLoad] = useState<HandsLoad>({ status: 'loading' });
    const [moves, setMoves] = useState<MoveDTO[] | null>(null);
    const [matchAttempt, setMatchAttempt] = useState(0);
    const [handsAttempt, setHandsAttempt] = useState(0);

    useEffect(() => {
        let current = true;
        matchService.getMatch(id).then(
            (match) => {
                if (current) setMatchLoad(match?.id ? { status: 'found', match } : { status: 'missing' });
            },
            (error: unknown) => {
                if (current) setMatchLoad({ status: error instanceof ApiError && error.status === 404 ? 'missing' : 'failed' });
            },
        );
        return () => {
            current = false;
        };
    }, [id, matchAttempt]);

    useEffect(() => {
        let current = true;
        matchService.getStructuredMoves(id).then(
            (answer) => {
                if (!current) return;
                const hands = Array.isArray(answer) ? answer : [];
                setHandsLoad({ status: 'done', hands });
                // the raw moves are only the fallback for a match without structured hands
                if (hands.length > 0) return;
                matchService.getMoves(id).then(
                    (list) => {
                        if (current) setMoves(Array.isArray(list) ? list : []);
                    },
                    () => {
                        // no fallback to show
                    },
                );
            },
            () => {
                if (current) setHandsLoad({ status: 'failed' });
            },
        );
        return () => {
            current = false;
        };
    }, [id, handsAttempt]);

    return {
        match: matchLoad.status === 'found' ? matchLoad.match : null,
        loading: matchLoad.status === 'loading' || (matchLoad.status === 'found' && handsLoad.status === 'loading'),
        notFound: matchLoad.status === 'missing',
        failed: matchLoad.status === 'failed',
        hands: handsLoad.status === 'done' ? handsLoad.hands : null,
        handsFailed: handsLoad.status === 'failed',
        handsLoading: handsLoad.status === 'retrying',
        moves,
        retry: () => {
            setMatchLoad({ status: 'loading' });
            setMatchAttempt((attempt) => attempt + 1);
        },
        retryHands: () => {
            setHandsLoad({ status: 'retrying' });
            setHandsAttempt((attempt) => attempt + 1);
        },
    };
}
