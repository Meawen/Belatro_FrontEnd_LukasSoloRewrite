import { apiClient } from './api';
import type { PlayerMatchHistoryDTO, PlayerMatchSummaryDTO } from '../types/user';

export const matchHistoryService = {
    // Get user's detailed match history
    async getMatchHistory(
        playerId: string,
        page: number = 0,
        size: number = 20
    ): Promise<PlayerMatchHistoryDTO[]> {
        const params = new URLSearchParams({
            page: page.toString(),
            size: size.toString(),
        });

        const response = await apiClient.get<{ content: PlayerMatchHistoryDTO[] }>(`/user/${playerId}/history?${params}`);
        
        console.log('getMatchHistory response structure:', {
            response,
            hasContent: !!response?.content,
            responseKeys: response ? Object.keys(response) : 'response is null/undefined'
        });
        
        // Add defensive programming
        if (!response || !response.content) {
            console.error('Invalid response structure in getMatchHistory:', response);
            return [];
        }
        
        return response.content;
    },

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
        
        console.log('getMatchSummary response structure:', {
            response,
            hasContent: !!response?.content,
            responseKeys: response ? Object.keys(response) : 'response is null/undefined'
        });
        
        // Add defensive programming
        if (!response || !response.content) {
            console.error('Invalid response structure in getMatchSummary:', response);
            return [];
        }
        
        return response.content;
    }
};