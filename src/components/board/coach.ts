import type { ReactNode } from 'react';
import type { Move } from './model/input';
import type { CardId } from './model/rules';
import type { Boja, GameCard } from '../../types/game';

/** A move about to leave the board, as the coach sees it (open beta §7.2, §7.3). `bela`: "Play + Bela" in the bela prompt. */
export type CoachMove =
    | { kind: 'play'; card: GameCard; bela: boolean }
    | { kind: 'bid'; trump: Boja }
    | { kind: 'pass' }
    | { kind: 'challenge' };

/** Škola bele's hold on the board (open beta §7.2 hand 1 on rails, §7.3 hand 2's hints). Without one, a real game. */
export interface Coach {
    /** May this move go? Pure: the board may ask more than once per press (a bela card asks for both answers). */
    allowed(move: CoachMove): boolean;
    /** My hand cards to mark, by id ("HERC-AS"); an id not in my hand marks nothing. */
    marked?: CardId[];
    /** Asked after `allowed`, before the move goes: false (or a rejection) sends nothing. Must settle; one at a time. */
    confirm?(move: CoachMove): Promise<boolean>;
    /** A refused move: nothing was sent; the coach says why. */
    onRefused?(move: CoachMove): void;
    /** Shown in the board's coach slot, under the HUD. */
    panel?: ReactNode;
    /** The game menu's way out (Škola bele's Izađi, open beta §7.1): its button, the line under it, what it does. Without it, "Back to home" to Doma. */
    leave?: { label: string; note: string; onLeave: () => void };
}

/** The board's move (input.ts) as the coach sees it. */
export function coachMove(move: Move): CoachMove {
    if (move.kind === 'play') return { kind: 'play', card: move.card, bela: move.declareBela };
    return move.trump ? { kind: 'bid', trump: move.trump } : { kind: 'pass' };
}
