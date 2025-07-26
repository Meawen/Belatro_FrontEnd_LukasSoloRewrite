import { apiClient } from './api';
import type {
    Friendship,
    CreateFriendshipDTO,
    Void,
} from '../types';

export const friendshipService = {
    async getAllFriendships(): Promise<Friendship[]> {
        return apiClient.get<Friendship[]>('/friendship/getAllFriendships');
    },

    async getFriendshipById(id: string): Promise<Friendship> {
        return apiClient.get<Friendship>(`/friendship/${id}`);
    },

    async getFriendshipsByUser(userId: string): Promise<Friendship[]> {
        return apiClient.get<Friendship[]>(`/friendship/getAllByUserId/${userId}`);
    },

    async createFriendship(friendshipData: CreateFriendshipDTO): Promise<Friendship> {
        return apiClient.post<Friendship>('/friendship', friendshipData);
    },

    async acceptFriendship(id: string): Promise<Friendship> {
        return apiClient.post<Friendship>(`/friendship/${id}/accept`);
    },

    async rejectFriendship(id: string): Promise<Friendship> {
        return apiClient.post<Friendship>(`/friendship/${id}/reject`);
    },

    async cancelFriendship(id: string): Promise<Friendship> {
        return apiClient.post<Friendship>(`/friendship/${id}/cancel`);
    },

    async deleteFriendship(id: string): Promise<Void> {
        return apiClient.delete<Void>(`/friendship/${id}`);
    }
};