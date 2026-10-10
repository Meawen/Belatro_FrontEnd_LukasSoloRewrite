import { cardId, playOrder, trickWinner, type CardId } from './rules';
import { teamOf } from '../../game/gameView';
import type { GameCard, PublicGameView } from '../../../types/game';

export type Team = 'A' | 'B';

/** Where a seat sits on screen: me at the bottom, then counter-clockwise (spec §5.3.2). */
export type SeatPosition = 'me' | 'right' | 'partner' | 'left';

export interface TrickPlayModel {
    id: CardId;
    card: GameCard;
    playerId: string;
    position: SeatPosition | null;
    /** 0 for the lead … 3. */
    order: number;
}

export interface TrickModel {
    leadPlayerId: string;
    /** In play order. */
    plays: TrickPlayModel[];
    /** All four cards are down. */
    complete: boolean;
    /** Set only on a complete trick. */
    winnerId: string | null;
    winnerTeam: Team | null;
}

function toPlays(
    leadPlayerId: string,
    plays: Record<string, GameCard>,
    turnOrder: readonly string[],
    positions: Readonly<Record<string, SeatPosition>>,
): TrickPlayModel[] {
    const ids = playOrder(turnOrder, leadPlayerId).filter((id) => plays[id]);
    Object.keys(plays).forEach((id) => {
        if (!ids.includes(id)) ids.push(id);
    });
    return ids.map((playerId, order) => ({
        id: cardId(plays[playerId]), card: plays[playerId], playerId, position: positions[playerId] ?? null, order,
    }));
}

const sameCards = (plays: TrickPlayModel[], other: Record<string, GameCard>) =>
    plays.every((play) => other[play.playerId] !== undefined && cardId(other[play.playerId]) === play.id);

/**
 * The trick on the table (spec §5.3.3): `currentTrick.plays` by seat, in the cyclic turn order from
 * `leadPlayerId`; hidden while bidding (the view still carries the last hand's trick then). The winner
 * of a complete trick: `lastTrick.winnerId` (§6.1), else the play holding `winningCard`, else the rule.
 */
export function displayedTrick(view: PublicGameView, positions: Readonly<Record<string, SeatPosition>>): TrickModel | null {
    const trick = view.currentTrick;
    if (view.gameState === 'BIDDING' || !trick) return null;
    const plays = toPlays(trick.leadPlayerId, trick.plays ?? {}, (view.seatingOrder ?? []).map((seat) => seat.id), positions);
    let winnerId: string | null = null;
    if (plays.length === 4) {
        const last = view.lastTrick;
        if (last && last.leadPlayerId === trick.leadPlayerId && sameCards(plays, last.plays)) winnerId = last.winnerId;
        else if (trick.winningCard) winnerId = plays.find((play) => play.id === cardId(trick.winningCard!))?.playerId ?? null;
        winnerId ??= plays[trickWinner(plays.map((play) => play.card), trick.trump)].playerId;
    }
    return { leadPlayerId: trick.leadPlayerId, plays, complete: plays.length === 4, winnerId, winnerTeam: winnerId ? teamOf(view, winnerId) : null };
}

/** The hand's last completed trick (§6.1 `lastTrick`), or null (absent, or an older backend). */
export function completedTrick(view: PublicGameView, positions: Readonly<Record<string, SeatPosition>>): TrickModel | null {
    const last = view.lastTrick;
    if (!last) return null;
    const plays = toPlays(last.leadPlayerId, last.plays, last.order, positions);
    return { leadPlayerId: last.leadPlayerId, plays, complete: plays.length === 4, winnerId: last.winnerId, winnerTeam: teamOf(view, last.winnerId) };
}
