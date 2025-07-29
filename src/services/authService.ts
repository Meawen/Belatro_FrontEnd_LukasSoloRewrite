import { apiClient } from './api';
import type {
    LoginRequestDTO,
    SignupRequestDTO,
    JwtResponseDTO,
} from '../types';

export const authService = {
    async login(credentials: LoginRequestDTO): Promise<JwtResponseDTO> {
        const response = await apiClient.post<JwtResponseDTO>('/api/auth/login', credentials);

        if (response.token) {
            apiClient.setToken(response.token);
        }

        return response;
    },

    async signup(userData: SignupRequestDTO): Promise<JwtResponseDTO> {
        const response = await apiClient.post<JwtResponseDTO>('/api/auth/signup', userData);

        if (response.token) {
            apiClient.setToken(response.token);
        }

        return response;
    },

    async logout(): Promise<string> {
        const response = await apiClient.post<string>('/api/auth/logout');
        apiClient.clearToken();
        return response;
    },

    // Helper method to check if user is authenticated
    isAuthenticated(): boolean {
        return !!localStorage.getItem('authToken');
    },

    // Get current token
    getToken(): string | null {
        return localStorage.getItem('authToken');
    }
};