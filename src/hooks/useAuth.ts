import { useState, useEffect, useCallback } from 'react';
import { authService } from '../services';
import { useMutation } from './useApi';
import type {LoginRequestDTO, SignupRequestDTO, User} from '../types';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
}

export function useAuth() {
    const [authState, setAuthState] = useState<AuthState>({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        error: null,
    });

    const loginMutation = useMutation(authService.login);
    const signupMutation = useMutation(authService.signup);
    const logoutMutation = useMutation(authService.logout);

    // Initialize auth state on mount
    useEffect(() => {
        const initializeAuth = async () => {
            const isAuthenticated = authService.isAuthenticated();

            if (isAuthenticated) {
                try {
                    // You'll need to implement getCurrentUser or similar
                    // For now, we'll just set authenticated without user data
                    setAuthState({
                        user: null, // You'd fetch user data here
                        isAuthenticated: true,
                        isLoading: false,
                        error: null,
                    });
                } catch (error) {
                    // Token might be invalid
                    authService.logout();
                    setAuthState({
                        user: null,
                        isAuthenticated: false,
                        isLoading: false,
                        error: null,
                    });
                }
            } else {
                setAuthState({
                    user: null,
                    isAuthenticated: false,
                    isLoading: false,
                    error: null,
                });
            }
        };

        initializeAuth();
    }, []);

    const login = useCallback(async (credentials: LoginRequestDTO) => {
        try {
            const response = await loginMutation.mutate(credentials);
            setAuthState({
                user: null, // You'd set user data from response
                isAuthenticated: true,
                isLoading: false,
                error: null,
            });
            return response;
        } catch (error) {
            setAuthState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Login failed',
                isLoading: false,
            }));
            throw error;
        }
    }, [loginMutation]);

    const signup = useCallback(async (userData: SignupRequestDTO) => {
        try {
            const response = await signupMutation.mutate(userData);
            setAuthState({
                user: null, // You'd set user data from response
                isAuthenticated: true,
                isLoading: false,
                error: null,
            });
            return response;
        } catch (error) {
            setAuthState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Signup failed',
                isLoading: false,
            }));
            throw error;
        }
    }, [signupMutation]);

    const logout = useCallback(async () => {
        try {
            await logoutMutation.mutate(undefined);
            setAuthState({
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error: null,
            });
        } catch (error) {
            // Even if logout fails on server, clear local state
            setAuthState({
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error: null,
            });
        }
    }, [logoutMutation]);

    return {
        ...authState,
        login,
        signup,
        logout,
        isLoginLoading: loginMutation.isLoading,
        isSignupLoading: signupMutation.isLoading,
        isLogoutLoading: logoutMutation.isLoading,
    };
}