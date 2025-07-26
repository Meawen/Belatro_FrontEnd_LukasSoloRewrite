
import { apiClient } from './api';

export const cardService = {
    async getCardImage(cardKey: string): Promise<Uint8Array> {
        const response = await apiClient.get<string[]>(`/api/cards/${cardKey}/image`);
        // Convert base64 string array to Uint8Array
        const bytes = response.map(byte => parseInt(byte, 10));
        return new Uint8Array(bytes);
    },

    // Helper method to get card image URL for <img> tags
    getCardImageUrl(cardKey: string): string {
        return `${import.meta.env.VITE_API_BASE_URL || 'https://belatro'}/api/cards/${cardKey}/image`;
    }
};