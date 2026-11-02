import { gameSocket } from './gameSocket';
// R-28: /backend through the dev proxy, the baked VITE_API_BASE_URL in production; never localhost
import { API_BASE_URL } from '../config';
import { GUEST_SECRET_KEY } from './guestSecret';
import type { JwtResponseDTO, LoginRequestDTO } from '../types';

// The body the backend sends with WWW-Authenticate: Bearer error="invalid_token".
const SESSION_EXPIRED_ERROR = 'Session expired, please sign in again';

// Bean-validation failures arrive as a field map, e.g. {"password": "..."}.
function firstFieldMessage(body: unknown): string | undefined {
    if (!body || typeof body !== 'object') return undefined;
    const value = Object.values(body as Record<string, unknown>).find((v) => typeof v === 'string');
    return typeof value === 'string' ? value : undefined;
}

class ApiClient {
    private readonly baseURL: string;

    constructor(baseURL: string) {
        this.baseURL = baseURL;
    }

    setToken(token: string) {
        localStorage.setItem('authToken', token);
    }

    clearToken() {
        localStorage.removeItem('authToken');
    }

    private getToken(): string | null {
        return localStorage.getItem('authToken');
    }

    private getHeaders(): HeadersInit {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        return headers;
    }

    async request<T>(
        endpoint: string,
        options: RequestInit = {},
        behavior: { keepTokenOn401?: boolean } = {}
    ): Promise<T> {
        const url = `${this.baseURL}${endpoint}`;
        // Ruling 32: while a guest signs back in with its secret, wait for it, so this goes out on the new token
        if (guestSignIn && !endpoint.startsWith('/api/auth/')) await guestSignIn;
        // A 401 is about the token this request carries, not about one stored since it went out.
        const sentToken = this.getToken();

        const config: RequestInit = {
            ...options,
            headers: {
                ...this.getHeaders(),
                ...options.headers,
            },
        };

        try {
            // never the body or the headers: they carry passwords and the bearer token
            console.log(`API Request: ${config.method || 'GET'} ${url}`, {
                hasToken: !!this.getToken()
            });

            const response = await fetch(url, config);

            console.log(`API Response: ${response.status} ${response.statusText}`, {
                url,
                ok: response.ok,
                status: response.status
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('API Error Details:', {
                    url,
                    status: response.status,
                    statusText: response.statusText
                });

                // A 401 that names the token itself (revoked, stale after a password
                // change in another tab, expired) ends the session even on calls that
                // keep the token on a wrong-password 401. An anonymous call is a 403,
                // never "logged out". With credentials, CORS may hide WWW-Authenticate,
                // so the body the backend sends with it counts too. A 503 (session
                // store unreachable) is neither: the token stays.
                const invalidToken = response.status === 401
                    && ((response.headers.get('WWW-Authenticate') ?? '').includes('invalid_token')
                        || errorData.error === SESSION_EXPIRED_ERROR);

                // gameSocket decides whether that ends the session: not while this tab's password
                // change is in flight, and not when a newer token is stored by now.
                if (response.status === 401 && (!behavior.keepTokenOn401 || invalidToken) && sentToken) {
                    gameSocket.tokenRevoked(sentToken);
                }

                throw new ApiError({
                    message: errorData.message || errorData.error || firstFieldMessage(errorData) || `HTTP ${response.status}: ${response.statusText}`,
                    status: response.status,
                    invalidToken,
                    // spec §1.1: the code beside the sentence; a validation map carries "code": "VALIDATION" last (Ruling 16)
                    code: typeof errorData.code === 'string' ? errorData.code : undefined,
                });
            }

            // Handle empty responses (like DELETE operations)
            if (response.status === 204 || response.headers.get('content-length') === '0') {
                return {} as T;
            }

            // 202 Accepted (the email routes) carries no body; do not depend on Content-Length.
            const text = await response.text();
            // POST /api/auth/logout answers 200 text/plain "Successfully logged out."
            const isText = (response.headers.get('content-type') ?? '').startsWith('text/plain');
            const data = !text ? {} : isText ? text : JSON.parse(text);
            // not the data: login and signup responses carry the token
            console.log(`API Success:`, { url });
            return data;
        } catch (error) {
            console.error('API Request Failed:', { url, error });
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError({
                message: error instanceof Error ? error.message : 'Network error',
                status: 0,
            });
        }
    }

    async get<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: 'GET' });
    }

    async post<T>(endpoint: string, data?: any, behavior?: { keepTokenOn401?: boolean }): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'POST',
            body: data ? JSON.stringify(data) : undefined,
        }, behavior);
    }

    async put<T>(endpoint: string, data?: any): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'PUT',
            body: data ? JSON.stringify(data) : undefined,
        });
    }

    async patch<T>(endpoint: string, data?: any): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'PATCH',
            body: data ? JSON.stringify(data) : undefined,
        });
    }

    async delete<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: 'DELETE' });
    }
}

