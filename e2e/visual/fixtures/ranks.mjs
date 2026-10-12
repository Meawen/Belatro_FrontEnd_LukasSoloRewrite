// Rank and rating-history answers for the ranks scenes (ranks spec §11.2), as the team-Elo backend sends them.
// The scenes without these (every older one) are the old backend: no rank, and 404 from both chart routes.

const TABLE = [
    ['CUCEK', 'Cucek', 'Čeka pod stolom.', null],
    ['DECEC', 'Dečec', 'Bu se navčil.', null],
    ['FAKIN', 'Fakin', "Fakin, al' zna nekaj.", 1000],
    ['PAJDAS', 'Pajdaš', 'Dober pajdaš.', 1200],
    ['GOSPON', 'Gospon', 'Gospon se ne žuri.', 1400],
    ['MAJSTER', 'Majster', 'Ne zgubi ni štiha.', 1600],
    ['KAJKAVAC', 'Kajkavac', 'Zna kaj je kaj.', 1800],
];

/** UserSummaryDto.rank for a key. */
export function rank(key) {
    const at = TABLE.findIndex(([k]) => k === key);
    const [, name, tagline, minRating] = TABLE[at];
    const next = key === 'CUCEK' ? undefined : TABLE[at + 1];
    return { key, name, tagline, minRating, nextMinRating: next ? next[3] : null };
}

/** A summary with the rank fields. */
export const ranked = (user, key, rankedGamesPlayed) => ({ ...user, rankedGamesPlayed, rank: rank(key) });

/**
 * A rating history of `games` ranked games from 1200 to `end`: a seeded walk with early steps bigger than late ones
 * (K shrinks with games), bent to finish exactly at `end`, so every run draws the same climb.
 */
export function climb({ games, end, step, pace, seed = 7 }) {
    let state = seed;
    const random = () => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state / 2147483648;
    };
    const walk = [1200];
    for (let n = 0; n < games; n++) {
        const k = Math.max(24, 5559 / (n + 50));
        walk.push(walk[walk.length - 1] + (random() < 0.5 ? -1 : 1) * k * (0.25 + random() * 0.5));
    }
    const drift = (end - walk[games]) / games;
    const all = walk.map((r, n) => Math.round(r + drift * n));
    const first = Math.max(1, games - 99);
    return {
        rating: end,
        rankedGamesPlayed: games,
        startRating: games ? all[first - 1] : null,
        points: Array.from({ length: games - first + 1 }, (_, i) => ({ game: first + i, rating: all[first + i] })).filter(() => games > 0),
        step,
        pace,
        paceGames: pace === null ? 0 : Math.min(games, 20),
    };
}
