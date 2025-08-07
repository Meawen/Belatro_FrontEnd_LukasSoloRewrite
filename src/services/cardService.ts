// Simple card service that works with your R2 bucket
export const cardService = {
    // Base URL for your R2 bucket - FIXED: Added /v1/ path
    baseUrl: 'https://pub-35c6a55a85654bcaa462dcc5f31c7c71.r2.dev/v1',

    // Convert card suit/rank to filename format
    getCardFileName(suit: string, rank: string): string {
        // Convert to the expected format: "Herc 10.png", "Herc As.png", etc.
        return `${suit} ${rank}.png`;
    },

    // Get direct URL to card image
    getCardImageUrl(suit: string, rank: string): string {
        const fileName = this.getCardFileName(suit, rank);
        return `${this.baseUrl}/${encodeURIComponent(fileName)}`;
    },

    // Alternative method that takes a card object
    getCardImageUrlFromCard(card: { suit: string; rank: string }): string {
        return this.getCardImageUrl(card.suit, card.rank);
    },

    // Get card back URL - supports CardBack1.png, CardBack2.png, CardBack3.png
    getCardBackUrl(backNumber: number = 1): string {
        if (backNumber < 1 || backNumber > 3) {
            console.warn(`Invalid card back number: ${backNumber}. Using CardBack1.`);
            backNumber = 1;
        }
        return `${this.baseUrl}/CardBack${backNumber}.png`;
    },

    // Method that takes a combined key like "HERC_AS"
    getCardImageUrlFromKey(cardKey: string): string {
        const [suit, rank] = cardKey.split('_');
        return this.getCardImageUrl(suit, rank);
    },

    // Check if image exists (optional - returns a promise)
    async checkImageExists(suit: string, rank: string): Promise<boolean> {
        try {
            const url = this.getCardImageUrl(suit, rank);
            const response = await fetch(url, { method: 'HEAD' });
            return response.ok;
        } catch {
            return false;
        }
    },

    // Get all possible card combinations (useful for preloading)
    getAllCardUrls(): string[] {
        const suits = ['Herc', 'Karo', 'Pik', 'Tref']; // Hearts, Diamonds, Spades, Clubs
        // FIXED: Updated to match your bucket files - using 'Decko' and 'Baba' (no accents)
        const ranks = ['7', '8', '9', '10', 'Decko', 'Baba', 'Kralj', 'As']; // 7, 8, 9, 10, Jack, Queen, King, Ace

        const urls: string[] = [];
        for (const suit of suits) {
            for (const rank of ranks) {
                urls.push(this.getCardImageUrl(suit, rank));
            }
        }

        // Add card backs
        for (let i = 1; i <= 3; i++) {
            urls.push(this.getCardBackUrl(i));
        }

        return urls;
    }
};