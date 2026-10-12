
import { apiClient } from './api';

export const rankedService = {
    async joinQueue(): Promise<void> {
        return apiClient.post<void>('/ranked/queue');
    },

    async leaveQueue(): Promise<void> {
        return apiClient.delete<void>('/ranked/queue');
    },

    // R-25: 200 while the match can still be declined (within 30 s, before the first bid);
    // 409 once it cannot, 403 for a player who is not seated in it
    async declineMatch(gameId: string): Promise<void> {
        return apiClient.post<void>(`/ranked/matches/${encodeURIComponent(gameId)}/decline`);
    }
};