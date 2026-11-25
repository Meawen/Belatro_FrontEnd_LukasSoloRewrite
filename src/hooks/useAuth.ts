
import { useState, useEffect, useCallback } from 'react';
import { authService, userService } from '../services';
import { adoptAccountLang, getLang } from '../i18n/lang';
import { loadEnglish } from '../i18n/t';
import { useMutation } from './useApi';
import type {
    LoginRequestDTO,
    SignupRequestDTO,
    JwtResponseDTO,
    UserLoginDetailsDTO,
    GoogleSignInRequest,
    GoogleSignInDTO,
    GoogleSignupRequest,
} from '../types';
import { forgetSession } from '../services/guestSecret';

/**
 * A sign-in's steps once authService has stored the token (login, googleSignIn, googleSignup): the user beside it, then
 * the account's language.
 */
async function enterAccount(user: UserLoginDetailsDTO | null): Promise<void> {
    // Store user data in localStorage
    if (user) {
        localStorage.setItem('user', JSON.stringify(user));
    }

    // spec §1.1: after sign-in the account's language wins. The login response carries none
    // (UserLoginDetailsDTO is {id, username}), so it comes from GET /user/me; best effort.
    try {
        const { language } = await userService.getMe();
        // the English catalog loads on demand: it is here before the switch, so no page is half in English. One
        // that fails or takes over 3 s keeps the device's language, and a toast says so (Ruling 62)
        if (language !== 'en' || (await loadEnglish())) adoptAccountLang(language);
    } catch {
        // an older server or a failed read: the device's language stays
    }
}

interface AuthState {
    user: UserLoginDetailsDTO | null;
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

    // Get token from authService
    const getToken = useCallback(() => {
        return authService.getToken();
    }, []);

    // Initialize auth state on mount - FIXED VERSION
    useEffect(() => {
        let isMounted = true;

        const initializeAuth = () => {
            const isAuthenticated = authService.isAuthenticated();
            const token = authService.getToken();

            if (isAuthenticated && token) {
                try {
                    // Check if we have stored user data
                    const storedUser = localStorage.getItem('user');
                    if (storedUser && isMounted) {
                        const user = JSON.parse(storedUser);
                        setAuthState({
                            user,
                            isAuthenticated: true,
                            isLoading: false,
                            error: null,
                        });
                    } else if (isMounted) {
                        // Token exists but no user data - this shouldn't happen normally
                        // Clear invalid state
                        authService.logout();
                        // Ruling 44: the whole session, a guest's secret too
                        forgetSession();
                        setAuthState({
                            user: null,
                            isAuthenticated: false,
                            isLoading: false,
                            error: null,
                        });
                    }
                } catch (error) {
                    console.error('Error parsing stored user data:', error);
                    if (isMounted) {
                        // Clear invalid data
                        authService.logout();
                        forgetSession();
                        setAuthState({
                            user: null,
                            isAuthenticated: false,
                            isLoading: false,
                            error: null,
                        });
                    }
                }
            } else if (isMounted) {
                setAuthState({
                    user: null,
                    isAuthenticated: false,
                    isLoading: false,
                    error: null,
                });
            }
        };

        // Initialize synchronously to avoid timing issues
        initializeAuth();

        return () => {
            isMounted = false;
        };
    }, []); // Empty dependency array - only run once

    const login = useCallback(async (credentials: LoginRequestDTO): Promise<JwtResponseDTO> => {
        try {
            setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

            // Ruling 35: the typed name in NFC (a decomposed č is c + U+030C), the form the server stores
            const response = await loginMutation.mutate({ ...credentials, username: credentials.username?.normalize('NFC') ?? null });

            await enterAccount(response.user);

            setAuthState({
                user: response.user,
                isAuthenticated: true,
                isLoading: false,
                error: null,
            });

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

    // Google sign-in spec §1, §6.3: both Google steps store a signed-in answer's session as login does (the account's
    // language included: step 2 may sign in to an existing account, S2 A-4); an answer with no token stores nothing
    const throughGoogle = useCallback(async <T extends { token?: string | null; user?: UserLoginDetailsDTO | null }>(
        send: () => Promise<T>,
        failure: string,
    ): Promise<T> => {
        try {
            setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

            const response = await send();
            if (!response.token) {
                setAuthState(prev => ({ ...prev, isLoading: false }));
                return response;
            }

            const user = response.user ?? null;
            await enterAccount(user);
            setAuthState({
                user,
                isAuthenticated: true,
                isLoading: false,
                error: null,
            });

            return response;
        } catch (error) {
            // the error, never the request: it carries Google's token
            console.error(`${failure}:`, error);
            setAuthState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : failure,
                isLoading: false,
            }));
            throw error;
        }
    }, []);

    // step 1: signed in, or needsName (the caller keeps the credential for the name step)
    const googleSignIn = useCallback(
        (request: GoogleSignInRequest): Promise<GoogleSignInDTO> => throughGoogle(() => authService.google(request), 'Google sign-in failed'),
        [throughGoogle],
    );

    // step 2, the name step (spec §3.3): the name in NFC, as signup sends it (Ruling 35)
    const googleSignup = useCallback(
        (request: GoogleSignupRequest): Promise<JwtResponseDTO> =>
            throughGoogle(() => authService.googleSignup({ ...request, username: request.username.normalize('NFC') }), 'Google sign-up failed'),
        [throughGoogle],
    );

    const signup = useCallback(async (userData: SignupRequestDTO): Promise<JwtResponseDTO> => {
        try {
            setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

            // spec §1.1: signup records the language the site was in
            // Ruling 35: the typed name in NFC, as at sign-in
            const response = await signupMutation.mutate({
                ...userData,
                username: userData.username?.normalize('NFC') ?? null,
                language: userData.language ?? getLang(),
            });

            // Store user data in localStorage
            if (response.user) {
                localStorage.setItem('user', JSON.stringify(response.user));
            }

            setAuthState({
                user: response.user,
                isAuthenticated: true,
                isLoading: false,
                error: null,
            });

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
        try {
            await logoutMutation.mutate(undefined);
        } catch (error) {
            // Even if logout fails on server, clear local state
            console.error('Logout request failed:', error);
        } finally {
            // Always clear ALL auth-related local storage items
            // Ruling 32: a guest's sign-out ends the guest, so its secret goes too
            forgetSession();

            setAuthState({
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error: null,
            });

            // Force page refresh to ensure clean state
            window.location.assign('/');
        }
    }, [logoutMutation]);

    return {
        ...authState,
        // spec §3: the stored user of a guest carries guest: true (POST /api/auth/guest, B4); never read from the name
        // (Ruling 38)
        isGuest: authState.user?.guest === true,
        token: getToken(),
        login,
        googleSignIn,
        googleSignup,
        signup,
        logout,
        isLoginLoading: loginMutation.isLoading,
        isSignupLoading: signupMutation.isLoading,
        isLogoutLoading: logoutMutation.isLoading,
    };
}