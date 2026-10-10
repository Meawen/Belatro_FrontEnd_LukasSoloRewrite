import type { ReactNode } from 'react';
import { m } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Page } from '../layout/Page';
import { Avatar, Button, EmptyState, ErrorState, Loader, Panel, PixelIcon, Tag } from '../ui';
import type { IconName } from '../ui';
import { cx } from '../ui/cx';
import { spring } from '../../motion/tokens';
import { useAuth } from '../../hooks/useAuth';
import type { HandDTO, MatchDTO } from '../../types/match';
import type { UserSimpleDTO } from '../../types/user';
import { matchOutcome, type MatchOutcome } from './MatchRow';
import { parseMatchResult, yourResult } from './matchResult';
import { matchesPath, pageFromState } from './matchesPath';
import { useMatchDetails } from './useMatchDetails';

/** "h:mm:ss" from an hour on, else "m:ss"; "Unknown" without both times (today's Match Details rule). */
export function formatDuration(startTime: string | null, endTime: string | null): string {
    if (!startTime || !endTime) return 'Unknown';
    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    const hours = Math.floor(durationMs / 3_600_000);
    const minutes = Math.floor((durationMs % 3_600_000) / 60_000);
    const seconds = Math.floor((durationMs % 60_000) / 1000);
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
}

// The result colour on the hero's tile and title (spec §4.9), as on the list's rows; text pairs on --surface
const TONE: Record<MatchOutcome, { tile: string; word: string; icon: IconName }> = {
    win: { tile: 'bg-success/20 text-success', word: 'text-success', icon: 'check' },
    loss: { tile: 'bg-danger/20 text-danger-text', word: 'text-danger-text', icon: 'x' },
    draw: { tile: 'bg-accent/20 text-accent', word: 'text-accent', icon: 'more' },
};

/** Item 1: the result icon, the result as the page's h1, "Match ID: {last 12}", the mode, "{n} Players". */
function Hero({ match, result }: { match: MatchDTO; result: string | null }) {
    const outcome = matchOutcome(result);
    const tone = outcome ? TONE[outcome] : null;
    const players = (match.teamA?.length ?? 0) + (match.teamB?.length ?? 0);
    return (
        <Panel as="section" padding="lg" className="flex flex-wrap items-center gap-4">
            <span className={cx('notch grid size-15 shrink-0 place-items-center', tone?.tile ?? 'bg-surface-2 text-text-2')}>
                <PixelIcon name={tone?.icon ?? 'more'} scale={3} />
            </span>
            <div className="min-w-0 flex-1">
                <h1 className={cx('t-display break-words', tone?.word ?? 'text-text')}>{result || 'Unknown Result'}</h1>
                <p className="t-footnote mt-2 flex flex-wrap items-center gap-2 text-text-2">
                    <span>{`Match ID: ${match.id?.slice(-12) || 'Unknown'}`}</span>
                    <Tag tone={match.gameMode === 'RANKED' ? 'mode' : 'neutral'}>{match.gameMode || 'Unknown'}</Tag>
                </p>
            </div>
            <p className="flex items-baseline gap-2">
                <span className="t-score-xl tabular-nums">{players}</span> <span className="t-callout text-text-2">Players</span>
            </p>
        </Panel>
    );
}

/** Item 2: one stat tile. */
function Tile({ label, value, numeric = true }: { label: string; value: ReactNode; numeric?: boolean }) {
    return (
        <Panel padding="none" className="px-4 py-3">
            <dt className="t-caption text-text-2">{label}</dt>
            <dd className={cx('mt-1 tabular-nums', numeric ? 't-score' : 't-headline')}>{value}</dd>
        </Panel>
    );
}

/** Item 3: "Team A" / "Team B", "{n} members", each member's avatar and name, YOU on mine. */
function TeamPanel({ team, members, myId }: { team: 'A' | 'B'; members: UserSimpleDTO[]; myId: string | null | undefined }) {
    return (
        <Panel as="section" aria-label={`Team ${team}`}>
            <div className="flex items-center gap-3">
                <span aria-hidden="true" className={cx('notch grid size-9 place-items-center t-headline text-ink', team === 'A' ? 'bg-team-a' : 'bg-team-b')}>
                    {team}
                </span>
                <div>
                    <h2 className="t-headline">Team {team}</h2>
                    <p className="t-footnote text-text-3">{members.length} members</p>
                </div>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5">
                {members.map((player, index) => {
                    const me = !!myId && player.id === myId;
                    return (
                        <li key={player.id ?? index} className={cx('notch flex items-center gap-3 bg-bg px-2 py-2', me && 'shadow-[inset_0_0_0_2px_var(--accent)]')}>
                            <Avatar initial={player.username || '?'} tone={team === 'A' ? 'team-a' : 'team-b'} size="sm" />
                            <span className="t-callout min-w-0 truncate">{player.username || 'Unknown'}</span>
                            {me && <span className="t-caption text-accent">YOU</span>}
                        </li>
                    );
                })}
            </ul>
        </Panel>
    );
}

