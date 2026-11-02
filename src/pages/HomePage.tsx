import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Page } from '../components/layout/Page';
import { MatchRow } from '../components/match/MatchRow';
import { Button, Chip, Loader, Panel, PixelIcon } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useMatchSummary } from '../hooks/useMatchHistory';
import { ME_CHANGED, useMe, useUser } from '../hooks/useUser';
import { RankChip } from '../components/rank/RankChip';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { ResendConfirmationButton } from '../components/auth/ResendConfirmationButton';
import { useActiveGame } from '../hooks/useActiveGame';
import { useBotGame } from '../hooks/useBotGame';
import { lobbyService } from '../services/lobbyService';
import { useT } from '../i18n/t';
import { formatLongDate } from '../i18n/format';

/** How many of the newest matches Home lists (spec §4.4: `size=3`). */
export const RECENT_MATCHES = 3;

function Stat({ label, value, testId, extra }: { label: string; value: number | string; testId: string; extra?: ReactNode }) {
    return (
        <Panel padding="none" className="px-4 py-3">
            <dt className="t-caption text-text-2">{label}</dt>
            <dd data-testid={testId} className="t-score mt-1 tabular-nums">
                {value}
            </dd>
            {extra && <dd className="mt-1.5">{extra}</dd>}
        </Panel>
    );
}

/**
 * /dashboard, Doma (spec §5, option B): the game in progress, then two halves, against bots and against people, each
 * with one primary action; then the stats, the recent matches and the way to Škola bele.
 */
