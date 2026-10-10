import React, { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { useAuth } from '../../hooks/useAuth';
import { ErrorAlert } from '../common';
import { SESSION_ENDED_MESSAGE } from '../../services/gameSocket';
import { LegalLinks } from '../layout/LegalLinks';
import { safeReturnPath } from '../../routing/returnPath';

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
    const [isProcessing, setIsProcessing] = useState(false);
    const navigate = useNavigate();
    // ProtectedRoute's { from }: the page a signed-out visitor asked for (D-20)
    const from = (useLocation().state as { from?: unknown } | null)?.from;
    const { isAuthenticated } = useAuth();
    // services/gameSocket sends a tab here after the server closed its socket for good
    const [searchParams] = useSearchParams();
    const sessionEnded = searchParams.get('reason') === 'session-ended';

    // Redirect if already authenticated (but not during processing)
    React.useEffect(() => {
        if (isAuthenticated && !isProcessing) {
            navigate(redirectTo);
        }
    }, [isAuthenticated, navigate, redirectTo, isProcessing]);

    const handleSuccess = async () => {
        setIsProcessing(true);

        // Small delay to ensure auth state is updated
        await new Promise(resolve => setTimeout(resolve, 100));

        if (onSuccess) {
            onSuccess();
        } else {
            navigate(from === undefined ? redirectTo : safeReturnPath(from));
        }
    };

    const handleSwitchMode = () => {
        if (!isProcessing) {
            setMode(mode === 'login' ? 'signup' : 'login');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="text-6xl mb-4">🃏</div>
                    <h1 className="text-3xl font-bold text-white mb-2">Stiglja</h1>
                    <p className="text-slate-400">The Ultimate Card Game Experience</p>
                </div>

                <ErrorAlert message={sessionEnded ? SESSION_ENDED_MESSAGE : null} className="mb-4" />

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
                    <p>&copy; {new Date().getFullYear()} Stiglja. All rights reserved.</p>
                    <LegalLinks className="justify-center mt-3 text-slate-400" />
                </div>
            </div>
        </div>
    );
};