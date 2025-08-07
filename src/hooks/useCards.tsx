import { useState, useCallback } from 'react';
import { cardService } from '../services/cardService';

interface CardImageCache {
    [cardKey: string]: {
        url: string;
        loaded: boolean;
        error: boolean;
    };
}

export function useCards() {
    const [cache, setCache] = useState<CardImageCache>({});
    const [preloadProgress, setPreloadProgress] = useState(0);
    const [isPreloading, setIsPreloading] = useState(false);

    // Generate cache key from suit and rank
    const getCacheKey = useCallback((suit: string, rank: string) => {
        return `${suit}_${rank}`;
    }, []);

    // Generate cache key for card backs
    const getCardBackCacheKey = useCallback((backNumber: number) => {
        return `CARD_BACK_${backNumber}`;
    }, []);

    // Get card image URL - main method you'll use
    const getCardImageUrl = useCallback((suit: string, rank: string) => {
        return cardService.getCardImageUrl(suit, rank);
    }, []);

    // Alternative method that takes card object
    const getCardImageUrlFromCard = useCallback((card: { suit: string; rank: string }) => {
        return cardService.getCardImageUrlFromCard(card);
    }, []);

    // Get card back URL
    const getCardBackUrl = useCallback((backNumber: number = 1) => {
        return cardService.getCardBackUrl(backNumber);
    }, []);

    // Check if image is loaded/cached
    const isImageLoaded = useCallback((suit: string, rank: string) => {
        const key = getCacheKey(suit, rank);
        return cache[key]?.loaded || false;
    }, [cache, getCacheKey]);

    // Check if card back is loaded/cached
    const isCardBackLoaded = useCallback((backNumber: number) => {
        const key = getCardBackCacheKey(backNumber);
        return cache[key]?.loaded || false;
    }, [cache, getCardBackCacheKey]);

    // Check if image has error
    const hasImageError = useCallback((suit: string, rank: string) => {
        const key = getCacheKey(suit, rank);
        return cache[key]?.error || false;
    }, [cache, getCacheKey]);

    // Check if card back has error
    const hasCardBackError = useCallback((backNumber: number) => {
        const key = getCardBackCacheKey(backNumber);
        return cache[key]?.error || false;
    }, [cache, getCardBackCacheKey]);

    // Preload a single image
    const preloadImage = useCallback((suit: string, rank: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            const key = getCacheKey(suit, rank);
            const url = getCardImageUrl(suit, rank);

            // Return immediately if already loaded
            if (cache[key]?.loaded) {
                resolve();
                return;
            }

            const img = new Image();

            img.onload = () => {
                setCache(prev => ({
                    ...prev,
                    [key]: { url, loaded: true, error: false }
                }));
                resolve();
            };

            img.onerror = () => {
                setCache(prev => ({
                    ...prev,
                    [key]: { url, loaded: false, error: true }
                }));
                reject(new Error(`Failed to load image: ${url}`));
            };

            img.src = url;
        });
    }, [cache, getCacheKey, getCardImageUrl]);

    // Preload a single card back
    const preloadCardBack = useCallback((backNumber: number): Promise<void> => {
        return new Promise((resolve, reject) => {
            const key = getCardBackCacheKey(backNumber);
            const url = getCardBackUrl(backNumber);

            // Return immediately if already loaded
            if (cache[key]?.loaded) {
                resolve();
                return;
            }

            const img = new Image();

            img.onload = () => {
                setCache(prev => ({
                    ...prev,
                    [key]: { url, loaded: true, error: false }
                }));
                resolve();
            };

            img.onerror = () => {
                setCache(prev => ({
                    ...prev,
                    [key]: { url, loaded: false, error: true }
                }));
                reject(new Error(`Failed to load card back: ${url}`));
            };

            img.src = url;
        });
    }, [cache, getCardBackCacheKey, getCardBackUrl]);

    // Preload all card images including backs
    const preloadAllImages = useCallback(async () => {
        setIsPreloading(true);
        setPreloadProgress(0);

        const suits = ['Herc', 'Karo', 'Pik', 'Tref'];
        // FIXED: Updated to match your bucket files - using 'Decko' and 'Baba' (no accents)
        const ranks = ['7', '8', '9', '10', 'Decko', 'Baba', 'Kralj', 'As'];

        const totalCards = suits.length * ranks.length + 3; // +3 for card backs
        let loadedCards = 0;

        // Preload regular cards
        const cardPromises = suits.flatMap(suit =>
            ranks.map(async (rank) => {
                try {
                    await preloadImage(suit, rank);
                } catch (error) {
                    console.warn(`Failed to preload ${suit} ${rank}:`, error);
                } finally {
                    loadedCards++;
                    setPreloadProgress((loadedCards / totalCards) * 100);
                }
            })
        );

        // Preload card backs
        const backPromises = [1, 2, 3].map(async (backNumber) => {
            try {
                await preloadCardBack(backNumber);
            } catch (error) {
                console.warn(`Failed to preload CardBack${backNumber}:`, error);
            } finally {
                loadedCards++;
                setPreloadProgress((loadedCards / totalCards) * 100);
            }
        });

        await Promise.allSettled([...cardPromises, ...backPromises]);
        setIsPreloading(false);
        console.log('Card preloading complete');
    }, [preloadImage, preloadCardBack]);

    // Get a card component with error handling
    const getCardImage = useCallback((suit: string, rank: string, className = '', alt?: string) => {
        const url = getCardImageUrl(suit, rank);
        const key = getCacheKey(suit, rank);
        const hasError = cache[key]?.error;

        if (hasError) {
            // Return a placeholder for failed images
            return (
                <div className={`bg-gray-200 border border-gray-400 flex items-center justify-center ${className}`}>
                    <div className="text-center text-xs text-gray-600">
                        <div>{rank}</div>
                        <div>{suit}</div>
                    </div>
                </div>
            );
        }

        return (
            <img
                src={url}
                alt={alt || `${rank} of ${suit}`}
                className={className}
                onError={() => {
                    console.warn(`Failed to load card image: ${url}`);
                    setCache(prev => ({
                        ...prev,
                        [key]: { url, loaded: false, error: true }
                    }));
                }}
                onLoad={() => {
                    setCache(prev => ({
                        ...prev,
                        [key]: { url, loaded: true, error: false }
                    }));
                }}
            />
        );
    }, [getCardImageUrl, getCacheKey, cache]);

    // Get a card back component with error handling
    const getCardBackImage = useCallback((backNumber: number = 1, className = '', alt?: string) => {
        const url = getCardBackUrl(backNumber);
        const key = getCardBackCacheKey(backNumber);
        const hasError = cache[key]?.error;

        if (hasError) {
            // Return a placeholder for failed images
            return (
                <div className={`bg-blue-200 border border-blue-400 flex items-center justify-center ${className}`}>
                    <div className="text-center text-xs text-blue-600">
                        <div>Card</div>
                        <div>Back</div>
                    </div>
                </div>
            );
        }

        return (
            <img
                src={url}
                alt={alt || `Card Back ${backNumber}`}
                className={className}
                onError={() => {
                    console.warn(`Failed to load card back image: ${url}`);
                    setCache(prev => ({
                        ...prev,
                        [key]: { url, loaded: false, error: true }
                    }));
                }}
                onLoad={() => {
                    setCache(prev => ({
                        ...prev,
                        [key]: { url, loaded: true, error: false }
                    }));
                }}
            />
        );
    }, [getCardBackUrl, getCardBackCacheKey, cache]);

    // Clear cache
    const clearCache = useCallback(() => {
        setCache({});
    }, []);

    return {
        // Main methods for getting card URLs
        getCardImageUrl,
        getCardImageUrlFromCard,
        getCardBackUrl,

        // Preloading
        preloadImage,
        preloadCardBack,
        preloadAllImages,
        preloadProgress,
        isPreloading,

        // Status checking
        isImageLoaded,
        isCardBackLoaded,
        hasImageError,
        hasCardBackError,

        // React component helpers
        getCardImage,
        getCardBackImage,

        // Cache management
        clearCache,

        // Direct service access
        cardService,
    };
}