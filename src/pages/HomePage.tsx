import { useNavigate } from 'react-router-dom';
import { Page } from '../components/layout/Page';
import { MatchRow } from '../components/match/MatchRow';
import { Button, Loader, Panel, PixelIcon } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useMatchSummary } from '../hooks/useMatchHistory';
import { useUser } from '../hooks/useUser';

/** How many of the newest matches Home lists (spec §4.4: `size=3`). */
export const RECENT_MATCHES = 3;

function Stat({ label, value, testId }: { label: string; value: number | string; testId: string }) {
    return (
        <Panel padding="none" className="px-4 py-3">
            <dt className="t-caption text-text-2">{label}</dt>
            <dd data-testid={testId} className="t-score mt-1 tabular-nums">
                {value}
            </dd>
        </Panel>
    );
}

/** /dashboard, titled "Home": the launcher (spec §4.4; D-26). */
export function HomePage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    // GET /user/{id}: the player's own numbers, "—" where the API gives none (R-34)
    const { user: profile } = useUser(user?.id ?? undefined);
    const { matchSummary, error: matchesError } = useMatchSummary(user?.id, 0, RECENT_MATCHES);
    const elo = profile?.eloRating ?? '—';
    // a new player is level 0 in the database and Level 1 on every screen
    const level = profile ? profile.level || 1 : '—';

    let recent;
    if (matchesError) {
        recent = <p className="t-callout text-text-2">Couldn't load your recent matches.</p>;
    } else if (!matchSummary) {
        recent = <Loader layout="inline" text="Loading matches..." className="self-start" />;
    } else if (matchSummary.length === 0) {
        recent = <p className="t-callout text-text-2">No matches yet</p>;
    } else {
        recent = (
            <ul className="flex flex-col gap-2">
                {matchSummary.map((summary, index) => (
                    <li key={summary.matchId ?? index}>
                        <MatchRow summary={summary} />
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <Page title="Home" heading={`Hi, ${user?.username || 'Player'}`}>
            <div className="flex flex-col gap-4">
                <div className="grid gap-4 lg:grid-cols-2">
                    <Panel as="section" padding="lg" className="flex flex-col items-start gap-4">
                        <h2 className="t-title">Ranked</h2>
                        <p className="flex items-baseline gap-2">
                            <span className="t-callout text-text-2">Elo</span>
                            <span className="t-score tabular-nums">{elo}</span>
                        </p>
                        <Button onClick={() => navigate('/play')} leftIcon={<PixelIcon name="play" />}>
                            Play ranked
                        </Button>
                    </Panel>
                    <Panel as="section" padding="lg" className="flex flex-col items-start gap-4">
                        <h2 className="t-title">Lobbies</h2>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={() => navigate('/lobbies')} leftIcon={<PixelIcon name="list" />}>
                                Open lobbies
                            </Button>
                            <Button variant="secondary" onClick={() => navigate('/lobbies?create=1')} leftIcon={<PixelIcon name="plus" />}>
                                Create lobby
                            </Button>
                        </div>
                    </Panel>
                </div>

                <div className="grid items-start gap-4 lg:grid-cols-2">
                    <dl className="grid grid-cols-3 gap-2">
                        <Stat label="Elo" value={elo} testId="dashboard-elo" />
                        <Stat label="Games" value={profile?.gamesPlayed ?? '—'} testId="dashboard-games" />
                        <Stat label="Level" value={level} testId="dashboard-level" />
                    </dl>
                    <section className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="t-title">Recent matches</h2>
                            <Button variant="quiet" size="sm" onClick={() => navigate('/matches')}>
                                All matches
                            </Button>
                        </div>
                        {recent}
                    </section>
                </div>

                <Panel as="section" className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="t-headline">New to bela?</h2>
                    <Button variant="secondary" onClick={() => navigate('/rules')} leftIcon={<PixelIcon name="book" />}>
                        Read Guide
                    </Button>
                </Panel>
            </div>
        </Page>
    );
}
