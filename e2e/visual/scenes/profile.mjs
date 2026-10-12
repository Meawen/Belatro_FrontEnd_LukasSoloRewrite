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

export default [
    // your own: the accent avatar, the role chips, Elo / Games / Level once, the last five matches
    { name: 'profile', path: '/profile', viewports: BOTH, user: PLAYER, api: ['player.json', OWN] },
    // another player's: no roles, "Add Friend", their recent matches
    { name: 'profile-other', path: '/profile/u2', viewports: BOTH, user: PLAYER, api: ['player.json', OTHER] },
    // another player who asked to be friends: Accept + Decline (D-36)
    { name: 'profile-other-request', path: '/profile/u2', viewports: BOTH, user: PLAYER, api: ['player.json', REQUEST] },
    // a player who is not there (404)
    { name: 'profile-not-found', path: '/profile/u404', viewports: BOTH, user: PLAYER, api: ['player.json', MISSING] },
];
