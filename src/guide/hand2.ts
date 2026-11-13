import { cardId, type CardId } from '../components/board/model/rules';
import { trumpOf } from '../components/game/gameView';
import type { Catalog } from '../i18n/catalog/types';
import type { Boja, PrivateGameView, PublicGameView } from '../types/game';

/** Why the marked cards are the legal ones (the hint, open beta §7.3): the rule the server applied, read from its set. */
export type WhyKind = 'lead' | 'follow' | 'beat' | 'followTrump' | 'overTrump' | 'cut' | 'overCut' | 'any' | 'noTrump' | 'other';
export interface Why { kind: WhyKind; suit: Boja | null; trump: Boja | null }

/**
 * The cards the rules let me play now, as the board's ids: the server's own `legalCards` (B8), on my turn while playing.
 * Null otherwise, an older backend's view (no field) included. In the server's order, not the hand's: compare as a set.
 */
export function legalIds(view: PrivateGameView | null): CardId[] | null {
    if (!view?.yourTurn || view.publicPart.gameState !== 'PLAYING' || !Array.isArray(view.legalCards)) return null;
    return view.legalCards.map(cardId);
}

/**
 * Which of the Rules page's playing rules gave the server's set (the rules "as the server enforces it"): read from the
 * set, the trick and my hand by counts, never worked out again here. A set no rule explains gets `other`, a neutral
 * line, so the hint never states a wrong rule.
 */
export function whyMarked(view: PrivateGameView | null): Why | null {
    const ids = legalIds(view);
    if (!view || !ids || ids.length === 0) return null;
    const pub = view.publicPart;
    const trump = trumpOf(pub);
    const trick = pub.currentTrick;
    const led = trick?.plays?.[trick.leadPlayerId] ?? null;
    const legal = view.legalCards!;
    const hand = view.hand;
    if (!led) return { kind: 'lead', suit: null, trump };
    const suit = led.boja;
    const held = (boja: Boja) => hand.filter((card) => card.boja === boja).length;
    let kind: WhyKind;
    if (legal.every((card) => card.boja === suit)) {
        // every card of the led suit I hold, or only those that beat the best on the table
        const all = legal.length === held(suit);
        kind = suit === trump ? (all ? 'followTrump' : 'overTrump') : all ? 'follow' : 'beat';
    } else if (trump !== null && suit !== trump && legal.every((card) => card.boja === trump)) {
        kind = legal.length === held(trump) ? 'cut' : 'overCut';
    } else if (legal.length === hand.length) {
        kind = suit === trump ? 'noTrump' : 'any';
    } else {
        kind = 'other';
    }
    return { kind, suit, trump };
}

/** The hint's sentence for `why` (guide.hand2.why), with the suits as the board names them. */
export function whyLine(why: Why, t: Catalog): string {
    const lines = t.guide.hand2.why;
    const name = (boja: Boja | null) => (boja ? t.cards.suit[boja] : '');
    switch (why.kind) {
        case 'follow':
            return lines.follow(name(why.suit));
        case 'beat':
            return lines.beat(name(why.suit));
        case 'any':
            return lines.any(name(why.suit));
        case 'cut':
            return lines.cut(name(why.suit), name(why.trump));
        case 'overCut':
            return lines.overCut(name(why.suit));
        default:
            return lines[why.kind];
    }
}

/** The dealer after three passes: my bid, and I can't pass (the board's dealerMustCall). */
export function mustCall(view: PrivateGameView | null): boolean {
    if (!view?.yourTurn || view.publicPart.gameState !== 'BIDDING') return false;
    return (view.publicPart.bids ?? []).filter((bid) => bid.action === 'PASS').length >= 3;
}

/**
 * Hand 2's first hand is over: the next deal has begun after a scored hand. The scores are game totals, added only when a
 * hand ends, and a scored hand adds at least 162 (a right challenge or a padanje gives one team everything), so 0–0 means
 * the first hand is still on. Read from the view alone, so a refresh or a reconnect keeps it. The hand's result and its
 * 10-s window come first; a finished game is the board's own end sheet's.
 */
export function firstHandOver(view: PublicGameView): boolean {
    const dealt = view.gameState === 'BIDDING' || view.gameState === 'DECLARATIONS' || view.gameState === 'PLAYING';
    return dealt && (view.teamAScore ?? 0) + (view.teamBScore ?? 0) > 0;
}

/** The game has ended: played out, or called off (a belot, a forfeit, 5 missed turns). */
export function gameOver(view: PublicGameView): boolean {
    return view.gameState === 'COMPLETED' || view.gameState === 'CANCELLED';
}
