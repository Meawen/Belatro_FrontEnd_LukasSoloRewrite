import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Page } from '../components/layout/Page';
import { LanguageSection } from '../components/settings/LanguageSection';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { Button, EmptyState, Panel } from '../components/ui';
import { ApiError } from '../services/api';
import { startBotGame } from '../services/botGame';
import { errorMessage, isNetworkOrServerFailure } from '../utils/errorMessage';
import { cat, useT } from '../i18n/t';

/** The member-only areas a guest can reach (spec §3.3); each is a page title (titles.*), which names it. */
export type LockedArea = 'home' | 'ranked' | 'tables' | 'matches' | 'friends' | 'leaderboard' | 'profile' | 'settings';

/** Why the bot game didn't start, worded as LobbyRoom's botFailure words it: no answer or a 5xx means the bots are away. */
function botGameFailure(e: unknown): string {
    return e instanceof ApiError && isNetworkOrServerFailure(e.status) ? cat().table.botsUnavailable : errorMessage(e, cat().errors.generic);
}

/**
 * What a guest sees in place of a member-only page (spec §3.3, §8). The page's own name, what it is, and that a free
 * account unlocks it. Then two ways on:
 * - sign up, the primary one: /signup becomes the waitlist when signup is full (Ruling 6), and comes back here after;
 * - a game against three bots at once (spec §6).
 * Settings keeps its language section, which a guest may use.
 */
export function NeedsAccountPage({ area }: { area: LockedArea }) {
    const t = useT();
    const navigate = useNavigate();
    const { pathname, search } = useLocation();
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const playBots = async () => {
        setStarting(true);
        setError(null);
        try {
            const { gameId } = await startBotGame();
            navigate(`/game/${gameId}`);
        } catch (e) {
            setError(botGameFailure(e));
            setStarting(false);
        }
    };

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
                                <Button onClick={() => navigate('/signup', { state: { from: pathname + search } })}>{c.signUp}</Button>
                                <Button variant="secondary" loading={starting} onClick={() => void playBots()}>{c.bots}</Button>
                            </>
                        }
                    />
                    <ErrorAlert message={error} className="mx-4 mb-6" />
                </Panel>
                {area === 'settings' && <LanguageSection />}
            </div>
        </Page>
    );
}
