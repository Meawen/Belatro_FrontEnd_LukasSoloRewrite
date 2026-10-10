import React, { useState } from 'react';
import { faceUrl } from '../../services/cardArt';
import type { Boja, GameCard, Rank } from '../../types/game';

interface PlayingCardProps {
    suit: string;
    rank: string;
    className?: string;
    style?: React.CSSProperties;
}

// The art's display names (after normalising below) → the wire card that services/cardArt names files by
const BOJA_OF: Record<string, Boja> = { Herc: 'HERC', Karo: 'KARA', Pik: 'PIK', Tref: 'TREF' };
const RANK_OF: Record<string, Rank> = {
    '7': 'SEDMICA', '8': 'OSMICA', '9': 'DEVETKA', '10': 'DESETKA', Decko: 'DECKO', Baba: 'BABA', Kralj: 'KRALJ', As: 'AS',
};

export const PlayingCard: React.FC<PlayingCardProps> = ({ suit, rank, className = '', style }) => {
    // Normalize suit names from backend format to frontend format
    const normalizeSuit = (suit: string) => {
        switch (suit.toLowerCase()) {
            case 'herc': return 'Herc';
            case 'kara':
            case 'karo': return 'Karo';
            case 'pik': return 'Pik';
            case 'tref': return 'Tref';
            default: return suit;
        }
    };

    // Normalize rank names from backend format to frontend format
    const normalizeRank = (rank: string) => {
        switch (rank.toLowerCase()) {
            case 'sedmica': return '7';
            case 'osmica': return '8';
            case 'devetka': return '9';
            case 'desetka':
            case 'desetica': return '10';
            case 'decko': return 'Decko';
            case 'baba': return 'Baba';
            case 'kralj': return 'Kralj';
            case 'as': return 'As';
            default: return rank;
        }
    };

    const normalizedSuit = normalizeSuit(suit);
    const normalizedRank = normalizeRank(rank);
    const boja = BOJA_OF[normalizedSuit];
    const cardRank = RANK_OF[normalizedRank];
    const card: GameCard | null = boja && cardRank ? { boja, rank: cardRank } : null;
    const url = card ? faceUrl(card) : null;
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const alt = `${normalizedRank} of ${normalizedSuit}`;

    return (
        <div className={className} style={style}>
            {url && failedUrl !== url ? (
                <img src={url} alt={alt} className="w-full h-full pixelated" onError={() => setFailedUrl(url)} />
            ) : (
                // spec §3.6: a failed image shows the card's name, never a broken image
                <div role="img" aria-label={alt} className="w-full h-full flex items-center justify-center text-center notch bg-text text-ink t-caption px-1">
                    {normalizedRank} {normalizedSuit}
                </div>
            )}
        </div>
    );
};
