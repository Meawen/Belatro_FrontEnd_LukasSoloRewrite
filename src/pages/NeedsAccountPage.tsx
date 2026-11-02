import { useLocation, useNavigate } from 'react-router-dom';
import { Page } from '../components/layout/Page';
import { LanguageSection } from '../components/settings/LanguageSection';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { Button, EmptyState, Panel } from '../components/ui';
import { useT } from '../i18n/t';
import { useBotGame } from '../hooks/useBotGame';
import { useSignupStatus } from '../hooks/useSignupStatus';

/** The member-only areas a guest can reach (spec §3.3); each is a page title (titles.*), which names it. */
export type LockedArea = 'home' | 'ranked' | 'tables' | 'matches' | 'friends' | 'leaderboard' | 'profile' | 'settings';

/**
 * What a guest sees in place of a member-only page (spec §3.3, §8). The page's own name, what it is, and that a free
 * account unlocks it. Then two ways on:
 * - sign up, the primary one: /signup becomes the waitlist when signup is full (Ruling 6), and this button then says
 *   so; it comes back here after;
 * - a game against three bots at once (spec §6).
 * Settings keeps its language section, which a guest may use.
 */
export function NeedsAccountPage({ area }: { area: LockedArea }) {
    const t = useT();
    const navigate = useNavigate();
    const { pathname, search } = useLocation();
    // spec §6: the one-click bot game, shared with Doma and the landing page
    const bots = useBotGame();
    const signup = useSignupStatus();

    const c = t.guest.needsAccount;
    return (
        <Page title={t.titles[area]} width="read">
            <div className="flex flex-col gap-4">
                <Panel>
                    <EmptyState
                        icon="lock"
                        title={c.title}
                        body={<>{c.what[area]} {c.unlock}</>}
                        action={
                            <>
                                <Button onClick={() => navigate('/signup', { state: { from: pathname + search } })}>{signup === 'full' ? t.auth.waitlist.title : c.signUp}</Button>
                                <Button variant="secondary" loading={bots.starting} onClick={() => void bots.play()}>{c.bots}</Button>
                            </>
                        }
                    />
                    <ErrorAlert message={bots.error} className="mx-4 mb-6" />
                </Panel>
                {area === 'settings' && <LanguageSection />}
            </div>
        </Page>
    );
}