export function HomePage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const t = useT();
    const botsId = useId();
    const peopleId = useId();
    const lockId = useId();
    // GET /user/{id}: a member's own numbers; a guest never reaches Doma (MemberRoute sends them to /), so never a guest's 403 (B4)
    const { user: profile } = useUser(user?.id ?? undefined);
    // GET /user/me: whether the address is confirmed, for the ranked lock
    const { data: me, refetch: refetchMe } = useMe();
    // Ruling 48, as UnverifiedEmailBanner: asked again when this tab may have changed its answer (Settings, a resend
    // that finds nothing to confirm), so the lock follows the address. refetch is a new function on every render; the
    // listener registers once
    const refetchMeRef = useRef(refetchMe);
    refetchMeRef.current = refetchMe;
    useEffect(() => {
        const onMeChanged = () => {
            refetchMeRef.current().catch(() => {});
        };
        window.addEventListener(ME_CHANGED, onMeChanged);
        return () => window.removeEventListener(ME_CHANGED, onMeChanged);
    }, []);
    const { gameId, recheck } = useActiveGame();
    const bots = useBotGame({ onAlreadyInGame: recheck });
    // "Birtija (n)": the open tables the Birtija lists (GET /lobbies/open; hidden bot tables are never in it), asked once;
    // no count when it fails
    const [openTables, setOpenTables] = useState<number | null>(null);
    useEffect(() => {
        let current = true;
        lobbyService.getAllOpenLobbies().then(
            (lobbies) => {
                if (current && Array.isArray(lobbies)) setOpenTables(lobbies.length);
            },
            () => {},
        );
        return () => {
            current = false;
        };
    }, []);
    const { matchSummary, error: matchesError } = useMatchSummary(user?.id, 0, RECENT_MATCHES);
    const elo = profile?.eloRating ?? '—';
    // a new player is level 0 in the database and Level 1 on every screen
    const level = profile ? profile.level || 1 : '—';
    // spec §5: ranked needs a confirmed address; while GET /user/me loads nothing is locked (PlayPage handles the 403)
    const locked = me != null && !me.emailVerified;
    const address = me ? me.pendingEmail ?? me.email : null;
    // spec §2.1 (US-26): the day an unconfirmed account goes, as in the banner, on the first screen after signing up
    const removeDay = formatLongDate(me?.verifyBy ?? '');
    const removal = removeDay ? t.shell.unverified.removeBy(removeDay) : null;

    let recent;
    if (matchesError) {
        recent = <p className="t-callout text-text-2">{t.home.recent.failed}</p>;
    } else if (!matchSummary) {
        recent = <Loader layout="inline" text={t.home.recent.loading} className="self-start" />;
    } else if (matchSummary.length === 0) {
        recent = <p className="t-callout text-text-2">{t.home.recent.none}</p>;
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
        <Page title={t.titles.home} heading={user?.username ? t.home.greeting(user.username) : t.home.greetingNoName}>
            <div className="flex flex-col gap-4">
                {/* spec §5: the game in progress above the halves */}
                {gameId && (
                    <Panel as="section" edge="accent" aria-label={t.shell.activeGame.label} className="flex flex-wrap items-center justify-between gap-3">
                        <p className="t-body">{t.shell.activeGame.body}</p>
                        <Button onClick={() => navigate(`/game/${gameId}`)} leftIcon={<PixelIcon name="play" />}>
                            {t.shell.activeGame.action}
                        </Button>
                    </Panel>
                )}

                <div className="grid gap-4 lg:grid-cols-2">
                    <Panel as="section" padding="lg" aria-labelledby={botsId} className="flex flex-col items-start gap-4">
                        <h2 id={botsId} className="t-title">{t.home.bots.title}</h2>
                        <p className="t-callout text-text-2">{t.home.bots.body}</p>
                        <ul aria-label={t.home.bots.seats} className="flex flex-wrap gap-2">
                            <li><Chip tone="you">{t.common.you}</Chip></li>
                            <li><Chip icon="robot">{t.home.bots.bot}</Chip></li>
                            <li><Chip icon="robot">{t.home.bots.bot}</Chip></li>
                            <li><Chip icon="robot">{t.home.bots.bot}</Chip></li>
                        </ul>
                        <Button leftIcon={<PixelIcon name="play" />} loading={bots.starting} onClick={() => void bots.play()}>
                            {t.home.bots.play}
                        </Button>
                        <ErrorAlert message={bots.error} />
                    </Panel>
                    <Panel as="section" padding="lg" aria-labelledby={peopleId} className="flex flex-col items-start gap-4">
                        <h2 id={peopleId} className="t-title">{t.home.people.title}</h2>
                        <p className="t-callout text-text-2">{t.home.people.body}</p>
                        <Button
                            leftIcon={<PixelIcon name="play" />}
                            disabled={locked}
                            aria-describedby={locked ? lockId : undefined}
                            onClick={() => navigate('/play')}
                        >
                            {t.home.people.ranked}
                        </Button>
                        {locked && (
                            // the banner's sentences and resend (UnverifiedEmailBanner gives way here)
                            <div id={lockId} className="flex flex-col items-start gap-2">
                                <p className="t-callout flex items-start gap-2 text-text-2">
                                    <PixelIcon name="lock" className="mt-0.5" />
                                    <span>{address ? t.shell.unverified.confirm(address) : t.shell.unverified.noAddress}{removal && <>{' '}{removal}</>}</span>
                                </p>
                                {address ? (
                                    <ResendConfirmationButton />
                                ) : (
                                    <Link to="/settings" className="inline-flex min-h-11 items-center font-semibold text-accent underline underline-offset-2">
                                        {t.shell.unverified.openSettings}
                                    </Link>
                                )}
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" leftIcon={<PixelIcon name="lock" />} onClick={() => navigate('/lobbies?create=private')}>
                                {t.home.people.private}
                            </Button>
                            <Button variant="secondary" leftIcon={<PixelIcon name="list" />} onClick={() => navigate('/lobbies')}>
                                {openTables === null ? t.titles.tables : t.home.people.tables(openTables)}
                            </Button>
                        </div>
                    </Panel>
                </div>

                <div className="grid items-start gap-4 lg:grid-cols-2">
                    <dl className="grid grid-cols-3 gap-2">
                        {/* "Elo" stays as on the profile */}
                        <Stat label="Elo" value={elo} testId="dashboard-elo" extra={profile?.rank && <RankChip rank={profile.rank} />} />
                        <Stat label={t.home.stats.games} value={profile?.gamesPlayed ?? '—'} testId="dashboard-games" />
                        <Stat label={t.common.level} value={level} testId="dashboard-level" />
                    </dl>
                    <section className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="t-title">{t.home.recent.title}</h2>
                            <Button variant="quiet" size="sm" onClick={() => navigate('/matches')}>
                                {t.home.recent.all}
                            </Button>
                        </div>
                        {recent}
                    </section>
                </div>

                <Panel as="section" className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="t-headline">{t.home.newToBela.title}</h2>
                    <Button variant="secondary" onClick={() => navigate('/learn')} leftIcon={<PixelIcon name="book" />}>
                        {t.home.newToBela.action}
                    </Button>
                </Panel>
            </div>
        </Page>
    );
}
