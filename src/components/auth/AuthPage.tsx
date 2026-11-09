import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { AuthFrame } from './AuthFrame';
import { useReturnState } from './returnState';
import { useAuth } from '../../hooks/useAuth';
import { ErrorAlert } from '../common/ErrorAlert';
import { safeReturnPath } from '../../routing/returnPath';
import { cat, useT } from '../../i18n/t';
import { authService } from '../../services/authService';
import { getLang } from '../../i18n/lang';
import { Button } from '../ui';
import { ApiError } from '../../services/api';
import { errorMessage, isNetworkOrServerFailure } from '../../utils/errorMessage';

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
    const { isAuthenticated, isGuest } = useAuth();
    const t = useT();
    // services/gameSocket sends a tab here after the server closed its socket for good
    const [searchParams] = useSearchParams();
    const sessionEnded = searchParams.get('reason') === 'session-ended';
    const [sitting, setSitting] = useState(false);
    const [doorError, setDoorError] = useState<string | null>(null);

    // Redirect if already authenticated (but not during processing); a guest may sign in or sign up (spec §3.3)
    useEffect(() => {
        if (isAuthenticated && !isGuest && !isProcessing) {
            navigate(redirectTo);
        }
    }, [isAuthenticated, isGuest, navigate, redirectTo, isProcessing]);

    // spec §3.2: a friend's table link (/lobby/…) brought a visitor with no session here; they may sit down as a guest
    const tablePath = initialMode === 'login' && !isAuthenticated && typeof returnState?.from === 'string'
        && /^\/lobby\/[^/?#]+/.test(returnState.from) ? safeReturnPath(returnState.from) : null;

    const sitDown = async () => {
        if (!tablePath) return;
        setSitting(true);
        setDoorError(null);
        try {
            await authService.startGuest(getLang());
            navigate(tablePath);
        } catch (e) {
            setDoorError(e instanceof ApiError && isNetworkOrServerFailure(e.status) ? cat().errors.generic : errorMessage(e, cat().errors.generic));
            setSitting(false);
        }
    };

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
            <ErrorAlert message={sessionEnded ? t.auth.signIn.sessionEnded : null} className="mb-5" />
            {/* R4 review (US-6, §8): someone with no account who follows a friend's table link most likely sits down as a
                guest, so the door comes first and is the page's primary; signing in is the secondary way below it */}
            {tablePath && (
                <div className="mb-6 flex flex-col items-center gap-3 border-b-2 border-edge pb-6 text-center">
                    {/* R1-01 (Ruling 79): the door opens the page, so the page's one h1 is its own; the sign-in heading is an h2 */}
                    <h1 className="t-title">{t.guest.tableDoor.heading}</h1>
                    <p className="t-callout text-text-2">{t.guest.tableDoor.lead}</p>
                    <Button block loading={sitting} onClick={() => void sitDown()}>{t.guest.tableDoor.sitDown}</Button>
                    <ErrorAlert message={doorError} />
                </div>
            )}
            {initialMode === 'login'
                ? <LoginForm onSuccess={handleSuccess} submitVariant={tablePath ? 'secondary' : 'primary'} headingLevel={tablePath ? 2 : 1} />
                : <SignupForm onSuccess={handleSuccess} />}
        </AuthFrame>
    );
}
