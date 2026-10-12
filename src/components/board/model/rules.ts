import type { Boja, GameCard, Rank } from '../../../types/game';

/** A card's id, "{BOJA}-{RANK}" (the `data-card` value). Cards are matched by id, never by index. */
export type CardId = string;

export function cardId(card: GameCard): CardId {
    return `${card.boja}-${card.rank}`;
}

/** Playing strength of trumps, weakest first (BelotRankComparator): 7 8 Q K 10 A 9 J. */
export const TRUMP_ORDER: readonly Rank[] = ['SEDMICA', 'OSMICA', 'BABA', 'KRALJ', 'DESETKA', 'AS', 'DEVETKA', 'DECKO'];

/** Playing strength of the other suits, weakest first: 7 8 9 J Q K 10 A. */
export const PLAIN_ORDER: readonly Rank[] = ['SEDMICA', 'OSMICA', 'DEVETKA', 'DECKO', 'BABA', 'KRALJ', 'DESETKA', 'AS'];

/** 0 (weakest) … 7 (strongest) within the card's own suit. */
export function strength(card: GameCard, trump: Boja | null): number {
    return (card.boja === trump ? TRUMP_ORDER : PLAIN_ORDER).indexOf(card.rank);
}

function beats(challenger: GameCard, winning: GameCard, lead: Boja, trump: Boja | null): boolean {
    const challengerTrump = challenger.boja === trump;
    const winningTrump = winning.boja === trump;
    if (challengerTrump !== winningTrump) return challengerTrump;
    if (challengerTrump) return strength(challenger, trump) > strength(winning, trump);
    const challengerLead = challenger.boja === lead;
    const winningLead = winning.boja === lead;
    if (challengerLead !== winningLead) return challengerLead;
    return challengerLead && strength(challenger, trump) > strength(winning, trump);
}

/**
 * The game's trick rule (Trick.isCardWinning): `cards` in play order, the lead first. Any trump
 * beats every other suit, the higher trump wins, otherwise the highest card of the led suit.
 * Returns the winning card's index, or -1 for no cards.
 */
export function trickWinner(cards: readonly GameCard[], trump: Boja | null): number {
    if (cards.length === 0) return -1;
    const lead = cards[0].boja;
    let best = 0;
    for (let i = 1; i < cards.length; i++) {
        if (beats(cards[i], cards[best], lead, trump)) best = i;
    }
    return best;
}

/**
 * The play order of a trick: the cyclic turn order (`seatingOrder`, which only rotates) from its
 * lead. A lead that isn't seated (the "_NO_LEAD_" placeholder) leaves the order as it is.
 */
export function playOrder(seatingOrder: readonly string[], leadPlayerId: string): string[] {
    const start = seatingOrder.indexOf(leadPlayerId);
    if (start <= 0) return [...seatingOrder];
    return [...seatingOrder.slice(start), ...seatingOrder.slice(0, start)];
}
