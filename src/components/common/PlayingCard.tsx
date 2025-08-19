import React from 'react';
import { useCards } from '../../hooks/useCards';

interface PlayingCardProps {
    suit: string;
    rank: string;
    className?: string;
    style?: React.CSSProperties;
}

export const PlayingCard: React.FC<PlayingCardProps> = ({ suit, rank, className = '', style }) => {
    const { getCardImage } = useCards();

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

    return (
        <div className={className} style={style}>
            {getCardImage(normalizedSuit, normalizedRank, 'w-full h-full rounded-lg shadow-lg')}
        </div>
    );
};