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

    async getAllUsers(): Promise<User[]> {
        return apiClient.get<User[]>('/user/findAll');
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
    }
};