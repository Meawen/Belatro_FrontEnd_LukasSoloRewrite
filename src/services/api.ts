import { gameSocket } from './gameSocket';

// Use Vite proxy in development, direct URL in production
const API_BASE_URL = import.meta.env.DEV
    ? '/backend'  // Vite proxy prefix in development (vite.config.ts strips it); not /api, which the backend's own /api/auth routes use
    : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080');

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

export class ApiError extends Error {
    status: number;
    /** A 401 caused by the token itself (WWW-Authenticate: Bearer error="invalid_token", or its body). */
    invalidToken: boolean;

    constructor({ message, status, invalidToken }: { message: string; status?: number; invalidToken?: boolean }) {
        super(message);
        this.name = 'ApiError';
        this.status = status || 0;
        this.invalidToken = invalidToken ?? false;
    }
}