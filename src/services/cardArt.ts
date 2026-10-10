import { CARD_ART_BASE_URL } from '../config';
import type { Boja, GameCard, Rank } from '../types/game';

/**
 * The card art (spec §3.6): 32 faces "<Suit> <Rank>.png", three backs "CardBack1–3.png" (red, teal,
 * purple) and four suit icons "{herc,kara,pik,tref}Icon.png", under CARD_ART_BASE_URL. Every face
 * and back is a 71×95 pixel grid drawn at 3× (213×285 PNG); the icons are 52×49.
 */

const SUIT_FILE: Record<Boja, string> = { HERC: 'Herc', KARA: 'Karo', PIK: 'Pik', TREF: 'Tref' };
const ICON_FILE: Record<Boja, string> = { HERC: 'herc', KARA: 'kara', PIK: 'pik', TREF: 'tref' };
const RANK_FILE: Record<Rank, string> = {
    SEDMICA: '7',
    OSMICA: '8',
    DEVETKA: '9',
    DESETKA: '10',
    DECKO: 'Decko',
    BABA: 'Baba',
    KRALJ: 'Kralj',
    AS: 'As',
};
const BOJE: Boja[] = ['HERC', 'KARA', 'PIK', 'TREF'];
const RANKS: Rank[] = ['SEDMICA', 'OSMICA', 'DEVETKA', 'DESETKA', 'DECKO', 'BABA', 'KRALJ', 'AS'];

const art = (file: string) => `${CARD_ART_BASE_URL}/${encodeURIComponent(file)}`;

export function faceUrl(card: GameCard): string {
    return art(`${SUIT_FILE[card.boja]} ${RANK_FILE[card.rank]}.png`);
}

/** 1 is the red back the opponents' hands use (X-13). */
export function backUrl(n: 1 | 2 | 3 = 1): string {
    return art(`CardBack${n}.png`);
}

export function suitIconUrl(boja: Boja): string {
    return art(`${ICON_FILE[boja]}Icon.png`);
}

/** All 39 files: 32 faces, 3 backs, 4 suit icons. */
export function cardArtUrls(): string[] {
    return [
        ...BOJE.flatMap((boja) => RANKS.map((rank) => faceUrl({ boja, rank }))),
        backUrl(1),
        backUrl(2),
        backUrl(3),
        ...BOJE.map(suitIconUrl),
    ];
}

/** The decoded images, held so the browser keeps them ready for the board. */
const decoded: HTMLImageElement[] = [];
/** The URLs decoded on this page: PlayingCard shows these at once, others behind their text card until loaded. */
const ready = new Set<string>();
let preloading: Promise<void> | null = null;

/** True once `url` has decoded on this page (by the preload, or by a card that loaded it). */
export function isArtDecoded(url: string): boolean {
    return ready.has(url);
}

/** Records that a card element loaded `url`, so later cards show it without the text card first. */
export function markArtDecoded(url: string): void {
    ready.add(url);
}

function decode(url: string): Promise<void> {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    decoded.push(img);
    if (typeof img.decode !== 'function') return Promise.resolve();
    // A failed image is skipped: PlayingCard keeps its text card instead.
    return img.decode().then(() => markArtDecoded(url), () => undefined);
}

/**
 * Fetches and decodes all 39 images once per page load, on entering a lobby or a game, without any
 * React state (the old card hook re-rendered the page on every image load). Every call returns the same
 * promise, which never rejects.
 */
export function preloadCardArt(): Promise<void> {
    preloading ??= Promise.all(cardArtUrls().map(decode)).then(() => undefined);
    return preloading;
}
