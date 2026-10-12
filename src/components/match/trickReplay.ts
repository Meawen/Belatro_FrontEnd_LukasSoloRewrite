import { handTricks, handTrump } from '../board/model/hands';
import type { CardId } from '../board/model/rules';
import type { GameCard } from '../../types/game';
import type { HandDTO, MatchDTO } from '../../types/match';

export type Team = 'A' | 'B';

/** A player's team in this match, by username (moves and calls name players by username). */
export function teamOfPlayer(match: Pick<MatchDTO, 'teamA' | 'teamB'>, username: string | null | undefined): Team | null {
    if (!username) return null;
    if (match.teamA?.some((player) => player.username === username)) return 'A';
    if (match.teamB?.some((player) => player.username === username)) return 'B';
    return null;
}

/** One player column of the trick replay. */
export interface ReplayColumn {
    player: string;
    team: Team | null;
    me: boolean;
}

function startingWith(order: string[], me: string | null): string[] {
    const at = me ? order.indexOf(me) : -1;
    return at > 0 ? [...order.slice(at), ...order.slice(0, at)] : order;
}

/**
 * The four player columns of a hand's trick replay (spec §4.9 item 6; D-31), in seat order starting
 * with me: the cyclic play order of the hand's first complete trick, rotated to me; without a complete
 * trick A1, B1, A2, B2. In a match I'm not in, the order stays as it is.
 */
export function replayColumns(hand: HandDTO, match: Pick<MatchDTO, 'teamA' | 'teamB'>, me: string | null): ReplayColumn[] {
    const full = handTricks(hand).find((trick) => trick.plays.length === 4);
    const seats = full
        ? full.plays.map((play) => play.playerId)
        : [match.teamA?.[0], match.teamB?.[0], match.teamA?.[1], match.teamB?.[1]].flatMap((player) => (player?.username ? [player.username] : []));
    return startingWith(seats, me).map((player) => ({ player, team: teamOfPlayer(match, player), me: player === me }));
}

/** A card in its player's column. */
export interface ReplayCell {
    player: string;
    card: GameCard;
    id: CardId;
    /** The order it was played in the trick, 1–4. */
    order: number;
    /** It won the trick: the server's winnerId, else the game's rule (handTricks). */
    won: boolean;
    /** Of the hand's trump suit. */
    trump: boolean;
    /** Only `legal === false` (R-16: null means "not known yet"). */
    illegal: boolean;
}

export interface ReplayTrick {
    trickNo: number;
    /** "({n} cards)": the moves stored for it. */
    cards: number;
    /** Under four cards: the hand ended first ("PARTIAL TRICK (HAND ENDED)"). */
    partial: boolean;
    /** One per column; null where that player has no card in this trick. */
    cells: (ReplayCell | null)[];
}

/**
 * A hand's tricks laid out in its columns (spec §4.9 item 6): each card with its play order, whether it
 * won the trick (the server's winnerId once §6.3 is in; with none, the game's rule from the four cards and
 * the hand's trump, as Trick.isCardWinning), whether it is a trump, and whether it was a foul.
 */
export function replayTricks(hand: HandDTO, columns: readonly ReplayColumn[]): ReplayTrick[] {
    const trump = handTrump(hand);
    const stored = hand.tricks ?? [];
    return handTricks(hand).map((trick, index) => {
        const moves = stored[index]?.moves ?? [];
        const cells = columns.map(({ player }) => {
            const at = trick.plays.findIndex((play) => play.playerId === player);
            if (at < 0) return null;
            const play = trick.plays[at];
            return {
                player,
                card: play.card,
                id: play.id,
                order: at + 1,
                won: trick.winnerId === player,
                trump: trump !== null && play.card.boja === trump,
                illegal: moves.some((move) => move.player === player && move.legal === false),
            };
        });
        return { trickNo: trick.trickNo, cards: moves.length, partial: moves.length < 4, cells };
    });
}
