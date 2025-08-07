
import { apiClient } from './api';

export const rankedService = {
    async joinQueue(): Promise<void> {
        return apiClient.post<void>('/ranked/queue');
    },

    async leaveQueue(): Promise<void> {
        return apiClient.delete<void>('/ranked/queue');
    }
};