import { useState, useEffect, useCallback } from 'react';
import { ApiError } from '../services';

interface UseApiState<T> {
    data: T | null;
    isLoading: boolean;
    error: ApiError | null;
}

interface UseApiOptions {
    immediate?: boolean;
}

export function useApi<T>(
    apiFunction: () => Promise<T>,
    options: UseApiOptions = {}
) {
    const { immediate = true } = options;

    const [state, setState] = useState<UseApiState<T>>({
        data: null,
        isLoading: false,
        error: null,
    });

    const execute = useCallback(async () => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const result = await apiFunction();
            setState({ data: result, isLoading: false, error: null });
            return result;
        } catch (error) {
            const apiError = error instanceof ApiError ? error : new ApiError({
                message: error instanceof Error ? error.message : 'Unknown error',
                status: 0
            });
            setState({ data: null, isLoading: false, error: apiError });
            throw apiError;
        }
    }, [apiFunction]);

    const reset = useCallback(() => {
        setState({ data: null, isLoading: false, error: null });
    }, []);

    useEffect(() => {
        if (immediate) {
            execute();
        }
    }, [execute, immediate]);

    return {
        ...state,
        execute,
        reset,
        refetch: execute,
    };
}

export function useMutation<T, TVariables = void>(
    mutationFunction: (variables: TVariables) => Promise<T>
) {
    const [state, setState] = useState<UseApiState<T>>({
        data: null,
        isLoading: false,
        error: null,
    });

    const mutate = useCallback(async (variables: TVariables) => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const result = await mutationFunction(variables);
            setState({ data: result, isLoading: false, error: null });
            return result;
        } catch (error) {
            const apiError = error instanceof ApiError ? error : new ApiError({
                message: error instanceof Error ? error.message : 'Unknown error',
                status: 0
            });
            setState(prev => ({ ...prev, isLoading: false, error: apiError }));
            throw apiError;
        }
    }, [mutationFunction]);

    const reset = useCallback(() => {
        setState({ data: null, isLoading: false, error: null });
    }, []);

    return {
        ...state,
        mutate,
        reset,
    };
}