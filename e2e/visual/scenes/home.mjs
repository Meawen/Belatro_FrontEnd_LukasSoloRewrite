// Phase 7's Home scenes (spec §4.4): the launcher with recent matches, with a game in progress, and for a
// new player. The scene format is documented at the top of e2e/visual.mjs. Dates are fixed (more than a
// week back), so every run draws the same day labels.

const PLAYER = { id: 'u1', username: 'ana_k' };
const BOTH = ['1440x900', '375x812'];

const summary = (matchId, endTime, yourOutcome, gameMode, result) => ({ matchId, endTime, result, yourOutcome, gameMode });

const RECENT = {
    'GET /user/u1/history/summary': {
        json: {
            content: [
                summary('6ac9061df0a9f70ffc4dfa74', '2026-09-26T18:28:00Z', 'LOSS', 'CASUAL', 'Team B wins 812–896'),
                summary('6ac8f3f6cf32dc27b44c2d88', '2026-09-25T17:33:00Z', 'WIN', 'CASUAL', 'Team A wins 1219–971'),
                summary('6ac77a12bb01ce4e9a1f0b33', '2026-09-24T20:05:00Z', 'WIN', 'RANKED', 'Team A wins 1436–1208'),
            ],
        },
    },
};

const IN_GAME = {
    'GET /user/me/active-game': { json: { gameId: '6ad0a1b2c3d4e5f607182930' } },
    'GET /user/u1/history/summary': {
        json: {
            content: [
                summary('6ac54c0e9d10aa77e1b2c3d4', '2026-09-27T21:10:00Z', 'WIN', 'RANKED', 'Team A wins by forfeit'),
                summary('6ac9061df0a9f70ffc4dfa74', '2026-09-26T18:28:00Z', 'LOSS', 'CASUAL', 'Team B wins 812–896'),
                summary('6ac8f3f6cf32dc27b44c2d88', '2026-09-25T17:33:00Z', 'WIN', 'CASUAL', 'Team A wins 1219–971'),
            ],
        },
    },
};

const NEW_PLAYER = {
    'GET /user/u1': { json: { id: 'u1', username: 'ana_k', eloRating: null, level: 0, gamesPlayed: null } },
    'GET /user/u1/history/summary': { json: { content: [] } },
};

export default [
    // the launcher: greeting, Ranked | Lobbies, stats | recent matches, the guide (phones: one column)
    { name: 'home', path: '/dashboard', viewports: BOTH, user: PLAYER, api: ['player.json', RECENT] },
    // a game in progress: the "Return to your game" card in the banner's place (R-33); a forfeit row
    { name: 'home-in-game', path: '/dashboard', viewports: BOTH, user: PLAYER, api: ['player.json', IN_GAME] },
    // a new player: "—" for the unknown numbers, Level 1, "No matches yet"
    { name: 'home-new-player', path: '/dashboard', viewports: BOTH, user: PLAYER, api: ['player.json', NEW_PLAYER] },
];
