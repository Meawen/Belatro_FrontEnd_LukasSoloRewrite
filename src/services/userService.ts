import { apiClient } from './api';
import type {
    User,
    UserUpdateDTO,
    PlayerMatchHistoryDTO,
    PlayerMatchSummaryDTO,
    PaginationParams,
    Void,
} from '../types';

export const userService = {
    async getUserById(id: string): Promise<User> {
        return apiClient.get<User>(`/user/${id}`);
    },

    async updateUser(id: string, userData: UserUpdateDTO): Promise<User> {
        return apiClient.put<User>(`/user/${id}`, userData);
    },

    async deleteUser(id: string): Promise<Void> {
        return apiClient.delete<Void>(`/user/${id}`);
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

    async requestForget(id: string): Promise<Void> {
        return apiClient.post<Void>(`/user/${id}/request-forget`);
    }
};