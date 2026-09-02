import { apiClient } from './api';
import type {
    User,
    UserDto,
    ChangePasswordRequest,
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

    async changePassword(request: ChangePasswordRequest): Promise<void> {
        await apiClient.post<void>('/user/me/password', request, { keepTokenOn401: true });
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