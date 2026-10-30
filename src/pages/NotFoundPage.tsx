import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AppShell } from '../components/layout/AppShell';
import { Page } from '../components/layout/Page';
import { PublicFrame } from '../components/layout/PublicFrame';
import { Button } from '../components/ui';
import { useT } from '../i18n/t';

/**
 * Any path no route knows (spec §4.16): inside the shell with "Go home" when signed in, in the public
 * frame with "Sign in" when not. Nothing for the moment the stored session is read.
 */
export function NotFoundPage() {
    const { isAuthenticated, isLoading } = useAuth();
    const navigate = useNavigate();
    const t = useT();
    if (isLoading) return null;

    const missing = <p className="t-body text-text-2">{t.notFound.body}</p>;

    if (!isAuthenticated) {
        return (
            <PublicFrame title={t.titles.notFound}>
                {missing}
                <div className="mt-6">
                    <Button onClick={() => navigate('/login')}>{t.common.signIn}</Button>
                </div>
            </PublicFrame>
        );
    }

    return (
        <AppShell>
            <Page title={t.titles.notFound} width="read">
                {missing}
                <div className="mt-6">
                    <Button onClick={() => navigate('/dashboard')}>{t.notFound.goHome}</Button>
                </div>
            </Page>
        </AppShell>
    );
}
