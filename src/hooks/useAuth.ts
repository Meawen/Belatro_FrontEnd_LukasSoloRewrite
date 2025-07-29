
import { useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import { useMutation } from './useApi';
import type {
    LoginRequestDTO,
    SignupRequestDTO,
    JwtResponseDTO,
    UserLoginDetailsDTO,
} from '../types';

interface AuthState {
    user: UserLoginDetailsDTO | null; // Changed from User to UserLoginDetailsDTO
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

    // Initialize auth state on mount - only once
    useEffect(() => {
        let isMounted = true;

        const initializeAuth = async () => {
            console.log('Initializing auth state...');
            const isAuthenticated = authService.isAuthenticated();
            console.log('Is authenticated:', isAuthenticated);

            if (isAuthenticated) {
                try {
                    // Check if we have stored user data
                    const storedUser = localStorage.getItem('user');
                    if (storedUser && isMounted) {
                        const user = JSON.parse(storedUser);
                        console.log('Found stored user:', user);
                        setAuthState({
                            user,
                            isAuthenticated: true,
                            isLoading: false,
                            error: null,
                        });
                    } else if (isMounted) {
                        // Token exists but no user data - this shouldn't happen normally
                        console.log('Token exists but no user data found');
                        setAuthState({
                            user: null,
                            isAuthenticated: true,
                            isLoading: false,
                            error: null,
                        });
                    }
                } catch (error) {
                    console.error('Error initializing auth:', error);
                    if (isMounted) {
                        // Token might be invalid
                        authService.logout();
                        localStorage.removeItem('user');
                        localStorage.removeItem('authToken');
                        setAuthState({
                            user: null,
                            isAuthenticated: false,
                            isLoading: false,
                            error: null,
                        });
                    }
                }
            } else if (isMounted) {
                console.log('Not authenticated, setting initial state');
                setAuthState({
                    user: null,
                    isAuthenticated: false,
                    isLoading: false,
                    error: null,
                });
            }
        };

        initializeAuth();

        return () => {
            isMounted = false;
        };
    }, []); // Empty dependency array - only run once

    const login = useCallback(async (credentials: LoginRequestDTO): Promise<JwtResponseDTO> => {
        console.log('Login function called with:', credentials);
        try {
            setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

            const response = await loginMutation.mutate(credentials);
            console.log('Login response:', response);

            // Store user data in localStorage
            if (response.user) {
                localStorage.setItem('user', JSON.stringify(response.user));
                console.log('User data stored in localStorage');
            }

            setAuthState({
                user: response.user,
                isAuthenticated: true,
                isLoading: false,
                error: null,
            });

            console.log('Login successful, auth state updated');
            return response;
        } catch (error) {
            console.error('Login failed:', error);
            setAuthState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Login failed',
                isLoading: false,
            }));
            throw error;
        }
    }, [loginMutation]);

    const signup = useCallback(async (userData: SignupRequestDTO): Promise<JwtResponseDTO> => {
        console.log('Signup function called with:', userData);
        try {
            setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

            const response = await signupMutation.mutate(userData);
            console.log('Signup response:', response);

            // Store user data in localStorage
            if (response.user) {
                localStorage.setItem('user', JSON.stringify(response.user));
                console.log('User data stored in localStorage');
            }

            setAuthState({
                user: response.user,
                isAuthenticated: true,
                isLoading: false,
                error: null,
            });

            console.log('Signup successful, auth state updated');
            return response;
        } catch (error) {
            console.error('Signup failed:', error);
            setAuthState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Signup failed',
                isLoading: false,
            }));
            throw error;
        }
    }, [signupMutation]);

    const logout = useCallback(async () => {
        console.log('Logout function called');
        try {
            await logoutMutation.mutate(undefined);
        } catch (error) {
            // Even if logout fails on server, clear local state
            console.error('Logout request failed:', error);
        } finally {
            // Always clear ALL auth-related local storage items
            localStorage.removeItem('user');
            localStorage.removeItem('authToken');

            setAuthState({
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error: null,
            });

            console.log('Logout completed, all local state cleared');

            // Force page refresh to ensure clean state
            window.location.href = '/';
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