import { useState, useCallback } from 'react';
import { cardService } from '../services';

interface CardImageCache {
    [cardKey: string]: {
        data: Uint8Array;
        url: string;
    };
}

export function useCards() {
    const [cache, setCache] = useState<CardImageCache>({});
    const [loading, setLoading] = useState<Set<string>>(new Set());
    const [errors, setErrors] = useState<Set<string>>(new Set());

    const getCardImage = useCallback(async (cardKey: string) => {
        // Return cached data if available
        if (cache[cardKey]) {
            return cache[cardKey];
        }

        // Don't start multiple requests for the same card
        if (loading.has(cardKey)) {
            return null;
        }

        setLoading(prev => new Set(prev).add(cardKey));
        setErrors(prev => {
            const newErrors = new Set(prev);
            newErrors.delete(cardKey);
            return newErrors;
        });

        try {
            const imageData = await cardService.getCardImage(cardKey);
            const blob = new Blob([imageData], { type: 'image/png' });
            const url = URL.createObjectURL(blob);

            const cardImageData = { data: imageData, url };

            setCache(prev => ({
                ...prev,
                [cardKey]: cardImageData,
            }));

            setLoading(prev => {
                const newLoading = new Set(prev);
                newLoading.delete(cardKey);
                return newLoading;
            });

            return cardImageData;
        } catch (error) {
            setErrors(prev => new Set(prev).add(cardKey));
            setLoading(prev => {
                const newLoading = new Set(prev);
                newLoading.delete(cardKey);
                return newLoading;
            });
            throw error;
        }
    }, [cache, loading]);

    const getCardImageUrl = useCallback((cardKey: string) => {
        return cardService.getCardImageUrl(cardKey);
    }, []);

    const isLoading = useCallback((cardKey: string) => {
        return loading.has(cardKey);
    }, [loading]);

    const hasError = useCallback((cardKey: string) => {
        return errors.has(cardKey);
    }, [errors]);

    const getCachedImage = useCallback((cardKey: string) => {
        return cache[cardKey] || null;
    }, [cache]);

    const clearCache = useCallback(() => {
        // Clean up object URLs to prevent memory leaks
        Object.values(cache).forEach(({ url }) => {
            URL.revokeObjectURL(url);
        });
        setCache({});
        setErrors(new Set());
    }, [cache]);

    return {
        getCardImage,
        getCardImageUrl,
        getCachedImage,
        isLoading,
        hasError,
        clearCache,
    };
}