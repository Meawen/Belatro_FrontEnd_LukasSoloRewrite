/**
 * The message to show for a caught error: an Error's own message (an ApiError carries the
 * backend's `{"error": ...}` text), otherwise the caller's fallback.
 */
export function errorMessage(e: unknown, fallback: string): string {
    return e instanceof Error ? e.message : fallback;
}

/**
 * No usable answer: a network failure (status 0) or a 5xx. Its text is the browser's or Spring's
 * ("Failed to fetch", "Internal Server Error"), not the backend's, so it is never shown as is.
 */
export function isNetworkOrServerFailure(status: number): boolean {
    return status === 0 || status >= 500;
}

/** The generic line for a network failure or a 5xx where nothing more specific fits. */
export const SOMETHING_WENT_WRONG = 'Something went wrong. Try again.';

/** The backend's answer for a confirm or reset link it does not accept. */
export const INVALID_LINK = 'This link is invalid or has expired';

/** Shown under a 429. */
export const WAIT_AND_RETRY = 'Wait a while, then try again.';
