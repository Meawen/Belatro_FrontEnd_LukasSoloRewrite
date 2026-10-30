import type { Boja, GameCard, GamePhase, PlayerPublicInfo, PublicGameView, Rank, ZvanjaSeatView } from '../../types/game';
import { cat } from '../../i18n/t';

/** Bid buttons, in this order. */
export const BOJE: Boja[] = ['HERC', 'KARA', 'PIK', 'TREF'];

/** A suit's name in the site's language (cards.suit); read when used, never at import (i18n/t.ts). */
export const SUIT_LABEL: Readonly<Record<Boja, string>> = {
    get HERC() { return cat().cards.suit.HERC; },
    get KARA() { return cat().cards.suit.KARA; },
    get PIK() { return cat().cards.suit.PIK; },
    get TREF() { return cat().cards.suit.TREF; },
};

/** A rank's name in the site's language (cards.rank); read when used, never at import (i18n/t.ts). */
export const RANK_LABEL: Readonly<Record<Rank, string>> = {
    get SEDMICA() { return cat().cards.rank.SEDMICA; },
    get OSMICA() { return cat().cards.rank.OSMICA; },
    get DEVETKA() { return cat().cards.rank.DEVETKA; },
    get DESETKA() { return cat().cards.rank.DESETKA; },
    get DECKO() { return cat().cards.rank.DECKO; },
    get BABA() { return cat().cards.rank.BABA; },
    get KRALJ() { return cat().cards.rank.KRALJ; },
    get AS() { return cat().cards.rank.AS; },
};

export function cardLabel(card: GameCard): string {
    return cat().cards.card(RANK_LABEL[card.rank], SUIT_LABEL[card.boja]);
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

/** Phases in words (R-31), in the site's language (game.phase). The last three are internal; they get a word in case one is ever sent. */
export const PHASE_LABEL: Readonly<Record<GamePhase, string>> = {
    get BIDDING() { return cat().game.phase.BIDDING; },
    get PLAYING() { return cat().game.phase.PLAYING; },
    get HAND_COMPLETE() { return cat().game.phase.HAND_COMPLETE; },
    get COMPLETED() { return cat().game.phase.COMPLETED; },
    get CANCELLED() { return cat().game.phase.CANCELLED; },
    get INITIALIZED() { return cat().game.phase.INITIALIZED; },
    get DECLARATIONS() { return cat().game.phase.DECLARATIONS; },
    get SCORING() { return cat().game.phase.SCORING; },
};

const OTHER_TEAM = { A: 'B', B: 'A' } as const;

/** The viewer's team, from the public view's team lists; null for someone who isn't seated. */
export function teamOf(view: PublicGameView, me: string): 'A' | 'B' | null {
    if (view.teamA?.some((seat) => seat.id === me)) return 'A';
    if (view.teamB?.some((seat) => seat.id === me)) return 'B';
    return null;
}

/**
 * "up to Baba" (a run) or "four Asovi" (a four) for a seat tied at the top value with an opponent (D-20; the view's
 * kind and height); null for any other seat. The board's declaration moment and the hand history (gameplay rules §7)
 * say it the same way: it lives here so the hand history doesn't pull the moment's module into every page.
 */
export function heightText(seat: ZvanjaSeatView): string | null {
    if (seat.height === null) return null;
    // whole phrases per rank (cards.four, cards.upTo): a declined form never comes from code
    return seat.kind === 'FOUR' ? cat().cards.four[seat.height] : cat().cards.upTo[seat.height];
}

/** A seat's scored declarations as values, strongest first (the view's order): "50 + 20". */
export function declaredPoints(seat: ZvanjaSeatView): string {
    return seat.declarations.map((declaration) => declaration.points).join(' + ');
}

/**
 * The scored declarations (R-31, gameplay rules §6): one line per winning seat, in turn order, with all its
 * values ("ivo: 50 + 20"), from `zvanja` once trump is called; the older `declarations` field makes none.
 */
export function declarationLines(view: PublicGameView): string[] {
    const lines = (view.zvanja?.seats ?? [])
        .filter((seat) => seat.declarations.length > 0)
        .map((seat) => `${seat.playerId}: ${declaredPoints(seat)}`);
    // R-32: bela once declared, from belaDeclaredByPlayer (a declarations entry never carries it)
    Object.entries(view.belaDeclaredByPlayer ?? {}).forEach(([player, declared]) => {
        if (declared) lines.push(cat().game.belaLine(player));
    });
    return lines;
}

/** A belot in words, e.g. "ivo held all eight Pik" (gameplay rules §3): the end sheet's reason and the hand history's line. */
export function heldAllEight(name: string, suit: Boja): string {
    return cat().cards.heldAllEight(name, SUIT_LABEL[suit]);
}

/** Why a game ended other than by being played out (R-31); null for a game played to its end. */
export function endSentence(view: PublicGameView): string | null {
    const team = view.forfeitTeamId;
    switch (view.endReason) {
        case 'BELOT': {
            // who held it comes from zvanja (gameplay rules §3); a view without it says nothing more than the winner line
            const belot = view.zvanja?.belot;
            return belot ? heldAllEight(belot.playerId, belot.suit) : null;
        }
        case 'FORFEIT':
            return team ? cat().game.end.forfeited(team, OTHER_TEAM[team]) : null;
        case 'ABANDONED':
            return team
                ? cat().game.end.teamLeft(team)
                : cat().game.end.everyoneLeft;
        case 'DECLINED':
            // R-25: also the notice /play shows after it (GamePageConnected)
            return cat().game.end.declined;
        case 'CANCELLED':
            return cat().game.end.cancelledReason;
        default:
            // an older backend sends no endReason
            return view.gameState === 'CANCELLED' ? cat().game.end.cancelledReason : null;
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

/** R-45: a rematch follows a finished game, and a ranked forfeit (CANCELLED with endReason FORFEIT). */
export function rematchOffered(view: PublicGameView): boolean {
    return view.gameState === 'COMPLETED' || (view.gameState === 'CANCELLED' && view.endReason === 'FORFEIT');
}
