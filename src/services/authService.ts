import { apiClient } from './api';
import { gameSocket } from './gameSocket';
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
        // let go of the socket first: the server closes it (1008) before it answers
        gameSocket.disconnect();
        const response = await apiClient.post<string>('/api/auth/logout');
        apiClient.clearToken();
        return response;
    },

    async confirmEmail(token: string): Promise<void> {
        await apiClient.post<void>('/api/auth/confirm-email', { token });
    },

    async forgotPassword(email: string): Promise<void> {
        await apiClient.post<void>('/api/auth/forgot-password', { email });
    },

    // A reset ends every session of the account, this browser's included.
    async resetPassword(token: string, newPassword: string): Promise<void> {
        await apiClient.post<void>('/api/auth/reset-password', { token, newPassword });
        apiClient.clearToken();
        localStorage.removeItem('user');
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