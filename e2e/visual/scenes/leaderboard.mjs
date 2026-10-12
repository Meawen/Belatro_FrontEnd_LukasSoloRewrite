// Phase 9's Leaderboard scenes (spec §4.12): the ranked page with my row and the Unranked accounts, a later
// page, and a search with no match. The harness answers GET /user/findAll whatever its query (page, q,
// sort=elo). The signed-out prompt is Phase 2's scene `shell-users-signed-out`.

const PLAYER = { id: 'u1', username: 'ana_k' };
const BOTH = ['1440x900', '375x812'];

const player = (id, username, eloRating, level, gamesPlayed) => ({ id, username, eloRating, level, gamesPlayed });
const ana = player('u1', 'ana_k', 1234, 3, 42);
const luka = player('u2', 'luka_m', 1318, 5, 64);
const mira = player('u9', 'mira_z', 1410, 7, 118);
const dora = player('u5', 'dora_k', 1200, 0, 0);

// as the server orders sort=elo (O-3): players with games by Elo, then the accounts without a game by name
const RANKED = [mira, luka, player('u6', 'tomislav_b', 1290, 4, 51), ana, player('u3', 'ivo_p', 1187, 2, 17), player('u7', 'petra_v', 1143, 2, 9)];
const UNRANKED = [dora, player('u8', 'zvone_r', 1200, 0, 0)];

const FRIENDS = {
    'GET /friendship/getAllByUserId/u1': {
        json: [
            { id: 'f1', fromUser: luka, toUser: ana, status: 'ACCEPTED', createdAt: '2026-09-14T10:00:00Z' },
            { id: 'f3', fromUser: mira, toUser: ana, status: 'PENDING', createdAt: '2026-09-28T09:15:00Z' },
            { id: 'f4', fromUser: ana, toUser: dora, status: 'PENDING', createdAt: '2026-09-29T20:45:00Z' },
        ],
    },
};

const FIRST = { 'GET /user/findAll': { json: { content: [...RANKED, ...UNRANKED], totalElements: 8, totalPages: 1, number: 0, size: 20 } } };
const SECOND = { 'GET /user/findAll': { json: { content: RANKED, totalElements: 46, totalPages: 3, number: 1, size: 20 } } };
const EMPTY = { 'GET /user/findAll': { json: { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 } } };

async function searchNobody(page) {
    await page.getByPlaceholder('Search users by username...').fill('zz');
    await page.getByText("No players match 'zz'").waitFor();
}

export default [
    // ranks for the players, my row in the accent with "You", Unranked last; Add Friend, Pending, Accept/Decline, Remove
    { name: 'leaderboard', path: '/users', viewports: BOTH, user: PLAYER, api: ['player.json', FIRST, FRIENDS] },
    // a later page: #21 onwards and "Page 2 of 3"
    { name: 'leaderboard-page-2', path: '/users', viewports: BOTH, user: PLAYER, api: ['player.json', SECOND, FRIENDS] },
    // a search with no match: the term and Clear Search
    { name: 'leaderboard-no-match', path: '/users', viewports: BOTH, user: PLAYER, api: ['player.json', EMPTY, FRIENDS], setup: searchNobody },
];
