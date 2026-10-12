import { RANK_LABEL, SUIT_LABEL, declaredPoints } from '../../game/gameView';
import type { Rank, ZvanjaSeatView, ZvanjaView } from '../../../types/game';

/** The moment's length before playOpensAt (the server's default pause, game.declaration-pause-ms). */
export const MOMENT_MS = 5000;
/** Between two seats speaking. */
export const SAY_GAP_MS = 600;
/** From T0: the heights step when values tie, else the winner step (after the fourth seat speaks). */
const HEIGHTS_MS = 4 * SAY_GAP_MS + 200;
/** From T0: the winner step after a heights step. */
const WINNER_AFTER_HEIGHTS_MS = 3400;

export type MomentStep = 'saying' | 'heights' | 'winner' | 'closed';

export interface Moment {
    step: MomentStep;
    /** Per seat id, in the view's seat order: what its bubble says now, or null while it hasn't spoken (and every bubble once closed). */
    bubbles: Record<string, string | null>;
    /** The winner line once named, else null (null once closed). */
    line: string | null;
    /** The whole moment in words, for the live region: always complete, whatever the step. */
    srLine: string;
    /** The winners' declared cards show (closed). */
    showCards: boolean;
}

/** A four's rank in the plural ("four Asovi"); sevens and eights never make a four that scores. */
const FOUR_LABEL: Partial<Record<Rank, string>> = {
    DECKO: 'Decki', DEVETKA: 'Devetke', AS: 'Asovi', DESETKA: 'Desetke', KRALJ: 'Kralji', BABA: 'Babe',
};

/**
 * "up to Baba" (a run) or "four Asovi" (a four) for a seat tied at the top value; null for any other seat. The
 * moment's bubbles and the hand history's line (gameplay rules §7) say it the same way.
 */
export function heightText(seat: ZvanjaSeatView): string | null {
    if (seat.height === null) return null;
    return seat.kind === 'FOUR' ? `four ${FOUR_LABEL[seat.height] ?? RANK_LABEL[seat.height]}` : `up to ${RANK_LABEL[seat.height]}`;
}

/**
 * "Team B scores 70", with why when nobody won by value: "ivo's is higher", "ivo's four beats the run" or
 * "ivo was first" ("Yours", "Your", "You were" for me). The winner: the first winning seat holding the top value.
 */
function winnerLine(zvanja: ZvanjaView, me: string): string {
    const scores = `Team ${zvanja.winnerTeam} scores ${zvanja.total}`;
    const top = Math.max(...zvanja.seats.map((seat) => seat.said ?? 0));
    const winner = zvanja.seats.find((seat) => seat.declarations.length > 0 && seat.said === top)?.playerId;
    if (winner === undefined) return scores;
    const mine = winner === me;
    switch (zvanja.decidedBy) {
        case 'HEIGHT': return `${mine ? 'Yours' : `${winner}'s`} is higher: ${scores}`;
        case 'FOUR': return `${mine ? 'Your' : `${winner}'s`} four beats the run: ${scores}`;
        case 'ORDER': return `${mine ? 'You were' : `${winner} was`} first: ${scores}`;
        default: return scores;
    }
}

/** "Declarations: ivo 20 up to Baba, mara nothing, …. ivo was first: Team B scores 20." */
function srLineOf(zvanja: ZvanjaView, me: string, line: string): string {
    const said = zvanja.seats.map((seat) => {
        const name = seat.playerId === me ? 'you' : seat.playerId;
        if (seat.said === null) return `${name} nothing`;
        const height = heightText(seat);
        return `${name} ${seat.said}${height ? ` ${height}` : ''}`;
    });
    return `Declarations: ${said.join(', ')}. ${line}.`;
}

/**
 * The moment at server time `now` (Date.now() + the model's skew). Null when there is nothing to say:
 * no zvanja, no playOpensAt, or a belot (belotLine covers it). `snapshot`: the board jumped to this state
 * (a reconnect), so a moment still running shows its end state.
 */
export function momentAt(zvanja: ZvanjaView | null, me: string, now: number, snapshot = false): Moment | null {
    if (!zvanja || zvanja.playOpensAt === null || zvanja.belot || zvanja.winnerTeam === null) return null;
    const t0 = zvanja.playOpensAt - MOMENT_MS;
    const heights = zvanja.seats.some((seat) => seat.height !== null);
    const winnerAt = t0 + (heights ? WINNER_AFTER_HEIGHTS_MS : HEIGHTS_MS);
    const step: MomentStep = now >= zvanja.playOpensAt ? 'closed'
        : snapshot || now >= winnerAt ? 'winner'
            : heights && now >= t0 + HEIGHTS_MS ? 'heights'
                : 'saying';
    const bubble = (seat: ZvanjaSeatView, index: number): string | null => {
        if (step === 'closed' || (step === 'saying' && now < t0 + index * SAY_GAP_MS)) return null;
        const said = seat.said === null ? '–' : String(seat.said);
        if (step === 'saying') return said;
        if (step === 'winner' && seat.declarations.length > 1) return declaredPoints(seat);
        const height = heightText(seat);
        return height ? `${said} · ${height}` : said;
    };
    const line = winnerLine(zvanja, me);
    return {
        step,
        bubbles: Object.fromEntries(zvanja.seats.map((seat, index) => [seat.playerId, bubble(seat, index)])),
        line: step === 'winner' ? line : null,
        srLine: srLineOf(zvanja, me, line),
        showCards: step === 'closed',
    };
}

/** Each winning seat's chip for the rest of the hand, e.g. { ivo: 'Zvanja 50 + 20' }; {} when nobody won. */
export function summaryChips(zvanja: ZvanjaView | null): Record<string, string> {
    const winners = (zvanja?.seats ?? []).filter((seat) => seat.declarations.length > 0);
    return Object.fromEntries(winners.map((seat) => [seat.playerId, `Zvanja ${declaredPoints(seat)}`]));
}

/** "Belot! Ivo holds all eight Pik" ("Belot! You hold all eight Pik" for `me`), or null without a belot. */
export function belotLine(zvanja: ZvanjaView | null, me: string): string | null {
    if (!zvanja?.belot) return null;
    const { playerId, suit } = zvanja.belot;
    return `Belot! ${playerId === me ? 'You hold' : `${playerId} holds`} all eight ${SUIT_LABEL[suit]}`;
}

/** The end sheet waits this long after a belot is said live; a tap or a snapshot opens it at once. */
export const BELOT_HOLD_MS = 4000;

/**
 * Which hand's moment the board shows, or null when there is none: play waits for `playOpensAt` (the model's,
 * null outside PLAYING), or a belot ended the game. A new key starts the board's moment afresh (not skipped).
 */
export function momentKey(zvanja: ZvanjaView | null, playOpensAt: number | null): string | null {
    if (zvanja?.belot) return `belot:${zvanja.belot.playerId}:${zvanja.belot.suit}`;
    return playOpensAt === null ? null : `opens:${playOpensAt}`;
}

/**
 * The one polite line for the live region when the board's moment first shows at server time `now`: the belot
 * line, or the moment's srLine while it runs; null once closed (a snapshot after the wait says nothing).
 */
export function momentSrLine(zvanja: ZvanjaView | null, me: string, now: number, snapshot: boolean): string | null {
    const belot = belotLine(zvanja, me);
    if (belot) return belot;
    const moment = momentAt(zvanja, me, now, snapshot);
    return moment && moment.step !== 'closed' ? moment.srLine : null;
}
