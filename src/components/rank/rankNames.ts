import type { Ladder, PlayerRank } from '../../types/user';

/** The six ranks past placement, in rank order, as the ladder sends them (Cucek is the placement state). */
export function placedRanks(ladder: Ladder): Ladder['ranks'] {
    return ladder.ranks.filter((r) => r.key !== 'CUCEK');
}

/**
 * The next rank's name: the ladder entry that starts where this rank ends (ranks spec R-3). RankDto carries only
 * nextMinRating, and a name is never derived from a key. Null at the top, for Cucek, or without the ladder.
 */
export function nextRankName(rank: PlayerRank | null | undefined, ladder: Ladder | null | undefined): string | null {
    if (!rank || rank.nextMinRating === null || !ladder) return null;
    return placedRanks(ladder).find((r) => r.minRating === rank.nextMinRating)?.name ?? null;
}
