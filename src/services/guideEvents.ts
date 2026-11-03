// R-28: /backend through the dev proxy, the baked VITE_API_BASE_URL in production (as api.ts)
import { API_BASE_URL } from '../config';

/** Škola bele's three counts (open beta spec §9, B9): the guide started, hand 1 finished, hand 2 finished. */
export type GuideEvent = 'started' | 'hand1' | 'hand2';

/**
 * Tells the server one guide event: POST /api/public/guide-events {"event": …} (spec §9), best effort. It sends the
 * event's name and nothing else: no token and no cookie, so the count can't say who you are (Privacy). It isn't
 * apiClient: it never waits for a guest's sign-in, logs nothing, and no answer can end a session. It never rejects,
 * and nobody awaits it: a 400, a 429 (60 an hour per address), a 5xx or no answer is ignored, and the guide goes on.
 * Not sendBeacon: its text/plain body gets a 415.
 */
export async function reportGuideEvent(event: GuideEvent): Promise<void> {
    try {
        await fetch(`${API_BASE_URL}/api/public/guide-events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event }),
            credentials: 'omit',
        });
    } catch {
        // best effort: this count is lost, and nothing else changes
    }
}
