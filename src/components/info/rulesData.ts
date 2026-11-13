import type { Boja, GameCard, Rank } from '../../types/game';
import type { PlayerRank } from '../../types/user';
import { PLAIN_ORDER, TRUMP_ORDER } from '../board/model/rules';

/**
 * The Rules page's documentation data (ranks spec §9). The one place the SPA writes the rank breakpoints down: the
 * page documents them (primer: "the Rules page table is the one exception"); every other screen reads them from the
 * server. The table's "From" column, in words, is in each language's Rules document (src/i18n/docs/rules.{hr,en}.tsx,
 * open beta §1.2); names and taglines stay as they are in both languages (§1.3).
 */
export const RULE_RANKS: PlayerRank[] = [
    { key: 'CUCEK', name: 'Cucek', tagline: 'Čeka pod stolom.', minRating: null, nextMinRating: null },
    { key: 'DECEC', name: 'Dečec', tagline: 'Bu se navčil.', minRating: null, nextMinRating: 1000 },
    { key: 'FAKIN', name: 'Fakin', tagline: "Fakin, al' zna nekaj.", minRating: 1000, nextMinRating: 1200 },
    { key: 'PAJDAS', name: 'Pajdaš', tagline: 'Dober pajdaš.', minRating: 1200, nextMinRating: 1400 },
    { key: 'GOSPON', name: 'Gospon', tagline: 'Gospon se ne žuri.', minRating: 1400, nextMinRating: 1600 },
    { key: 'MAJSTER', name: 'Majster', tagline: 'Ne zgubi ni štiha.', minRating: 1600, nextMinRating: 1800 },
    { key: 'KAJKAVAC', name: 'Kajkavac', tagline: 'Zna kaj je kaj.', minRating: 1800, nextMinRating: null },
];

/** The full rules' sections, which a guide step or a page hash can open (ranks spec §9.2). */
export const RULE_SECTIONS = [
    'rules-cards', 'rules-bidding', 'rules-playing', 'rules-declarations', 'rules-scoring', 'rules-challenge',
    'rules-modes', 'rules-ranks', 'rules-away', 'rules-decline', 'rules-again',
] as const;
export type RuleSection = (typeof RULE_SECTIONS)[number];

/** One suit highest first, as another suit and as trump (the board's own order, so the guide never disagrees). */
export const PLAIN_HIGH_FIRST: readonly Rank[] = [...PLAIN_ORDER].reverse();
export const TRUMP_HIGH_FIRST: readonly Rank[] = [...TRUMP_ORDER].reverse();

/** Card points (the full rules' Cards table). */
const TRUMP_POINTS: Partial<Record<Rank, number>> = { DECKO: 20, DEVETKA: 14, AS: 11, DESETKA: 10, KRALJ: 4, BABA: 3 };
const PLAIN_POINTS: Partial<Record<Rank, number>> = { AS: 11, DESETKA: 10, KRALJ: 4, BABA: 3, DECKO: 2 };

export function cardPoints(rank: Rank, trump: boolean): number {
    return (trump ? TRUMP_POINTS : PLAIN_POINTS)[rank] ?? 0;
}

const card = (boja: Boja, rank: Rank): GameCard => ({ boja, rank });

/** Why a card in step 4's trick may or may not be played: its line is the catalog's rules.guide.follow.verdict. */
export type FollowVerdict = 'beats' | 'mustBeat' | 'followFirst' | 'mustFollow';

/** Step 4's trick: Herc is trump, Karo 9 was led, nobody has trumped (ranks spec §9.1). */
export const FOLLOW_LED = card('KARA', 'DEVETKA');
export const FOLLOW_HAND: { card: GameCard; legal: boolean; verdict: FollowVerdict }[] = [
    { card: card('KARA', 'KRALJ'), legal: true, verdict: 'beats' },
    { card: card('KARA', 'SEDMICA'), legal: false, verdict: 'mustBeat' },
    { card: card('HERC', 'DECKO'), legal: false, verdict: 'followFirst' },
    { card: card('PIK', 'AS'), legal: false, verdict: 'mustFollow' },
];

/** Step 3's hand: six faces, then two backs to come. */
export const BID_HAND: GameCard[] = [card('HERC', 'AS'), card('HERC', 'DESETKA'), card('HERC', 'KRALJ'), card('KARA', 'DEVETKA'), card('PIK', 'DECKO'), card('TREF', 'SEDMICA')];

/** Step 5's declarations: a run of three, four Deckos, bela (Kralj and Baba of trump, Herc here). */
export const DECLARATIONS: { label: string; cards: GameCard[] }[] = [
    { label: '20', cards: [card('PIK', 'SEDMICA'), card('PIK', 'OSMICA'), card('PIK', 'DEVETKA')] },
    { label: '200', cards: [card('HERC', 'DECKO'), card('KARA', 'DECKO'), card('PIK', 'DECKO'), card('TREF', 'DECKO')] },
    { label: 'Bela 20', cards: [card('HERC', 'KRALJ'), card('HERC', 'BABA')] },
];
