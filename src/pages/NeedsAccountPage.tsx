import { useLocation, useNavigate } from 'react-router-dom';
import { Page } from '../components/layout/Page';
import { LanguageSection } from '../components/settings/LanguageSection';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { Button, EmptyState, Panel } from '../components/ui';
import { GoogleSignIn } from '../components/auth/GoogleButton';
import { useT } from '../i18n/t';
import { useBotGame } from '../hooks/useBotGame';
import { useSignupStatus } from '../hooks/useSignupStatus';
import { safeReturnPath } from '../routing/returnPath';
import { googleClientId } from '../services/googleSignIn';

/** The member-only areas a guest can reach (spec §3.3); each is a page title (titles.*), which names it. */
export type LockedArea = 'home' | 'ranked' | 'tables' | 'matches' | 'friends' | 'leaderboard' | 'profile' | 'settings';

/**
 * What a guest sees in place of a member-only page (spec §3.3, §8). The page's own name, what it is, and that a free
 * account unlocks it. Then two ways on:
 * - sign up, the primary one: /signup becomes the waitlist when signup is full (Ruling 6), and this button then says
 *   so; it comes back here after;
 * - a game against three bots at once (spec §6);
 * - Google's button (Google sign-in spec §2) while /signup would show its form (P-2: not while signup is full, A-8), with
 *   this page as the return path.
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
    const here = pathname + search;
    // P-2, S2 A-8: where /signup would show its form; with no client id, no button and no line for one (spec §2)
    const google = (signup === 'open' || signup === 'unknown') && googleClientId() !== null;
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
                                <Button onClick={() => navigate('/signup', { state: { from: here } })}>{signup === 'full' ? t.auth.waitlist.title : c.signUp}</Button>
                                <Button variant="secondary" loading={bots.starting} onClick={() => void bots.play()}>{c.bots}</Button>
                                {google && (
                                    <div className="w-full">
                                        <GoogleSignIn
                                            // A-7: this page's route, the shell and its guest navigation read the session
                                            // when they mounted, so the member's page is a full load of the same address
                                            onSignedIn={() => window.location.assign(safeReturnPath(here))}
                                            returnTo={{ from: here }}
                                            divider={false}
                                        />
                                    </div>
                                )}
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
