import { useId, useMemo, type ReactNode } from 'react';
import type { Ladder, PlayerRank } from '../../types/user';
import { isNotFound, useRatingHistory } from '../../hooks/useRatings';
import { Button, Loader, Panel } from '../ui';
import { cx } from '../ui/cx';
import { ClimbChart } from './ClimbChart';
import { climbBands } from './climbGeometry';
import { forecastLines } from './forecastText';
import { nextRankName } from './rankNames';

export interface ClimbPanelProps {
    userId: string;
    /** Your rank from GET /user/{id}; without it, no target line. */
    rank: PlayerRank | null | undefined;
    /** The ladder, for every rank's start and the next rank's name (R-3, R-8); null without it. */
    ladder: Ladder | null;
}

/** Your climb on your own Profile (ranks spec §8): the chart, then where this pace leads and what luck can do. */
export function ClimbPanel({ userId, rank, ladder }: ClimbPanelProps) {
    const titleId = useId();
    const { data: history, isLoading, error, refetch } = useRatingHistory(userId);
    const bands = useMemo(() => climbBands(rank, ladder), [rank, ladder]);
    // a backend before team Elo has no rating history: no section at all (§4.2)
    if (isNotFound(error)) return null;

    let content: ReactNode;
    if (!history) {
        content = error ? (
            <div className="flex flex-wrap items-center gap-3">
                <p className="t-callout text-text-2">Couldn't load your climb.</p>
                <Button variant="secondary" size="sm" onClick={() => refetch().catch(() => {})}>
                    Try again
                </Button>
            </div>
        ) : (
            <Loader layout="inline" text="Loading your climb…" className="self-start" />
        );
    } else if (history.points.length === 0) {
        content = <p className="t-callout text-text-2">Your climb starts with your first ranked game.</p>;
    } else {
        const { primary, luck } = forecastLines(history, rank, nextRankName(rank, ladder));
        content = (
            <>
                <div data-holding className={cx('transition-opacity motion-reduce:transition-none', isLoading && 'opacity-60')}>
                    <ClimbChart history={history} bands={bands} nextMinRating={rank && rank.key !== 'CUCEK' ? rank.nextMinRating : null} />
                </div>
                {primary && (
                    <p className="t-callout">
                        {primary[0]}
                        {primary[1] && <strong className="font-semibold">{primary[1]}</strong>}
                        {primary[2]}
                    </p>
                )}
                {luck && <p className="t-footnote text-text-2">{luck}</p>}
            </>
        );
    }

    return (
        <section aria-labelledby={titleId} className="flex flex-col gap-3">
            <h2 id={titleId} className="t-title">
                Your climb
            </h2>
            <Panel className="flex flex-col gap-3">{content}</Panel>
        </section>
    );
}
