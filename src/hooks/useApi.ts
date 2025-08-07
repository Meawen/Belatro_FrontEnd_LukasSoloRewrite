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
    staleTime?: number;
}

export function useApi<T>(
    apiFunction: () => Promise<T>,
    options: UseApiOptions = {}
) {
    const { immediate = true, dependencies = [], staleTime = 30000 } = options;
    const isMountedRef = useRef(true);
    const lastFetchRef = useRef<number>(0);
    const cacheRef = useRef<T | null>(null);
    const apiFunctionRef = useRef(apiFunction);

    // Update the API function ref when it changes
    apiFunctionRef.current = apiFunction;

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
            // Use functional update to avoid stale state issues
            setState(prev => {
                if (prev.data !== cacheRef.current) {
                    return { data: cacheRef.current, isLoading: false, error: null };
                }
                return prev;
            });
            return cacheRef.current;
        }

        // Show cached data immediately if we have it, but still fetch fresh data
        setState(prev => ({
            data: prev.data || cacheRef.current,
            isLoading: true,
            error: null
        }));

        try {
            const result = await apiFunctionRef.current();
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
                setState(prev => ({
                    data: prev.data || cacheRef.current,
                    isLoading: false,
                    error: apiError
                }));
            }
            throw error;
        }
    }, [staleTime]); // Remove state.data and apiFunction dependencies

    const reset = useCallback(() => {
        if (isMountedRef.current) {
            cacheRef.current = null;
            lastFetchRef.current = 0;
            setState({ data: null, isLoading: false, error: null });
        }
    }, []);

    // Effect for initial execution - stable execute reference
    useEffect(() => {
        if (immediate && isMountedRef.current) {
            execute().catch(() => {});
        }
    }, [immediate, ...dependencies]); // Remove execute from dependencies

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
        refetch: () => execute(true),
    };
}

export function useMutation<T, TVariables = void>(
    mutationFunction: (variables: TVariables) => Promise<T>
) {
    const isMountedRef = useRef(true);
    const mutationRef = useRef(mutationFunction);

    // Update the mutation function ref when it changes
    mutationRef.current = mutationFunction;

    const [state, setState] = useState<UseApiState<T>>({
        data: null,
        isLoading: false,
        error: null,
    });

    const mutate = useCallback(async (variables: TVariables): Promise<T> => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const result = await mutationRef.current(variables);

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
    }, []); // No dependencies needed since we use ref

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