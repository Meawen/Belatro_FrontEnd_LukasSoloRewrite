// Phase 9's Friends scenes (spec §4.11): friends, the requests tab, the remove sheet and an empty list.
// The scene format is documented at the top of e2e/visual.mjs. Dates are fixed.

const PLAYER = { id: 'u1', username: 'ana_k' };
const BOTH = ['1440x900', '375x812'];

const ana = { id: 'u1', username: 'ana_k', eloRating: 1234, level: 3, gamesPlayed: 42 };
const luka = { id: 'u2', username: 'luka_m', eloRating: 1318, level: 5, gamesPlayed: 64 };
const ivo = { id: 'u3', username: 'ivo_p', eloRating: 1187, level: 2, gamesPlayed: 17 };
const mira = { id: 'u9', username: 'mira_z', eloRating: 1410, level: 7, gamesPlayed: 118 };
const dora = { id: 'u5', username: 'dora_k', eloRating: 1200, level: 0, gamesPlayed: 0 };

const FRIENDSHIPS = {
    'GET /friendship/getAllByUserId/u1': {
        json: [
            { id: 'f1', fromUser: luka, toUser: ana, status: 'ACCEPTED', createdAt: '2026-09-14T10:00:00Z' },
            { id: 'f2', fromUser: ana, toUser: ivo, status: 'ACCEPTED', createdAt: '2026-09-02T18:30:00Z' },
            { id: 'f3', fromUser: mira, toUser: ana, status: 'PENDING', createdAt: '2026-09-28T09:15:00Z' },
            { id: 'f4', fromUser: ana, toUser: dora, status: 'PENDING', createdAt: '2026-09-29T20:45:00Z' },
        ],
    },
};

const NONE = { 'GET /friendship/getAllByUserId/u1': { json: [] } };

async function requests(page) {
    await page.getByRole('button', { name: 'Requests (1)' }).click();
    await page.getByRole('button', { name: 'Accept' }).waitFor();
}

async function removeFirst(page) {
    await page.getByRole('button', { name: 'Remove' }).first().click();
    await page.getByRole('dialog', { name: 'Remove luka_m?' }).waitFor();
}

export default [
    // the Friends tab: avatar, name, "Elo n · Level n", since when, View profile, Remove
    { name: 'friends', path: '/friends', viewports: BOTH, user: PLAYER, api: ['player.json', FRIENDSHIPS] },
    // a request to me: Accept + Decline
    { name: 'friends-requests', path: '/friends', viewports: BOTH, user: PLAYER, api: ['player.json', FRIENDSHIPS], setup: requests },
    // Remove asks in a sheet: "Remove luka_m"
    { name: 'friends-remove', path: '/friends', viewports: BOTH, user: PLAYER, api: ['player.json', FRIENDSHIPS], setup: removeFirst },
    // nobody yet: the way to the Leaderboard
    { name: 'friends-empty', path: '/friends', viewports: BOTH, user: PLAYER, api: ['player.json', NONE] },
];
