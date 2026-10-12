import type { Ladder, PlayerRank, RankKey } from '../../types/user';
import { RULE_RANKS } from '../info/rulesData';

/** How many ranked games placement takes (team-Elo spec "Ranks": Cucek until 10 are played). */
export const PLACEMENT_GAMES = 10;

/** The colour token of a rank, for a mark (a colour, not a name: names come from the server). */
export function rankColour(key: RankKey): string {
    return `var(--rank-${key.toLowerCase()})`;
}

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

/**
 * A rank's Croatian tagline, for the ladder's legend (owner 2026-10-11). LadderDto sends no taglines, so they come from
 * the Rules page's data; null for a rank the SPA does not know (ranks spec §11.3 F-4).
 */
export function rankTagline(key: RankKey): string | null {
    return RULE_RANKS.find((r) => r.key === key)?.tagline ?? null;
}
