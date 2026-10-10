import { cardId, trickWinner, type CardId } from './rules';
import type { Team } from './trick';
import type { Boja, GameCard, GamePhase, Rank } from '../../../types/game';
import type { HandDTO } from '../../../types/match';

const BOJE: readonly string[] = ['KARA', 'HERC', 'TREF', 'PIK'];
const RANKS: readonly string[] = ['SEDMICA', 'OSMICA', 'DEVETKA', 'DECKO', 'BABA', 'KRALJ', 'DESETKA', 'AS'];

/** A stored move's card, "AS of HERC" (backend Card.toString), as a card; null if it isn't one. */
export function parseMoveCard(text: string | null): GameCard | null {
    const match = /^([A-Z]+) of ([A-Z]+)$/.exec(text ?? '');
    if (!match || !RANKS.includes(match[1]) || !BOJE.includes(match[2])) return null;
    return { boja: match[2] as Boja, rank: match[1] as Rank };
}

/** The hand's trump: its call that isn't a pass. */
export function handTrump(hand: HandDTO): Boja | null {
    const call = (hand.trumpCalls ?? []).find((c) => c.trump && c.trump !== 'PASS' && BOJE.includes(c.trump));
    return (call?.trump as Boja | undefined) ?? null;
}

export interface TrickRecord {
    trickNo: number;
    /** In play order (the stored move order). */
    plays: { playerId: string; card: GameCard; id: CardId }[];
    /** The server's winner (spec §6.3); for a full trick without one, the game rule's. */
    winnerId: string | null;
}

/** A hand's tricks with their cards in play order and their winners. */
export function handTricks(hand: HandDTO): TrickRecord[] {
    const trump = handTrump(hand);
    return (hand.tricks ?? []).map((trick, i) => {
        const plays = [...(trick.moves ?? [])]
            .sort((x, y) => (x.order ?? 0) - (y.order ?? 0))
            .flatMap((move) => {
                const card = parseMoveCard(move.card);
                return card && move.player ? [{ playerId: move.player, card, id: cardId(card) }] : [];
            });
        let winnerId = trick.winnerId ?? null;
        if (!winnerId && plays.length === 4 && trump) winnerId = plays[trickWinner(plays.map((play) => play.card), trump)].playerId;
        return { trickNo: trick.trickNo ?? i + 1, plays, winnerId };
    });
}

/** A hand is complete in the store once it has its summary and all 32 cards, or a successful challenge ended it. */
export function handIsComplete(hand: HandDTO): boolean {
    if (!hand.handSummary) return false;
    if ((hand.challenges ?? []).some((challenge) => challenge.success)) return true;
    return handTricks(hand).reduce((sum, trick) => sum + trick.plays.length, 0) === 32;
}

/**
 * The hand that just ended, as stored: the one whose summary's final scores equal the HAND_COMPLETE
 * view's (unique: every hand changes the scores), once complete. Null while the store lags behind the
 * view (the frames go out before Mongo has the 8th card and END_HAND).
 */
export function endedHand(hands: readonly HandDTO[] | null, scores: { a: number; b: number }): HandDTO | null {
    const hand = [...(hands ?? [])].reverse().find((h) => h.handSummary?.finalScoreA === scores.a && h.handSummary?.finalScoreB === scores.b);
    return hand && handIsComplete(hand) ? hand : null;
}

export interface BlokRow {
    handNo: number;
    /** The hand's change in each team's score: rows add up to the view's scores, padanje and capot included. */
    a: number;
    b: number;
    /** The team that fell (the caller's), for the PAD tag. */
    padanje: Team | null;
    /** The team that took all eight tricks, for the CAPOT tag. */
    capot: Team | null;
}

/**
 * Bela Blok (spec §5.3.3): one row per hand with a summary, deduplicated by handNo (a challenged hand
 * stores END_HAND twice; the last counts), each = finalScore(n) − finalScore(n−1).
 */
export function blokRows(hands: readonly HandDTO[] | null, teamOf: (playerId: string) => Team | null): BlokRow[] {
    const byNo = new Map<number, HandDTO>();
    for (const hand of hands ?? []) if (hand.handSummary && hand.handNo != null) byNo.set(hand.handNo, hand);
    let a = 0;
    let b = 0;
    return [...byNo.keys()].sort((x, y) => x - y).map((handNo) => {
        const hand = byNo.get(handNo)!;
        const summary = hand.handSummary!;
        const caller = (hand.trumpCalls ?? []).find((c) => c.trump && c.trump !== 'PASS')?.player;
        const row: BlokRow = {
            handNo,
            a: summary.finalScoreA - a,
            b: summary.finalScoreB - b,
            padanje: summary.padanje && caller ? teamOf(caller) : null,
            capot: summary.capot ? (summary.teamATricksWon === 8 ? 'A' : summary.teamBTricksWon === 8 ? 'B' : null) : null,
        };
        a = summary.finalScoreA;
        b = summary.finalScoreB;
        return row;
    });
}

/**
 * The won-trick peek (spec §5.3.3, D-11): the current hand's complete tricks won by `team`. The current
 * hand is the last one with a trump call, while PLAYING or in HAND_COMPLETE; there is none otherwise.
 */
export function peekTricks(
    hands: readonly HandDTO[] | null,
    phase: GamePhase | null,
    team: Team | null,
    teamOf: (playerId: string) => Team | null,
): TrickRecord[] {
    if (!team || (phase !== 'PLAYING' && phase !== 'HAND_COMPLETE')) return [];
    const current = [...(hands ?? [])].sort((x, y) => (x.handNo ?? 0) - (y.handNo ?? 0)).reverse().find((hand) => handTrump(hand) !== null);
    if (!current) return [];
    return handTricks(current).filter((trick) => trick.plays.length === 4 && trick.winnerId !== null && teamOf(trick.winnerId) === team);
}
