import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { AuthFrame } from './AuthFrame';
import { useReturnState } from './returnState';
import { useAuth } from '../../hooks/useAuth';
import { ErrorAlert } from '../common/ErrorAlert';
import { SESSION_ENDED_MESSAGE } from '../../services/gameSocket';
import { safeReturnPath } from '../../routing/returnPath';

export type AuthMode = 'login' | 'signup';

export interface AuthPageProps {
    /** The form this URL shows: /login signs in, /signup creates an account (X-2: switching is a link). */
    initialMode?: AuthMode;
    redirectTo?: string;
    onSuccess?: () => void;
}

/** /login and /signup (spec §4.2) on the auth frame. */
export function AuthPage({ initialMode = 'login', redirectTo = '/', onSuccess }: AuthPageProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const navigate = useNavigate();
    // ProtectedRoute's { from }, carried along every hop of the auth flow (D-20)
    const returnState = useReturnState();
    const { isAuthenticated } = useAuth();
    // services/gameSocket sends a tab here after the server closed its socket for good
    const [searchParams] = useSearchParams();
    const sessionEnded = searchParams.get('reason') === 'session-ended';

    // Redirect if already authenticated (but not during processing)
    useEffect(() => {
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
            navigate(returnState ? safeReturnPath(returnState.from) : redirectTo);
        }
    };

    return (
        <AuthFrame>
            <ErrorAlert message={sessionEnded ? SESSION_ENDED_MESSAGE : null} className="mb-5" />
            {initialMode === 'login' ? <LoginForm onSuccess={handleSuccess} /> : <SignupForm onSuccess={handleSuccess} />}
        </AuthFrame>
    );
}