/** A team's final score: the number alone in `final-a` / `final-b`, then its label (spec §7.4 reads both). */
function FinalScore({ team, score, decl }: { team: 'A' | 'B'; score: number; decl: number }) {
    return (
        <div>
            <div data-testid={team === 'A' ? 'final-a' : 'final-b'} className={cx('t-score-xl tabular-nums', team === 'A' ? 'text-team-a' : 'text-team-b')}>
                {score}
            </div>
            <div className="t-footnote">Team {team} Final</div>
            {decl > 0 && <div className="t-footnote text-text-3">{decl} decl</div>}
        </div>
    );
}

/** Item 4: the final scores from `result` (R-36) with the match's declarations; a forfeit says so. */
function MatchSummary({ result, hands }: { result: string; hands: HandDTO[] | null }) {
    const scores = parseMatchResult(result);
    const decl = (team: 'A' | 'B') =>
        (hands ?? []).reduce((sum, hand) => sum + ((team === 'A' ? hand.handSummary?.teamADeclPoints : hand.handSummary?.teamBDeclPoints) || 0), 0);
    let body: ReactNode;
    if (scores === 'forfeit') {
        // a forfeit result carries no points (R-36)
        body = (
            <div className="text-center">
                <p className="t-headline">Won by forfeit</p>
                <p className="t-footnote mt-1 text-text-2">{result}</p>
            </div>
        );
    } else if (scores) {
        body = (
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
                <FinalScore team="A" score={scores.teamAScore} decl={decl('A')} />
                <p className="t-callout max-w-40 text-text-2">{result}</p>
                <FinalScore team="B" score={scores.teamBScore} decl={decl('B')} />
            </div>
        );
    } else {
        body = <p className="t-callout text-center text-text-2">{result}</p>;
    }
    return (
        <Panel as="section" aria-label="Match summary">
            <h2 className="t-title mb-3">Match summary</h2>
            {body}
        </Panel>
    );
}

/**
 * Match details, /matches/:id (spec §4.9; D-29): one match on its own page, pushed from the right. Every
 * feature of the old Match Details modal is kept. "‹ Match History" and "Back to Match History" return to
 * the list page the row was on (its router state), else to page 1.
 */
export function MatchDetails({ id }: { id: string }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const listPath = matchesPath(pageFromState(useLocation().state));
    const details = useMatchDetails(id);
    const match = details.loading || details.failed ? null : details.match;
    const toList = <Button onClick={() => navigate(listPath)}>Back to Match History</Button>;

    let content: ReactNode;
    if (details.loading) {
        content = <Loader text="Loading match…" />;
    } else if (details.failed) {
        content = (
            <Panel>
                <ErrorState title="Couldn't load this match" action={<Button variant="secondary" onClick={details.retry}>Try again</Button>} />
            </Panel>
        );
    } else if (!match) {
        content = (
            <Panel>
                <EmptyState icon="info" title="Match data is not available" action={toList} />
            </Panel>
        );
    } else {
        const { hands } = details;
        content = (
            <div className="flex flex-col gap-3">
                <Hero match={match} result={yourResult(match, user?.id)} />
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Tile label="Duration" value={formatDuration(match.startTime, match.endTime)} />
                    <Tile label="Mode" value={match.gameMode || 'Unknown'} numeric={false} />
                    <Tile label="Hands" value={hands ? hands.length : '—'} />
                    <Tile label="Tricks" value={hands ? hands.reduce((total, hand) => total + (hand.tricks?.length ?? 0), 0) : '—'} />
                </dl>
                <div className="grid gap-3 md:grid-cols-2">
                    <TeamPanel team="A" members={match.teamA ?? []} myId={user?.id} />
                    <TeamPanel team="B" members={match.teamB ?? []} myId={user?.id} />
                </div>
                {match.result && <MatchSummary result={match.result} hands={hands} />}
                <div className="flex justify-end">{toList}</div>
            </div>
        );
    }

    return (
        // pushed from the right (spec §3.8 spring.ui; a fade under reduced motion); the clip keeps the slide
        // from scrolling the page sideways
        <div className="overflow-x-clip">
            <m.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={spring.ui}>
                <Page title="Match details" heading={match ? null : undefined} back={{ to: listPath, label: 'Match History' }}>
                    {content}
                </Page>
            </m.div>
        </div>
    );
}
