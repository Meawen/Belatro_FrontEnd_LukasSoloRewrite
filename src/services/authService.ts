import { apiClient } from './api';
import { gameSocket } from './gameSocket';
import type {
    LoginRequestDTO,
    SignupRequestDTO,
    JwtResponseDTO,
    GoogleSignInRequest,
    GoogleSignInDTO,
} from '../types';
import type { Lang } from '../i18n/lang';
import { GUEST_SECRET_KEY, forgetSession } from './guestSecret';

/**
 * An account's token, from a sign-in or a sign-up: the account's session ends the guest in this browser, its secret too
 * (spec §3.3, Ruling 32).
 */
function storeAccountToken(token: string): void {
    apiClient.setToken(token);
    localStorage.removeItem(GUEST_SECRET_KEY);
}

export const authService = {
    async login(credentials: LoginRequestDTO): Promise<JwtResponseDTO> {
        // a wrong password is about what was typed, not the stored token: a guest signing in from /login stays a guest
        const response = await apiClient.post<JwtResponseDTO>('/api/auth/login', credentials, { keepTokenOn401: true });
        if (response.token) storeAccountToken(response.token);
        return response;
    },

    async signup(userData: SignupRequestDTO): Promise<JwtResponseDTO> {
        const response = await apiClient.post<JwtResponseDTO>('/api/auth/signup', userData);
        if (response.token) storeAccountToken(response.token);
        return response;
    },

    // Google sign-in spec §1: Google's ID token, answered signed in (stored as login's is) or needsName (nothing stored).
    // A guest's token rides along (spec §3.4); a refused Google token (401 GOOGLE_INVALID) is about Google's token, not
    // the stored one, so a guest stays a guest, as at login
    async google(request: GoogleSignInRequest): Promise<GoogleSignInDTO> {
        const response = await apiClient.post<GoogleSignInDTO>('/api/auth/google', request, { keepTokenOn401: true });
        if (response.token) storeAccountToken(response.token);
        return response;
    },

    // spec §3 (B4): a guest for a visitor with no session; the answer is the login shape with user.guest true, and the
    // guest's secret (Ruling 32), kept to sign it back in later. Stores the token and the user, the pair useAuth reads
    // (it logs out a token it finds without a user).
    async startGuest(language: Lang): Promise<Omit<JwtResponseDTO, 'guestSecret'>> {
        const { guestSecret, ...response } = await apiClient.post<JwtResponseDTO>('/api/auth/guest', { language });
        if (response.token) apiClient.setToken(response.token);
        if (response.user) localStorage.setItem('user', JSON.stringify(response.user));
        // never an earlier guest's secret beside this guest
        if (guestSecret) localStorage.setItem(GUEST_SECRET_KEY, guestSecret);
        else localStorage.removeItem(GUEST_SECRET_KEY);
        // Ruling 44: the secret stays in storage; no caller is handed it
        return response;
    },

    // spec §3.1: a guest's new name. The name is the token's subject and the game's player id, so the server answers a
    // fresh token and the old one stops working (409 IN_GAME while the guest sits at a table). Stored as
    // userService.changePassword stores its token: the socket's session end is held until the new token is in. The
    // secret stays: the server keeps it on the same account (Ruling 32). The name goes out in NFC (Ruling 35).
    async renameGuest(username: string): Promise<JwtResponseDTO> {
        const settled = gameSocket.holdSessionEnd();
        try {
            const response = await apiClient.patch<JwtResponseDTO>('/user/me/guest-name', { username: username.normalize('NFC') });
            if (response?.token) {
                apiClient.setToken(response.token);
                if (response.user) localStorage.setItem('user', JSON.stringify(response.user));
                gameSocket.reconnect();
            }
            return response;
        } finally {
            settled();
        }
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
        // Ruling 44: the whole session, a guest's secret too
        forgetSession();
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