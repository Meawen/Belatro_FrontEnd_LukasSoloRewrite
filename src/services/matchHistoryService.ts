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

        return apiClient.get(`/user/${playerId}/history?${params}`);
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

        return apiClient.get(`/user/${playerId}/history/summary?${params}`);
    }
};