export const apiClient = new ApiClient(API_BASE_URL);

/**
 * How signing a guest back in with its secret went (Ruling 32): 'resumed' stored a new token and user; 'refused' means
 * the server turned the secret down (the guest was removed), so the secret is forgotten and the session is over;
 * 'unavailable' (no answer, a 429, a 5xx) changed nothing, and a later request or renewal tries again.
 */
export type GuestResume = 'resumed' | 'refused' | 'unavailable';

/** Ruling 44: a sign-in with the secret that has no answer by then counts as no answer ('unavailable'). */
const GUEST_SIGN_IN_TIMEOUT_MS = 10_000;
/**
 * Ruling 44: after no answer, the same stored token waits this long before it signs in again. A page that polls every
 * 2 s (useLobby) gets a 401 each time, which would otherwise send ~30 sign-ins a minute against the server's 10 a
 * minute per address.
 */
const GUEST_SIGN_IN_COOL_DOWN_MS = 15_000;

let guestSignIn: Promise<GuestResume> | null = null;
// The stored token whose sign-in last had no answer, and when (Ruling 44); another token, a new session, never waits.
let unanswered: { token: string | null; at: number } | null = null;

/** The stored guest's current name and its secret; null for a member, a signed-out tab, or a guest without one. */
function storedGuestLogin(): LoginRequestDTO | null {
    try {
        const user = JSON.parse(localStorage.getItem('user') ?? 'null');
        const secret = localStorage.getItem(GUEST_SECRET_KEY);
        return user?.guest === true && typeof user.username === 'string' && secret ? { username: user.username, password: secret } : null;
    } catch {
        return null;
    }
}

/**
 * Ruling 32: signs the stored guest back in through the normal sign-in (POST /api/auth/login) with its current name and
 * its secret; one at a time, and every other request waits for it. Null when there is no guest secret to try.
 * gameSocket decides what the outcome means for the session (tokenRevoked, resumeGuest). Ruling 44: it waits at most
 * 10 s, after no answer the same token waits 15 s before trying again, and an answer that finds another session (or no
 * secret) stored by then stores nothing; each is 'unavailable'.
 */
export function signGuestBackIn(): Promise<GuestResume> | null {
    if (guestSignIn) return guestSignIn;
    const credentials = storedGuestLogin();
    if (!credentials) return null;
    // Ruling 44: the session this sign-in would replace; a newer one stored meanwhile is never overwritten
    const startToken = localStorage.getItem('authToken');
    if (unanswered && unanswered.token === startToken && Date.now() - unanswered.at < GUEST_SIGN_IN_COOL_DOWN_MS) {
        return Promise.resolve('unavailable');
    }
    // keepTokenOn401: a refused secret says nothing about the stored token (the server never reads it on /api/auth/)
    guestSignIn = apiClient.request<JwtResponseDTO>(
        '/api/auth/login',
        { method: 'POST', body: JSON.stringify(credentials), signal: AbortSignal.timeout(GUEST_SIGN_IN_TIMEOUT_MS) },
        { keepTokenOn401: true },
    )
        .then(
            (response): GuestResume => {
                if (!response?.token) return 'unavailable';
                // a sign-out, another sign-in or a refusal in another tab since this went out: theirs stands
                if (localStorage.getItem('authToken') !== startToken || !localStorage.getItem(GUEST_SECRET_KEY)) return 'unavailable';
                apiClient.setToken(response.token);
                // the pair useAuth reads, as userService.changePassword stores it
                if (response.user) localStorage.setItem('user', JSON.stringify(response.user));
                return 'resumed';
            },
            (error: unknown): GuestResume => {
                if (!(error instanceof ApiError) || error.status !== 401) return 'unavailable';
                localStorage.removeItem(GUEST_SECRET_KEY);
                return 'refused';
            },
        )
        .then((outcome) => {
            unanswered = outcome === 'unavailable' ? { token: startToken, at: Date.now() } : null;
            return outcome;
        })
        .finally(() => {
            guestSignIn = null;
        });
    return guestSignIn;
}

export class ApiError extends Error {
    status: number;
    /** A 401 caused by the token itself (WWW-Authenticate: Bearer error="invalid_token", or its body). */
    invalidToken: boolean;
    /** The backend's stable code beside its English sentence (spec §1.1), e.g. "LOBBY_FULL"; undefined when the body has
     *  none (Boot's own error pages, an older server, no answer). */
    code: string | undefined;

    constructor({ message, status, invalidToken, code }: { message: string; status?: number; invalidToken?: boolean; code?: string }) {
        super(message);
        this.name = 'ApiError';
        this.status = status || 0;
        this.invalidToken = invalidToken ?? false;
        this.code = code;
    }
}