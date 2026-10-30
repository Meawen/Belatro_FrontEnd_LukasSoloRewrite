import { ApiError } from '../services/api';
import { localiseApiError } from '../i18n/serverErrors';

/**
 * The message to show for a caught error: an ApiError in the site's language (i18n/serverErrors, spec §1.1),
 * another Error's own message, otherwise the caller's fallback.
 */
export function errorMessage(e: unknown, fallback: string): string {
    if (e instanceof ApiError) return localiseApiError(e);
    return e instanceof Error ? e.message : fallback;
}

/**
 * No usable answer: a network failure (status 0) or a 5xx. Its text is the browser's or Spring's
 * ("Failed to fetch", "Internal Server Error"), not the backend's, so it is never shown as is.
 */
export function isNetworkOrServerFailure(status: number): boolean {
    return status === 0 || status >= 500;
}
