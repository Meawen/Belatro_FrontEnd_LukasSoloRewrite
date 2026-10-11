import type { PlayerRank } from '../../types/user';
import { Chip, Tag } from '../ui';
import { cx } from '../ui/cx';

export interface RankChipProps {
    /** The rank the server sent; nothing renders without one (a backend before team Elo, ranks spec §4.2). */
    rank: PlayerRank | null | undefined;
    /** 'tag' (20 px) in rows and beside an Elo; 'chip' (28 px) in the profile header (ranks spec §5). */
    size?: 'tag' | 'chip';
    className?: string;
}

/** A player's rank as a chip in its rank's colour (ranks spec §3, §5), printing the name the server sends. */
export function RankChip({ rank, size = 'tag', className }: RankChipProps) {
    if (!rank) return null;
    const Shape = size === 'chip' ? Chip : Tag;
    return (
        <span data-rank={rank.key} className={cx('inline-flex max-w-full', className)}>
            <Shape tone="rank" rank={rank.key} title={`${rank.name}: ${rank.tagline}`}>
                {rank.name}
            </Shape>
        </span>
    );
}
