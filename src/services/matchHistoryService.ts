import { apiClient } from './api';
import type { PlayerMatchSummaryDTO } from '../types/user';

export const matchHistoryService = {
    // Get user's match summary
    async getMatchSummary(
        playerId: string,
        page: number = 0,
        size: number = 20
    ): Promise<PlayerMatchSummaryDTO[]> {
        const params = new URLSearchParams({
            page: page.toString(),
            size: size.toString(),
        });

        const response = await apiClient.get<{ content: PlayerMatchSummaryDTO[] }>(`/user/${playerId}/history/summary?${params}`);
        
        // Add defensive programming
        if (!response || !response.content) {
            console.error('Invalid response structure in getMatchSummary:', response);
            return [];
        }
        
        return response.content;
    }
};
