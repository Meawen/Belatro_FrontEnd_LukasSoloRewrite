import { apiClient } from './api';
import { gameSocket } from './gameSocket';
import type { JwtResponseDTO } from '../types';

/**
 * Session renewal (R-10). A sign-in lasts 120 min. POST /user/me/token answers a fresh token with
 * the same session version (the old one keeps working until it expires). The SPA renews when less
 * than 15 min remain (or, for a token shorter-lived than 30 min, such as the rig's, less than half its
 * life: the server allows 20 renewals an hour), once at start, when the tab is shown again, and every
 * minute. The new token is
 * stored and the game socket reopens on it. The old socket's expiry close (1008) then finds a newer
 * token in storage and never signs the tab out (gameSocket.tokenRevoked).
 *
 * A failed renewal changes nothing. A network error, a 429 or a 5xx is tried again by the next
 * trigger; a 401 has already ended the session the normal way, inside api.ts.
 */

const RENEW_WHEN_LEFT_MS = 15 * 60 * 1000;
const CHECK_EVERY_MS = 60 * 1000;

let inFlight: Promise<boolean> | null = null;

/**
 * When to renew, in epoch ms: 15 min before `exp`, or half-way through the token's life when it is
 * shorter than 30 min (`iat` present). Read without verifying (the server does that); null if unreadable.
 * Null too once `exp` has passed: the server answers that token's renewal with a 401, which would sign
 * the tab out of pages that need no session (the mailed confirm-email and reset-password links).
 */
function renewAt(token: string, now: number): number | null {
    try {
        const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const { exp, iat } = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
        if (typeof exp !== 'number' || exp * 1000 <= now) return null;
        const lead = typeof iat === 'number'
            ? Math.min(RENEW_WHEN_LEFT_MS, ((exp - iat) * 1000) / 2)
            : RENEW_WHEN_LEFT_MS;
        return exp * 1000 - lead;
    } catch {
        return null;
    }
}

async function renew(sentToken: string): Promise<boolean> {
    try {
        const response = await apiClient.post<JwtResponseDTO>('/user/me/token');
        // A sign-out, or another tab's renewal or password change, replaced the token meanwhile: keep theirs.
        if (!response?.token || localStorage.getItem('authToken') !== sentToken) return false;
        apiClient.setToken(response.token);
        gameSocket.reconnect();
        return true;
    } catch {
        // apiClient throws only ApiError. A 401 already ended the session in api.ts; anything else
        // (no network, 429, 5xx) leaves the session as it is, and the next trigger tries again.
        return false;
    }
}

/** Renews the stored token once it is due (see renewAt). Resolves true when a new token was stored. */
export function renewIfExpiring(now: number = Date.now()): Promise<boolean> {
    if (inFlight) return inFlight;
    const token = localStorage.getItem('authToken');
    if (!token) return Promise.resolve(false);
    const due = renewAt(token, now);
    if (due === null || now <= due) return Promise.resolve(false);
    const renewal = renew(token).finally(() => {
        inFlight = null;
    });
    inFlight = renewal;
    return renewal;
}

/** Installs the three triggers (main.tsx calls this once). Returns the function that removes them. */
export function startTokenRenewal(): () => void {
    const check = () => {
        void renewIfExpiring();
    };
    const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    check();
    return () => {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.clearInterval(timer);
    };
}
