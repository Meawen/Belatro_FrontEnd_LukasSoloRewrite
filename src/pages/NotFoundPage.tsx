import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AppShell } from '../components/layout/AppShell';
import { Page } from '../components/layout/Page';
import { PublicFrame } from '../components/layout/PublicFrame';
import { Button } from '../components/ui';
import { useT } from '../i18n/t';

/**
 * Any path no route knows (spec §4.16): inside the shell with "Go home" when signed in, in the public
 * frame with the way to the landing page when not (R4 review). Nothing for the moment the stored session is read.
 */
export function NotFoundPage() {
    const { isAuthenticated, isGuest, isLoading } = useAuth();
    const navigate = useNavigate();
    const t = useT();
    if (isLoading) return null;

    const missing = <p className="t-body text-text-2">{t.notFound.body}</p>;

    if (!isAuthenticated) {
        return (
            <PublicFrame title={t.titles.notFound}>
                {missing}
                <div className="mt-6">
                    <Button onClick={() => navigate('/')}>{t.notFound.goStart}</Button>
                </div>
            </PublicFrame>
        );
    }

    return (
        <AppShell>
            <Page title={t.titles.notFound} width="read">
                {missing}
                <div className="mt-6">
                    {/* Ruling 79: a guest has no Doma (/dashboard bounces a guest to /), so its way out is the start page */}
                    {isGuest
                        ? <Button onClick={() => navigate('/')}>{t.notFound.goStart}</Button>
                        : <Button onClick={() => navigate('/dashboard')}>{t.notFound.goHome}</Button>}
                </div>
            </Page>
        </AppShell>
    );
}
