import type { Boja, GameCard, GamePhase, PlayerPublicInfo, PublicGameView, Rank } from '../../types/game';

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

/** Phases in words (R-31). The last three are internal; they get a word in case one is ever sent. */
export const PHASE_LABEL: Record<GamePhase, string> = {
    BIDDING: 'Bidding',
    PLAYING: 'Playing',
    HAND_COMPLETE: 'Hand finished',
    COMPLETED: 'Game over',
    CANCELLED: 'Cancelled',
    INITIALIZED: 'Starting',
    DECLARATIONS: 'Declarations',
    SCORING: 'Scoring',
};

/**
 * By the Challenge button while it is offered (R-31). The quota resets every hand
 * (BelotGame.resetHandState clears challengeUsed), hence "for this hand".
 */
export const CHALLENGE_HINT =
    'Think an opponent played an illegal card this hand? Challenge to win the whole hand. A wrong challenge costs your challenge for this hand';

/** A declined ranked match (R-25): the end sentence, and the notice /play shows after it. */
export const DECLINED_NOTICE = "A player declined — you're back in the queue";

const OTHER_TEAM = { A: 'B', B: 'A' } as const;

/** The viewer's team, from the public view's team lists; null for someone who isn't seated. */
export function teamOf(view: PublicGameView, me: string): 'A' | 'B' | null {
    if (view.teamA?.some((seat) => seat.id === me)) return 'A';
    if (view.teamB?.some((seat) => seat.id === me)) return 'B';
    return null;
}

/**
 * The scored declarations, one line each (R-31). The server lists only the zvanja that counted, and
 * only once trump is called (ScoredDeclarations): a player's best sequence and four of a kind.
 */
export function declarationLines(view: PublicGameView): string[] {
    const lines: string[] = [];
    Object.entries(view.declarations ?? {}).forEach(([player, scored]) => {
        const [suit] = Object.keys(scored.sequencesBySuit ?? {}) as Boja[];
        if (scored.bestSequencePoints) {
            lines.push(`${player}: sequence ${scored.bestSequencePoints}${suit ? ` (${SUIT_LABEL[suit]})` : ''}`);
        }
        if (scored.fourOfAKindPoints) lines.push(`${player}: four of a kind ${scored.fourOfAKindPoints}`);
    });
    // R-32: bela once declared, from belaDeclaredByPlayer (a declarations entry never carries it)
    Object.entries(view.belaDeclaredByPlayer ?? {}).forEach(([player, declared]) => {
        if (declared) lines.push(`${player}: bela 20`);
    });
    return lines;
}

/** Why a game ended other than by being played out (R-31); null for a game played to its end. */
export function endSentence(view: PublicGameView): string | null {
    const team = view.forfeitTeamId;
    switch (view.endReason) {
        case 'FORFEIT':
            return team ? `Team ${team} forfeited — Team ${OTHER_TEAM[team]} wins` : null;
        case 'ABANDONED':
            return team
                ? `Team ${team} left — the game was abandoned (no result)`
                : 'Everyone left — the game was abandoned (no result)';
        case 'DECLINED':
            return DECLINED_NOTICE;
        case 'CANCELLED':
            return 'The game was cancelled';
        default:
            // an older backend sends no endReason
            return view.gameState === 'CANCELLED' ? 'The game was cancelled' : null;
    }
}

/**
 * R-32: the trump K (Kralj) or Q (Baba) while the other is still in hand: the only plays that can
 * declare bela (BelotGame.processBela checks the same and adds 20 points).
 */
export function isBelaCard(card: GameCard, hand: GameCard[], trump: Boja | null): boolean {
    if (!trump || card.boja !== trump) return false;
    const partner = card.rank === 'KRALJ' ? 'BABA' : card.rank === 'BABA' ? 'KRALJ' : null;
    return partner !== null && hand.some((held) => held.boja === trump && held.rank === partner);
}
