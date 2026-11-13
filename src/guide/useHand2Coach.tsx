import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cardId } from '../components/board/model/rules';
import { FoulWarning } from '../components/guide/FoulWarning';
import { Hand2Panel } from '../components/guide/Hand2Panel';
import { firstHandOver, gameOver, legalIds, mustCall, whyMarked, type Why } from './hand2';
import { useT } from '../i18n/t';
import type { Coach, CoachMove } from '../components/board/coach';
import type { BoardState } from '../components/board/model/accept';
import type { GameCard, PrivateGameView } from '../types/game';

export interface Hand2Coach {
    /** The board's coach while hand 2's guide runs; undefined outside guide mode, after the first hand, and in a finished game. */
    coach: Coach | undefined;
    /** The foul warning (a Sheet; it portals), to render beside the Board. */
    warning: ReactNode;
}

/** The warning while it is open: the card, the rule it breaks, and the private frame it was asked on. */
interface Open {
    card: GameCard;
    why: Why | null;
    view: PrivateGameView | null;
}

/**
 * Škola bele's hand 2 (open beta §7.3) over a real bot game: the server's legal cards marked, the panel with the trump
 * tip and the hint, and a warning before a card outside the marks that still lets it go (D-24: the real game does). It
 * never refuses. `confirm` exists only while the legal cards are known, so bids, passes and Challenge, and every move
 * against an older backend, leave at once. `state`: the accepted state in guide mode, null outside it.
 */
export function useHand2Coach(state: BoardState | null, options: { guest: boolean; onExit: () => void }): Hand2Coach {
    const t = useT();
    const pub = state?.publicView ?? null;
    const priv = state?.privateView ?? null;
    const active = pub !== null && !gameOver(pub) && !firstHandOver(pub);

    // The warning settles its confirm exactly once, by whichever way it closes: the board ignores every press while a
    // confirm is open, so one that never settles would freeze the rest of the game
    const [open, setOpen] = useState<Open | null>(null);
    const answer = useRef<((yes: boolean) => void) | null>(null);
    const settle = useCallback((yes: boolean) => {
        const resolve = answer.current;
        answer.current = null;
        setOpen(null);
        resolve?.(yes);
    }, []);
    // a newer private frame (the turn passed, the timer played for me, a reconnect's snapshot) or the guide's end closes
    // it unanswered: the board would send a late yes on the newest state, perhaps into another trick
    const shown = state?.privateView;
    useEffect(() => {
        if (open && (!active || shown !== open.view)) settle(false);
    }, [open, active, shown, settle]);
    // the page goes while it is open
    useEffect(() => () => settle(false), [settle]);

    const warning = state === null ? null : (
        <FoulWarning open={open !== null} why={open?.why ?? null} onPlay={() => settle(true)} onChoose={() => settle(false)} />
    );
    if (!active) return { coach: undefined, warning };

    const legal = legalIds(priv);
    const phase = pub.gameState === 'BIDDING' && priv?.yourTurn ? 'bid' : legal ? 'play' : pub.gameState === 'HAND_COMPLETE' ? 'done' : 'wait';
    const confirm = (move: CoachMove): Promise<boolean> => {
        if (move.kind !== 'play' || legal!.includes(cardId(move.card))) return Promise.resolve(true);
        return new Promise<boolean>((resolve) => {
            // one at a time (the board asks so); an older one would never settle otherwise
            answer.current?.(false);
            answer.current = resolve;
            setOpen({ card: move.card, why: whyMarked(priv), view: priv });
        });
    };
    const coach: Coach = {
        // warned, never blocked (D-24)
        allowed: () => true,
        marked: legal ?? undefined,
        confirm: legal ? confirm : undefined,
        panel: (
            <Hand2Panel phase={phase} mustCall={mustCall(priv)} why={whyMarked(priv)} turn={pub.stateVersion ?? state!.receivedAt}
                exitLine={options.guest ? t.guide.exit.start : t.guide.exit.home} onExit={options.onExit} />
        ),
    };
    return { coach, warning };
}
