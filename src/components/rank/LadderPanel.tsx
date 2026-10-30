import { useId, type ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useUser } from '../../hooks/useUser';
import { isNotFound, useLadder } from '../../hooks/useRatings';
import { Button, Loader, Panel, Tag } from '../ui';
import { cx } from '../ui/cx';
import { aheadPercent } from './ladderGeometry';
import { LadderChart } from './LadderChart';
import { PLACEMENT_GAMES, placedRanks, rankTagline } from './rankNames';
import { useT } from '../../i18n/t';

/** Under this many placed players the ladder says it is filling in instead of drawing (ranks spec §7.2). */
export const LADDER_MIN_PLAYERS = 5;

/** The ladder above the leaderboard (ranks spec §7): everyone placed, by rating, coloured by rank, you marked. */
export function LadderPanel() {
    const titleId = useId();
    const { user } = useAuth();
    const { user: me } = useUser(user?.id ?? undefined);
    const { data: ladder, isLoading, error, refetch } = useLadder();
    const t = useT();
    // a backend before team Elo has no ladder: no panel at all (§4.2)
    if (isNotFound(error)) return null;

    let content: ReactNode;
    if (!ladder) {
        content = error ? (
            <div className="flex flex-wrap items-center gap-3">
                <p className="t-callout text-text-2">{t.rank.ladder.loadFailed}</p>
                <Button variant="secondary" size="sm" onClick={() => refetch().catch(() => {})}>
                    {t.common.retry}
                </Button>
            </div>
        ) : (
            <Loader layout="inline" text={t.rank.ladder.loading} className="self-start" />
        );
    } else if (ladder.players < LADDER_MIN_PLAYERS) {
        content = <p className="t-callout text-text-2">{t.rank.ladder.fillsIn}</p>;
    } else {
        const rank = me?.rank;
        const placed = !!rank && rank.key !== 'CUCEK' && me?.eloRating != null;
        const placing = ladder.ranks.find((r) => r.key === 'CUCEK')?.count ?? 0;
        let yourLine: string | null = null;
        if (placed) {
            yourLine = t.rank.ladder.ahead(aheadPercent(ladder, me!.eloRating!));
        } else if (rank?.key === 'CUCEK') {
            const left = PLACEMENT_GAMES - (me?.rankedGamesPlayed ?? 0);
            if (left > 0) yourLine = t.rank.ladder.toJoin(left);
        }
        content = (
            <>
                {/* a refetch keeps the chart on screen, dimmed, until the answer lands (no skeleton) */}
                <div data-holding className={cx('transition-opacity motion-reduce:transition-none', isLoading && 'opacity-60')}>
                    <LadderChart ladder={ladder} you={placed ? me!.eloRating! : null} />
                </div>
                {yourLine && <p className="t-callout">{yourLine}</p>}
                {/* each rank with its tagline under it (owner 2026-10-11): two, three or six to a row, by the panel's width */}
                <ul aria-label={t.rank.ladder.perRank} className="grid grid-cols-2 gap-x-4 gap-y-3 @md:grid-cols-3 @2xl:grid-cols-6">
                    {placedRanks(ladder).map((r) => {
                        const tagline = rankTagline(r.key);
                        return (
                            <li key={r.key} className="flex min-w-0 flex-col items-start gap-1">
                                <span className="flex items-center gap-1.5">
                                    <Tag tone="rank" rank={r.key}>
                                        {r.name}
                                    </Tag>
                                    <span className="t-footnote tabular-nums text-text-2">{r.count}</span>
                                </span>
                                {tagline && <span className="t-footnote text-text-2">{tagline}</span>}
                            </li>
                        );
                    })}
                </ul>
                {placing > 0 && <p className="t-footnote text-text-2">{t.rank.ladder.placing(placing)}</p>}
            </>
        );
    }

    return (
        <Panel as="section" aria-labelledby={titleId} className="@container flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id={titleId} className="t-title">
                    {t.rank.ladder.title}
                </h2>
                {ladder && <p className="t-footnote tabular-nums text-text-2">{t.rank.ladder.players(ladder.players)}</p>}
            </div>
            {content}
        </Panel>
    );
}
