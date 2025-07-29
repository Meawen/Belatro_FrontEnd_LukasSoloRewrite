import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiError } from '../services';

interface UseApiState<T> {
    data: T | null;
    isLoading: boolean;
    error: ApiError | null;
}

interface UseApiOptions {
    immediate?: boolean;
    dependencies?: any[];
    staleTime?: number; // Cache data for X milliseconds
}

export function useApi<T>(
    apiFunction: () => Promise<T>,
    options: UseApiOptions = {}
) {
    const { immediate = true, dependencies = [], staleTime = 30000 } = options; // 30s default stale time
    const isMountedRef = useRef(true);
    const lastFetchRef = useRef<number>(0);
    const cacheRef = useRef<T | null>(null);

    const [state, setState] = useState<UseApiState<T>>({
        data: null,
        isLoading: false,
        error: null,
    });

    const execute = useCallback(async (force = false): Promise<T | undefined> => {
        if (!isMountedRef.current) return;

        const now = Date.now();
        const isStale = now - lastFetchRef.current > staleTime;

        // If we have cached data and it's not stale, use it unless forced
        if (!force && cacheRef.current && !isStale) {
            if (state.data !== cacheRef.current) {
                setState({ data: cacheRef.current, isLoading: false, error: null });
            }
            return cacheRef.current;
        }

        // Show cached data immediately if we have it, but still fetch fresh data
        if (cacheRef.current && !state.data) {
            setState(prev => ({ ...prev, data: cacheRef.current, isLoading: true, error: null }));
        } else {
            setState(prev => ({ ...prev, isLoading: true, error: null }));
        }

        try {
            const result = await apiFunction();
            if (isMountedRef.current) {
                cacheRef.current = result;
                lastFetchRef.current = now;
                setState({ data: result, isLoading: false, error: null });
            }
            return result;
        } catch (error) {
            if (isMountedRef.current) {
                const apiError = error instanceof ApiError ? error : new ApiError({
                    message: error instanceof Error ? error.message : 'Unknown error',
                    status: 0
                });
                // Keep cached data on error, just show error state
                setState(prev => ({
                    data: prev.data || cacheRef.current,
                    isLoading: false,
                    error: apiError
                }));
            }
            throw error;
        }
    }, [apiFunction, staleTime, state.data]);

    const reset = useCallback(() => {
        if (isMountedRef.current) {
            cacheRef.current = null;
            lastFetchRef.current = 0;
            setState({ data: null, isLoading: false, error: null });
        }
    }, []);

    // Effect for initial execution
    useEffect(() => {
        if (immediate && isMountedRef.current) {
            execute().catch(() => {}); // Ignore errors in effect
        }
    }, [immediate, execute, ...dependencies]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    return {
        ...state,
        execute,
        reset,
        refetch: () => execute(true), // Force fresh data
    };
}

export function useMutation<T, TVariables = void>(
    mutationFunction: (variables: TVariables) => Promise<T>
) {
    const isMountedRef = useRef(true);
    const [state, setState] = useState<UseApiState<T>>({
        data: null,
        isLoading: false,
        error: null,
    });

    const mutate = useCallback(async (variables: TVariables): Promise<T> => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const result = await mutationFunction(variables);

            if (isMountedRef.current) {
                setState({ data: result, isLoading: false, error: null });
            }

            return result;
        } catch (error) {
            if (isMountedRef.current) {
                const apiError = error instanceof ApiError ? error : new ApiError({
                    message: error instanceof Error ? error.message : 'Unknown error',
                    status: 0
                });
                setState(prev => ({ ...prev, isLoading: false, error: apiError }));
            }
            throw error;
        }
    }, [mutationFunction]);

    const reset = useCallback(() => {
        if (isMountedRef.current) {
            setState({ data: null, isLoading: false, error: null });
        }
    }, []);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    return {
        ...state,
        mutate,
        reset,
    };
}