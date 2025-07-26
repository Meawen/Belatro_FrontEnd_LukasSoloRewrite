import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { useAuth } from '../../hooks';

export type AuthMode = 'login' | 'signup';

export interface AuthPageProps {
    initialMode?: AuthMode;
    redirectTo?: string;
    onSuccess?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
                                                      initialMode = 'login',
                                                      redirectTo = '/',
                                                      onSuccess,
                                                  }) => {
    const [mode, setMode] = useState<AuthMode>(initialMode);
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    // Redirect if already authenticated
    React.useEffect(() => {
        if (isAuthenticated) {
            navigate(redirectTo);
        }
    }, [isAuthenticated, navigate, redirectTo]);

    const handleSuccess = () => {
        if (onSuccess) {
            onSuccess();
        } else {
            navigate(redirectTo);
        }
    };

    const handleSwitchMode = () => {
        setMode(mode === 'login' ? 'signup' : 'login');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="text-6xl mb-4">🃏</div>
                    <h1 className="text-3xl font-bold text-white mb-2">Belatro</h1>
                    <p className="text-slate-400">The Ultimate Card Game Experience</p>
                </div>

                {/* Auth Forms */}
                {mode === 'login' ? (
                    <LoginForm
                        onSuccess={handleSuccess}
                        onSwitchToSignup={handleSwitchMode}
                    />
                ) : (
                    <SignupForm
                        onSuccess={handleSuccess}
                        onSwitchToLogin={handleSwitchMode}
                    />
                )}

                {/* Footer */}
                <div className="text-center mt-8 text-slate-500 text-sm">
                    <p>&copy; 2024 Belatro. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
};