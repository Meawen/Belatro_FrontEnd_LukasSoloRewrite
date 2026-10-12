import { climb, rank, ranked } from '../fixtures/ranks.mjs';
// Phase 9's Profile scenes (spec §4.10): your own and another player's profile, and a missing one. The scene
// format is documented at the top of e2e/visual.mjs. Dates are fixed (more than a week back), so every run
// draws the same day labels.

const PLAYER = { id: 'u1', username: 'ana_k' };
const BOTH = ['1440x900', '375x812'];

const summary = (matchId, endTime, yourOutcome, gameMode, result) => ({ matchId, endTime, result, yourOutcome, gameMode });

const RECENT = [
    summary('6ac9061df0a9f70ffc4dfa74', '2026-09-26T18:28:00Z', 'LOSS', 'CASUAL', 'Team B wins 812–896'),
    summary('6ac8f3f6cf32dc27b44c2d88', '2026-09-25T17:33:00Z', 'WIN', 'CASUAL', 'Team A wins 1219–971'),
    summary('6ac77a12bb01ce4e9a1f0b33', '2026-09-24T20:05:00Z', 'WIN', 'RANKED', 'Team A wins 1436–1208'),
    summary('6ac54c0e9d10aa77e1b2c3d4', '2026-09-22T21:10:00Z', 'WIN', 'RANKED', 'Team A wins by forfeit'),
    summary('6ac41b2a7f00aa11c2d3e4f5', '2026-09-20T19:42:00Z', 'LOSS', 'RANKED', 'Team B wins 1004–877'),
];

const OWN = { 'GET /user/u1/history/summary': { json: { content: RECENT } } };

const luka = { id: 'u2', username: 'luka_m', eloRating: 1318, level: 5, gamesPlayed: 64 };
const ana = { id: 'u1', username: 'ana_k', eloRating: 1234, level: 3, gamesPlayed: 42 };

const OTHER = {
    'GET /user/u2': { json: luka },
    'GET /user/u2/history/summary': { json: { content: RECENT.slice(1, 4) } },
    'GET /friendship/getAllByUserId/u1': { json: [] },
};

const REQUEST = {
    ...OTHER,
    'GET /friendship/getAllByUserId/u1': {
        json: [{ id: 'f1', fromUser: luka, toUser: ana, status: 'PENDING', createdAt: '2026-09-28T10:00:00Z' }],
    },
};

const MISSING = {
    'GET /user/u404': { status: 404, json: { error: 'User not found with id u404' } },
    'GET /user/u404/history/summary': { json: { content: [] } },
    'GET /friendship/getAllByUserId/u1': { json: [] },
};

// ranks spec §6.1, §8, §11.2: the rank under the name and your climb (the team-Elo backend)
const CLIMBER = (key, eloRating, games) => ({ 'GET /user/u1': { json: { ...ana, eloRating, gamesPlayed: games + 6, rankedGamesPlayed: games, rank: rank(key) } } });
const HISTORY = (answer) => ({ 'GET /user/u1/rating-history': { json: answer } });
const GOSPON = [CLIMBER('GOSPON', 1452, 57), HISTORY(climb({ games: 57, end: 1452, step: 31, pace: 4.2 }))];
const PLACING = [CLIMBER('CUCEK', 1256, 3), HISTORY(climb({ games: 3, end: 1256, step: 53, pace: null }))];
const TOP = [CLIMBER('KAJKAVAC', 1846, 80), HISTORY(climb({ games: 80, end: 1846, step: 21, pace: 3, seed: 11 }))];
const FRESH = [CLIMBER('CUCEK', 1200, 0), HISTORY(climb({ games: 0, end: 1200, step: 56, pace: null }))];
async function toClimb(page) {
    await page.getByRole('heading', { name: 'Your climb' }).evaluate((heading) => heading.scrollIntoView({ block: 'start' }));
}
const OTHER_RANKED = { ...OTHER, 'GET /user/u2': { json: ranked({ ...luka, eloRating: 1650 }, 'MAJSTER', 64) } };

export default [
    // your own: the accent avatar, the role chips, Elo / Games / Level once, the last five matches
    { name: 'profile', path: '/profile', viewports: BOTH, user: PLAYER, api: ['player.json', OWN] },
    // another player's: no roles, "Add Friend", their recent matches
    { name: 'profile-other', path: '/profile/u2', viewports: BOTH, user: PLAYER, api: ['player.json', OTHER] },
    // another player who asked to be friends: Accept + Decline (D-36)
    { name: 'profile-other-request', path: '/profile/u2', viewports: BOTH, user: PLAYER, api: ['player.json', REQUEST] },
    // a player who is not there (404)
    { name: 'profile-not-found', path: '/profile/u404', viewports: BOTH, user: PLAYER, api: ['player.json', MISSING] },
    // your climb: Gospon 1452 after 57 ranked games, rising: "At this pace: Majster in about 36 games"; also landscape
    { name: 'profile-climb', path: '/profile', viewports: BOTH, user: PLAYER, api: ['player.json', 'ladder.json', OWN, ...GOSPON] },
    // the same, a phone turned to landscape, scrolled to the chart (review focus 5: nothing overflows)
    { name: 'profile-climb-landscape', path: '/profile', viewports: ['812x375'], user: PLAYER, api: ['player.json', 'ladder.json', OWN, ...GOSPON], setup: toClimb },
    // in placement: three games, their dots, no forecast
    { name: 'profile-climb-cucek', path: '/profile', viewports: BOTH, user: PLAYER, api: ['player.json', 'ladder.json', OWN, ...PLACING] },
    // the top rank: "Top rank", the forecast still drawn
    { name: 'profile-climb-kajkavac', path: '/profile', viewports: BOTH, user: PLAYER, api: ['player.json', 'ladder.json', OWN, ...TOP] },
    // no ranked game yet
    { name: 'profile-climb-none', path: '/profile', viewports: BOTH, user: PLAYER, api: ['player.json', 'ladder.json', OWN, ...FRESH] },
    // another player's: the rank chip and progress, no chart
    { name: 'profile-other-ranked', path: '/profile/u2', viewports: BOTH, user: PLAYER, api: ['player.json', 'ladder.json', OTHER_RANKED] },
];
