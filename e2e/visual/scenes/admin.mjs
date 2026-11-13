// Phase 9's Admin scenes (spec §4.14): the statistics and the user management (a table at 1440, panels at 375),
// the delete sheet with its R-40 copy, and a player who is denied. The scene format is documented at the top of
// e2e/visual.mjs.

const ADMIN = { id: 'u9', username: 'mira_z' };
const PLAYER = { id: 'u1', username: 'ana_k' };
const BOTH = ['1440x900', '375x812'];

const user = (id, username, email, roles, deletionRequested = false) => ({
    id, username, email, pendingEmail: null, emailVerified: Boolean(email), roles, deletionRequested,
});

/**
 * GET /admin/beta (spec §2.2, §9; B7 and B9's BetaAdminDTO): the cap, the waitlist and the beta's counts. Ruling 80: the
 * panel's real numbers, not "Couldn't load the signup numbers". 14 Zagreb days, oldest first, the last the page's
 * fixed today (2026-10-10).
 */
const PER_DAY = [
    // casualWithHumans, ranked, guideStarted, guideHand1, guideHand2, guestSignups, invitesSent, invitesUsed
    [1, 0, 3, 2, 1, 0, 0, 0], [2, 1, 4, 3, 2, 1, 0, 0], [0, 0, 2, 2, 1, 0, 0, 0], [3, 1, 5, 4, 3, 1, 1, 0],
    [2, 2, 6, 4, 2, 0, 0, 1], [4, 1, 3, 3, 2, 1, 2, 1], [1, 0, 2, 1, 1, 0, 0, 0], [5, 2, 7, 5, 4, 2, 1, 1],
    [3, 1, 4, 3, 2, 1, 0, 0], [2, 3, 5, 4, 3, 0, 2, 2], [4, 2, 8, 6, 4, 2, 1, 1], [6, 3, 9, 7, 5, 1, 3, 2],
    [3, 2, 6, 5, 3, 1, 1, 1], [2, 1, 3, 2, 1, 0, 0, 0],
];
const KEYS = ['casualWithHumans', 'ranked', 'guideStarted', 'guideHand1', 'guideHand2', 'guestSignups', 'invitesSent', 'invitesUsed'];
const perDay = PER_DAY.map((values, i) => ({
    day: new Date(Date.UTC(2026, 8, 27 + i)).toISOString().slice(0, 10),
    ...Object.fromEntries(KEYS.map((key, k) => [key, values[k]])),
}));
/** A key's total over the last n days, today included. */
const last = (key, n) => perDay.slice(-n).reduce((sum, one) => sum + one[key], 0);
const BETA = {
    cap: 50, accounts: 31, waiting: 4, unconfirmed: 2, invitesOutstanding: 1,
    counts: {
        returning7: 9, returning28: 17,
        casualWithHumans7: last('casualWithHumans', 7), ranked7: last('ranked', 7), guideStarted7: last('guideStarted', 7),
        guideHand1_7: last('guideHand1', 7), guideHand2_7: last('guideHand2', 7), guestSignups7: last('guestSignups', 7),
        invitesSent7: last('invitesSent', 7), invitesUsed7: last('invitesUsed', 7),
        perDay,
    },
};

const DATA = {
    'GET /admin/beta': { json: BETA },
    'GET /admin/users': {
        json: [
            user('u9', 'mira_z', 'mira@example.test', ['ROLE_USER', 'ROLE_ADMIN']),
            user('u1', 'ana_k', 'ana@example.test', ['ROLE_USER']),
            user('u2', 'luka_m', 'luka@example.test', ['ROLE_USER']),
            user('u3', 'ivo_p', null, ['ROLE_USER'], true),
            user('u5', 'dora_k', 'dora@example.test', ['ROLE_USER']),
        ],
    },
    'GET /matches': { json: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }, { id: 'm4' }, { id: 'm5' }, { id: 'm6' }, { id: 'm7' }] },
    'GET /lobbies/open': { json: [{ id: 'l1', name: 'Petak', status: 'WAITING' }, { id: 'l2', name: 'Kod Mire', status: 'WAITING' }] },
};

async function askToDelete(page) {
    await page.getByRole('button', { name: 'Delete' }).first().click();
    await page.getByRole('dialog', { name: 'Confirm User Deletion' }).waitFor();
}

export default [
    // the real numbers (Active Lobbies = the open lobbies, X-7) and the users
    { name: 'admin', path: '/admin', viewports: BOTH, user: ADMIN, api: ['admin.json', DATA] },
    // Delete asks in a sheet: what goes and what remains (R-40)
    { name: 'admin-delete', path: '/admin', viewports: BOTH, user: ADMIN, api: ['admin.json', DATA], setup: askToDelete },
    // a player per /user/me is denied
    { name: 'admin-denied', path: '/admin', viewports: BOTH, user: PLAYER, api: ['player.json'] },
];
