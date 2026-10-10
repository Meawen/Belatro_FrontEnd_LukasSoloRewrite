import { apiClient } from './api';
import { gameSocket } from './gameSocket';
import type {
    User,
    UserDto,
    ChangePasswordRequest,
    ChangeEmailRequest,
    JwtResponseDTO,
    PlayerMatchHistoryDTO,
    PlayerMatchSummaryDTO,
    PaginationParams,
    Page,
} from '../types';

export const userService = {
    async getUserById(id: string): Promise<User> {
        console.log('userService.getUserById called with id:', id);
        console.log('Current token:', localStorage.getItem('authToken') ? 'present' : 'missing');
        return apiClient.get<User>(`/user/${id}`);
    },

    async getMe(): Promise<UserDto> {
        return apiClient.get<UserDto>('/user/me');
    },

    // 200 with a fresh token: the server ended every other session (and closes their
    // sockets); this tab continues on the new token, so store it and reopen the socket.
    // This tab's socket gets its 1008 before that 200 arrives: hold it until then.
    async changePassword(request: ChangePasswordRequest): Promise<void> {
        const settled = gameSocket.holdSessionEnd();
        try {
            const response = await apiClient.post<JwtResponseDTO>('/user/me/password', request, { keepTokenOn401: true });
            if (response?.token) {
                apiClient.setToken(response.token);
                // the pair useAuth reads: another tab may have cleared either while this was in flight
                if (response.user) localStorage.setItem('user', JSON.stringify(response.user));
                gameSocket.reconnect();
            }
        } finally {
            settled();
        }
    },

    async changeEmail(request: ChangeEmailRequest): Promise<void> {
        await apiClient.post<void>('/user/me/email', request, { keepTokenOn401: true });
    },

    async resendEmailConfirmation(): Promise<void> {
        await apiClient.post<void>('/user/me/email/resend');
    },

    // The server pages, sorts by username and filters on q (case-insensitive substring).
    // It answers 400 for a NUL in q, so NUL characters are dropped before sending.
    // sort "elo" (spec §6.2): the players who have played first, by Elo, then the accounts without a game.
    async getUsersPage(params: { page: number; size: number; q?: string; sort?: 'elo' }): Promise<Page<User>> {
        const query = new URLSearchParams({ page: String(params.page), size: String(params.size) });
        const q = params.q?.replace(/\0/g, '');
        if (q) query.set('q', q);
        if (params.sort) query.set('sort', params.sort);
        return apiClient.get<Page<User>>(`/user/findAll?${query.toString()}`);
    },

    async getUserHistory(
        playerId: string,
        pagination?: PaginationParams
    ): Promise<PlayerMatchHistoryDTO> {
        const params = new URLSearchParams();
        if (pagination?.page !== undefined) params.append('page', pagination.page.toString());
        if (pagination?.size !== undefined) params.append('size', pagination.size.toString());

        const query = params.toString() ? `?${params.toString()}` : '';
        return apiClient.get<PlayerMatchHistoryDTO>(`/user/${playerId}/history${query}`);
    },

    async getUserHistorySummary(
        playerId: string,
        pagination?: PaginationParams
    ): Promise<PlayerMatchSummaryDTO> {
        const params = new URLSearchParams();
        if (pagination?.page !== undefined) params.append('page', pagination.page.toString());
        if (pagination?.size !== undefined) params.append('size', pagination.size.toString());

        const query = params.toString() ? `?${params.toString()}` : '';
        return apiClient.get<PlayerMatchSummaryDTO>(`/user/${playerId}/history/summary${query}`);
    },

    async requestForget(): Promise<void> {
        await apiClient.post<void>('/user/me/request-forget');
    },

    // R-33: 200 {"gameId": "…"} while the caller is seated in a running game, else 204
    // (apiClient turns a 204 into {}).
    async getActiveGame(): Promise<string | null> {
        const body = await apiClient.get<{ gameId?: string | null }>('/user/me/active-game');
        return body?.gameId ?? null;
    }
};