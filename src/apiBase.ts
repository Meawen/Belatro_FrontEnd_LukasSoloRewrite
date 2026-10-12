/**
 * The API origin a production bundle talks to (R-28), and the origin it loads the card art from
 * (P-4). vite.config.ts calls these when `vite build` loads its config, in Node, and bakes the
 * results into the bundle, so this file uses nothing from Vite or the browser.
 */

export const MISSING_API_BASE_URL =
    'VITE_API_BASE_URL must be set for a production build (e.g. https://api.stiglja.com)';

export const MISSING_CARD_ART_BASE_URL =
    'VITE_CARD_ART_BASE_URL must be set for a production build (e.g. https://cards.stiglja.com/v1)';

/** `raw` without surrounding spaces and trailing slashes; unset, blank or only slashes throws `missing`. */
function baseForBuild(raw: string | undefined, missing: string): string {
    const base = (raw ?? '').trim().replace(/\/+$/, '');
    if (!base) throw new Error(missing);
    return base;
}

/**
 * VITE_API_BASE_URL without trailing slashes: `${base}/user/me` must never become `//user/me`, which
 * Spring Security's firewall answers with 400. Unset, blank or only slashes throws: a bundle without
 * an API origin would send every request to the visitor's own machine.
 */
export function apiBaseForBuild(raw: string | undefined): string {
    return baseForBuild(raw, MISSING_API_BASE_URL);
}

/**
 * VITE_CARD_ART_BASE_URL without trailing slashes, so `${base}/Herc%20As.png` never holds `//`.
 * Unset, blank or only slashes throws: a bundle without it would show a text card for every card.
 */
export function cardArtBaseForBuild(raw: string | undefined): string {
    return baseForBuild(raw, MISSING_CARD_ART_BASE_URL);
}
