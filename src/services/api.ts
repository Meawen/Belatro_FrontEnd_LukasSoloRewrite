// Use local Spring Boot development server
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

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
        options: RequestInit = {}
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
            console.log(`API Request: ${config.method || 'GET'} ${url}`, {
                headers: config.headers,
                hasToken: !!this.getToken(),
                body: config.body
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
                    statusText: response.statusText,
                    errorData
                });

                // If it's a 401, clear the token as it might be expired
                if (response.status === 401) {
                    this.clearToken();
                }

                throw new ApiError({
                    message: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
                    status: response.status,
                });
            }

            // Handle empty responses (like DELETE operations)
            if (response.status === 204 || response.headers.get('content-length') === '0') {
                return {} as T;
            }

            const data = await response.json();
            console.log(`API Success:`, { url, data });
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

    async post<T>(endpoint: string, data?: any): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'POST',
            body: data ? JSON.stringify(data) : undefined,
        });
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