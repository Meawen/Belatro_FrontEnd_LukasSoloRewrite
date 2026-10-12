import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserList } from '../components/profile/UserList';
import { AppShell } from '../components/layout/AppShell';
import { Page } from '../components/layout/Page';
import { PublicFrame } from '../components/layout/PublicFrame';
import { Button, EmptyState, Panel } from '../components/ui';

const TITLE = 'Leaderboard';

/**
 * /users (spec §4.12), readable without a session: the leaderboard inside the shell when signed in;
 * signed out, today's prompt in the public frame (M-13). Nothing for the moment the session is read.
 */
export function LeaderboardPage() {
    const { isAuthenticated, isLoading } = useAuth();
    const navigate = useNavigate();
    if (isLoading) return null;

    if (!isAuthenticated) {
        return (
            <PublicFrame title={TITLE}>
                <Panel>
                    <EmptyState
                        icon="lock"
                        title="Authentication Required"
                        body="Please log in to view the user leaderboard."
                        action={
                            <>
                                <Button onClick={() => navigate('/login')}>Login</Button>
                                <Button variant="secondary" onClick={() => navigate('/signup')}>Sign Up</Button>
                            </>
                        }
                    />
                </Panel>
            </PublicFrame>
        );
    }

    return (
        <AppShell>
            <Page title={TITLE}>
                <UserList />
            </Page>
        </AppShell>
    );
}
