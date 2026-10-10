/**
 * The return path (spec §4.1, D-20). ProtectedRoute hands /login the page a signed-out visitor asked
 * for as navigation state `{ from }` (pathname + search); every in-app hop of the auth flow carries it
 * on, and sign-in, sign-up's Continue and confirm-email's Continue go there.
 */

/** Where the app goes when there is no safe return path. */
export const DEFAULT_RETURN_PATH = '/dashboard';

/**
 * `from` as an in-app path (pathname + search + hash), or `/dashboard` when it isn't one. Safe means:
 * a string that, resolved against this origin, keeps this origin and has a pathname starting with
 * "/", and that does not itself start with "//" or "/\" (both name another host).
 */
export function safeReturnPath(from: unknown): string {
    if (typeof from !== 'string' || from.startsWith('//') || from.startsWith('/\\')) return DEFAULT_RETURN_PATH;
    let url: URL;
    try {
        url = new URL(from, window.location.origin);
    } catch {
        return DEFAULT_RETURN_PATH;
    }
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/')) return DEFAULT_RETURN_PATH;
    return `${url.pathname}${url.search}${url.hash}`;
}
