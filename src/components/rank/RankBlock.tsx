import type { ReactNode } from 'react';
import { m } from 'motion/react';
import type { User } from '../../types/user';
import { spring } from '../../motion/tokens';
import { RankChip } from './RankChip';
import { PLACEMENT_GAMES, rankColour } from './rankNames';

export interface RankBlockProps {
    player: User;
    /** The next rank's name from the ladder (ranks spec R-3); null prints "the next rank". */
    nextName: string | null;
}

/**
 * The profile header's rank (ranks spec §6.1): the chip and the tagline, then the way to the next rank: a thin bar
 * when the rank has a start and an end, else a line of text. Nothing without a rank.
 */
export function RankBlock({ player, nextName }: RankBlockProps) {
    const rank = player.rank;
    if (!rank) return null;
    const elo = player.eloRating;
    const next = nextName ?? 'the next rank';

    let progress: ReactNode = null;
    if (rank.key === 'CUCEK') {
        progress = <p className="t-footnote text-text-2">Placement: {player.rankedGamesPlayed ?? 0} of {PLACEMENT_GAMES} ranked games</p>;
    } else if (rank.nextMinRating === null) {
        progress = <p className="t-footnote text-text-2">Top rank</p>;
    } else if (elo !== null) {
        const gap = rank.nextMinRating - elo;
        const text = (
            <p className="t-footnote text-text-2 tabular-nums">
                {gap} to {next}
            </p>
        );
        if (rank.minRating === null) {
            progress = text;
        } else {
            const span = rank.nextMinRating - rank.minRating;
            const fraction = Math.min(1, Math.max(0, (elo - rank.minRating) / span));
            progress = (
                <>
                    <div
                        role="progressbar"
                        aria-label={`Progress to ${next}`}
                        aria-valuemin={rank.minRating}
                        aria-valuemax={rank.nextMinRating}
                        aria-valuenow={elo}
                        className="h-1 w-full max-w-60 overflow-hidden bg-surface-2"
                    >
                        <m.div
                            className="h-full origin-left"
                            style={{ backgroundColor: rankColour(rank.key) }}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: fraction }}
                            transition={spring.ui}
                        />
                    </div>
                    {text}
                </>
            );
        }
    }

    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <RankChip rank={rank} size="chip" />
                <span className="t-footnote min-w-0 break-words text-text-2">{rank.tagline}</span>
            </div>
            {progress}
        </div>
    );
}
