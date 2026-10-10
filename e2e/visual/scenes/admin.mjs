// Phase 9's Admin scenes (spec §4.14): the statistics and the user management (a table at 1440, panels at 375),
// the delete sheet with its R-40 copy, and a player who is denied. The scene format is documented at the top of
// e2e/visual.mjs.

const ADMIN = { id: 'u9', username: 'mira_z' };
const PLAYER = { id: 'u1', username: 'ana_k' };
const BOTH = ['1440x900', '375x812'];

const user = (id, username, email, roles, deletionRequested = false) => ({
    id, username, email, pendingEmail: null, emailVerified: Boolean(email), roles, deletionRequested,
});

const DATA = {
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
