
// Use Vite proxy in development, direct URL in production
const API_BASE_URL = import.meta.env.DEV
    ? '/api'  // Use Vite proxy in development
    : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080');

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

                // If it's a 401, clear the token as it might be expired
                if (response.status === 401 && !behavior.keepTokenOn401) {
                    this.clearToken();
                }

                throw new ApiError({
                    message: errorData.message || errorData.error || firstFieldMessage(errorData) || `HTTP ${response.status}: ${response.statusText}`,
                    status: response.status,
                });
            }

            // Handle empty responses (like DELETE operations)
            if (response.status === 204 || response.headers.get('content-length') === '0') {
                return {} as T;
            }

            const data = await response.json();
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

    constructor({ message, status }: { message: string; status?: number }) {
        super(message);
        this.name = 'ApiError';
        this.status = status || 0;
    }
}