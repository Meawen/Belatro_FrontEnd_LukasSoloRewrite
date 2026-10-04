import type { Boja, GameCard, PlayerPublicInfo, PublicGameView, Rank } from '../../types/game';

/** Bid buttons, in this order. */
export const BOJE: Boja[] = ['HERC', 'KARA', 'PIK', 'TREF'];

export const SUIT_LABEL: Record<Boja, string> = { HERC: 'Herc', KARA: 'Karo', PIK: 'Pik', TREF: 'Tref' };

export const RANK_LABEL: Record<Rank, string> = {
    SEDMICA: '7',
    OSMICA: '8',
    DEVETKA: '9',
    DESETKA: '10',
    DECKO: 'Decko',
    BABA: 'Baba',
    KRALJ: 'Kralj',
    AS: 'As',
};

export function cardLabel(card: GameCard): string {
    return `${RANK_LABEL[card.rank]} ${SUIT_LABEL[card.boja]}`;
}

/**
 * Seats in table order starting with `me` at the bottom, then the next player in
 * turn order (right), the partner (top) and the previous player (left).
 */
export function seatsFromMe(seatingOrder: PlayerPublicInfo[], me: string): PlayerPublicInfo[] {
    const start = seatingOrder.findIndex((seat) => seat.id === me);
    if (start <= 0) return seatingOrder;
    return [...seatingOrder.slice(start), ...seatingOrder.slice(0, start)];
}

/**
 * Trump of the hand in progress: the trick's own, else the last trump call. None while
 * bidding: the view still carries the previous hand's last trick, with its trump.
 */
export function trumpOf(view: PublicGameView): Boja | null {
    if (view.gameState === 'BIDDING') return null;
    if (view.currentTrick?.trump) return view.currentTrick.trump;
    const call = [...(view.bids ?? [])].reverse().find((bid) => bid.action === 'CALL_TRUMP');
    return call?.selectedTrump ?? null;
}
