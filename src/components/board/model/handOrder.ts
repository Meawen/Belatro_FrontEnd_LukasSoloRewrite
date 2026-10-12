import { cardId, strength, type CardId } from './rules';
import type { Boja, GameCard } from '../../../types/game';

/** The suit-group order of one hand, frozen at its first state (spec §5.3.6, D-12). */
export interface FrozenOrder {
    /** The cards it was frozen from: the dealt 6 (or what the hand held when first seen). */
    dealt: CardId[];
    /** Suit groups left to right, before the trump group moves to the right end. */
    suits: Boja[];
}

/**
 * My hand in display order (spec §5.3.6). The server re-sorts the hand after every card with a suit
 * order seeded by the hand itself, so the board keeps its own:
 * - the suit groups come from the server's order of the hand's first state and stay frozen;
 * - a suit first seen in the +2 joins after them, in the server's order;
 * - after the trump call the trump group moves to the right end;
 * - within a suit, weakest → strongest (trump 7 8 Q K 10 A 9 J; others 7 8 9 J Q K 10 A).
 * `frozen` is what the previous call returned (null at first). It belongs to this hand while my cards
 * are the dealt ones plus at most the 2 of the trump call; otherwise a new hand freezes a new order.
 */
export function handOrder(
    hand: readonly GameCard[],
    trump: Boja | null,
    frozen: FrozenOrder | null,
): { cards: GameCard[]; frozen: FrozenOrder } {
    const ids = hand.map(cardId);
    const extra = frozen ? ids.filter((id) => !frozen.dealt.includes(id)).length : Infinity;
    const sameHand = frozen !== null && (trump ? extra <= 2 : extra === 0);
    const kept = sameHand ? frozen.suits : [];
    const suits = [...kept];
    for (const card of hand) if (!suits.includes(card.boja)) suits.push(card.boja);
    const groups = trump && suits.includes(trump) ? [...suits.filter((suit) => suit !== trump), trump] : suits;
    const cards = [...hand].sort((x, y) => groups.indexOf(x.boja) - groups.indexOf(y.boja) || strength(x, trump) - strength(y, trump));
    return { cards, frozen: { dealt: sameHand ? frozen.dealt : ids, suits } };
}
