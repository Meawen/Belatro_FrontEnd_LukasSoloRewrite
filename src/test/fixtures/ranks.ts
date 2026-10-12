import type { Ladder, PlayerRank, RankKey, RatingHistory, User } from '../../types/user';

// The backend's seven ranks as it sends them (stiglja enums/Rank, team-Elo spec "Ranks"). Tests read these;
// components never do: they print what the server sends.
const TABLE: [RankKey, string, string, number | null][] = [
    ['CUCEK', 'Cucek', 'Čeka pod stolom.', null],
    ['DECEC', 'Dečec', 'Bu se navčil.', null],
    ['FAKIN', 'Fakin', "Fakin, al' zna nekaj.", 1000],
    ['PAJDAS', 'Pajdaš', 'Dober pajdaš.', 1200],
    ['GOSPON', 'Gospon', 'Gospon se ne žuri.', 1400],
    ['MAJSTER', 'Majster', 'Ne zgubi ni štiha.', 1600],
    ['KAJKAVAC', 'Kajkavac', 'Zna kaj je kaj.', 1800],
];

/** A rank as UserSummaryDto.rank carries it: nextMinRating is the next placed rank's start (none for Cucek). */
export function rank(key: RankKey): PlayerRank {
    const at = TABLE.findIndex(([k]) => k === key);
    const [, name, tagline, minRating] = TABLE[at];
    const next = key === 'CUCEK' ? undefined : TABLE[at + 1];
    return { key, name, tagline, minRating, nextMinRating: next ? next[3] : null };
}

/** A /user/{id} summary with the rank fields. */
export function rankedUser(over: Partial<User> & { key: RankKey }): User {
    const { key, ...rest } = over;
    return { id: 'u1', username: 'ana_k', eloRating: 1290, level: 3, gamesPlayed: 42, rankedGamesPlayed: 42, rank: rank(key), ...rest };
}

/** The ladder of spec L-1: 412 placed players in 900…1799, 37 still placing; 180 below the 1200 bin, 40 in it. */
export const LADDER: Ladder = {
    players: 412,
    binSize: 100,
    bins: [
        { from: 900, count: 31 }, { from: 1000, count: 64 }, { from: 1100, count: 85 }, { from: 1200, count: 40 },
        { from: 1300, count: 66 }, { from: 1400, count: 55 }, { from: 1500, count: 35 }, { from: 1600, count: 21 },
        { from: 1700, count: 15 },
    ],
    ranks: [
        { key: 'CUCEK', name: 'Cucek', minRating: null, count: 37 },
        { key: 'DECEC', name: 'Dečec', minRating: null, count: 31 },
        { key: 'FAKIN', name: 'Fakin', minRating: 1000, count: 149 },
        { key: 'PAJDAS', name: 'Pajdaš', minRating: 1200, count: 106 },
        { key: 'GOSPON', name: 'Gospon', minRating: 1400, count: 90 },
        { key: 'MAJSTER', name: 'Majster', minRating: 1600, count: 36 },
        { key: 'KAJKAVAC', name: 'Kajkavac', minRating: 1800, count: 0 },
    ],
};

/** A ladder with fewer than five placed players (spec L-3). */
export const FEW_LADDER: Ladder = {
    ...LADDER,
    players: 4,
    bins: [{ from: 1200, count: 4 }],
    ranks: LADDER.ranks.map((r) => ({ ...r, count: r.key === 'PAJDAS' ? 4 : r.key === 'CUCEK' ? 2 : 0 })),
};

/** A rating history: `games` ranked games ending at `rating`, an even climb from 1200. */
export function history(over: Partial<RatingHistory> & { games?: number } = {}): RatingHistory {
    const { games = 57, ...rest } = over;
    const rating = rest.rating ?? 1452;
    const points = Array.from({ length: Math.min(games, 100) }, (_, i) => {
        const game = games - Math.min(games, 100) + i + 1;
        return { game, rating: Math.round(1200 + ((rating - 1200) * game) / games) };
    });
    return {
        rating,
        rankedGamesPlayed: games,
        startRating: games === 0 ? null : 1200,
        points,
        step: 31,
        pace: 4.2,
        paceGames: Math.min(games, 20),
        ...rest,
    };
}
