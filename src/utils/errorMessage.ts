/**
 * The message to show for a caught error: an Error's own message (an ApiError carries the
 * backend's `{"error": ...}` text), otherwise the caller's fallback.
 */
export function errorMessage(e: unknown, fallback: string): string {
    return e instanceof Error ? e.message : fallback;
}
