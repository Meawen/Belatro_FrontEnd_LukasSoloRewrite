/**
 * The API origin a production bundle talks to (R-28). vite.config.ts calls this when `vite build`
 * loads its config, in Node, and bakes the result into the bundle, so this file uses nothing from
 * Vite or the browser.
 */

export const MISSING_API_BASE_URL =
    'VITE_API_BASE_URL must be set for a production build (e.g. https://api.stiglja.com)';

/**
 * VITE_API_BASE_URL without trailing slashes: `${base}/user/me` must never become `//user/me`, which
 * Spring Security's firewall answers with 400. Unset, blank or only slashes throws: a bundle without
 * an API origin would send every request to the visitor's own machine.
 */
export function apiBaseForBuild(raw: string | undefined): string {
    const base = (raw ?? '').trim().replace(/\/+$/, '');
    if (!base) throw new Error(MISSING_API_BASE_URL);
    return base;
}
