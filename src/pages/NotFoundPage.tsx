import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AppShell } from '../components/layout/AppShell';
import { Page } from '../components/layout/Page';
import { PublicFrame } from '../components/layout/PublicFrame';
import { Button } from '../components/ui';

const TITLE = 'Page not found';

/**
 * Any path no route knows (spec §4.16): inside the shell with "Go home" when signed in, in the public
 * frame with "Sign in" when not. Nothing for the moment the stored session is read.
 */
export function NotFoundPage() {
    const { isAuthenticated, isLoading } = useAuth();
    const navigate = useNavigate();
    if (isLoading) return null;

    const missing = <p className="t-body text-text-2">The page you're looking for doesn't exist.</p>;

    if (!isAuthenticated) {
        return (
            <PublicFrame title={TITLE}>
                {missing}
                <div className="mt-6">
                    <Button onClick={() => navigate('/login')}>Sign in</Button>
                </div>
            </PublicFrame>
        );
    }

    return (
        <AppShell>
            <Page title={TITLE} width="read">
                {missing}
                <div className="mt-6">
                    <Button onClick={() => navigate('/dashboard')}>Go home</Button>
                </div>
            </Page>
        </AppShell>
    );
}
