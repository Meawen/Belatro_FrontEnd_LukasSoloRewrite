export type CardSize = 'hand' | 'trick' | 'thumb' | 'sheet';

/** The art: 71×95 pixels, drawn at 3× (spec §3.6). */
export const ART_W = 71;
export const ART_H = 95;

/** The intended CSS width of a card (spec §3.6, D-23). */
export function intendedCardWidth(size: CardSize, viewport: { width: number; dpr: number }): number {
    const desktop = viewport.width >= 1024;
    switch (size) {
        case 'hand':
            return desktop ? (viewport.dpr >= 2 ? 106.5 : 142) : ART_W;
        case 'trick':
            return desktop && viewport.dpr >= 2 ? 106.5 : ART_W;
        case 'thumb':
            return viewport.width <= 420 ? (ART_W * 2) / 3 : ART_W;
        case 'sheet':
            return ART_W / 2;
    }
}

/**
 * 71 × s / dpr, where s is the whole number of device pixels per art pixel nearest to the intent, so the
 * art stays crisp at any DPR. Below one device pixel per art pixel the intended width stays (soft).
 */
export function crispCardWidth(intended: number, dpr: number): number {
    const ratio = (intended * dpr) / ART_W;
    return ratio < 1 ? intended : (ART_W * Math.round(ratio)) / dpr;
}
