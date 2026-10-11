import { useId, type ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useUser } from '../../hooks/useUser';
import { isNotFound, useLadder } from '../../hooks/useRatings';
import { Button, Loader, Panel, Tag } from '../ui';
import { cx } from '../ui/cx';
import { aheadPercent } from './ladderGeometry';
import { LadderChart } from './LadderChart';
import { PLACEMENT_GAMES, placedRanks } from './rankNames';

/** Under this many placed players the ladder says it is filling in instead of drawing (ranks spec §7.2). */
export const LADDER_MIN_PLAYERS = 5;

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/** The ladder above the leaderboard (ranks spec §7): everyone placed, by rating, coloured by rank, you marked. */
export function LadderPanel() {
    const titleId = useId();
    const { user } = useAuth();
    const { user: me } = useUser(user?.id ?? undefined);
    const { data: ladder, isLoading, error, refetch } = useLadder();
    // a backend before team Elo has no ladder: no panel at all (§4.2)
    if (isNotFound(error)) return null;

    let content: ReactNode;
    if (!ladder) {
        content = error ? (
            <div className="flex flex-wrap items-center gap-3">
                <p className="t-callout text-text-2">Couldn't load the ladder.</p>
                <Button variant="secondary" size="sm" onClick={() => refetch().catch(() => {})}>
                    Try again
                </Button>
            </div>
        ) : (
            <Loader layout="inline" text="Loading the ladder…" className="self-start" />
        );
    } else if (ladder.players < LADDER_MIN_PLAYERS) {
        content = <p className="t-callout text-text-2">The ladder fills in as players finish their first 10 ranked games.</p>;
    } else {
        const rank = me?.rank;
        const placed = !!rank && rank.key !== 'CUCEK' && me?.eloRating != null;
        const placing = ladder.ranks.find((r) => r.key === 'CUCEK')?.count ?? 0;
        let yourLine: string | null = null;
        if (placed) {
            yourLine = `Ahead of ${aheadPercent(ladder, me!.eloRating!)}% of ranked players`;
        } else if (rank?.key === 'CUCEK') {
            const left = PLACEMENT_GAMES - (me?.rankedGamesPlayed ?? 0);
            if (left > 0) yourLine = `Play ${plural(left, 'more ranked game', 'more ranked games')} to join the ladder.`;
        }
        content = (
            <>
                {/* a refetch keeps the chart on screen, dimmed, until the answer lands (no skeleton) */}
                <div data-holding className={cx('transition-opacity motion-reduce:transition-none', isLoading && 'opacity-60')}>
                    <LadderChart ladder={ladder} you={placed ? me!.eloRating! : null} />
                </div>
                {yourLine && <p className="t-callout">{yourLine}</p>}
                <ul aria-label="Players per rank" className="flex flex-wrap gap-x-4 gap-y-2">
                    {placedRanks(ladder).map((r) => (
                        <li key={r.key} className="flex items-center gap-1.5">
                            <Tag tone="rank" rank={r.key}>
                                {r.name}
                            </Tag>
                            <span className="t-footnote tabular-nums text-text-2">{r.count}</span>
                        </li>
                    ))}
                </ul>
                {placing > 0 && <p className="t-footnote text-text-2">{plural(placing, 'player still placing', 'players still placing')}</p>}
            </>
        );
    }

    return (
        <Panel as="section" aria-labelledby={titleId} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id={titleId} className="t-title">
                    The ladder
                </h2>
                {ladder && <p className="t-footnote tabular-nums text-text-2">{plural(ladder.players, 'ranked player', 'ranked players')}</p>}
            </div>
            {content}
        </Panel>
    );
}
