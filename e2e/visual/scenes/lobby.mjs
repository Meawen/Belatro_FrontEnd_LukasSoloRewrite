// Phase 5's scenes: the lobby list, the quick-look and Create lobby (spec §4.6), and the lobby table seen by
// its host, a member who has not sat down and an outsider (§4.7). The scene format is documented at the top
// of e2e/visual.mjs. The fixtures leave `createdAt` null, so no shot depends on the clock.

const ANA = { id: 'u1', username: 'ana_k' };
const MIRA = { id: 'u9', username: 'mira_z' };
const TEA = { id: 'u4', username: 'tea_r' };
const BOTH = ['1440x900', '375x812'];

/** The shell's own questions for a verified player who is in no game. */
function signedIn(user) {
    return {
        'GET /user/me': {
            json: {
                id: user.id, username: user.username, email: `${user.username}@example.test`, pendingEmail: null,
                emailVerified: true, roles: ['ROLE_USER'], deletionRequested: false,
            },
        },
        'GET /user/me/active-game': { status: 204 },
    };
}

/** Taps the row "Kod Mire" and waits for its quick-look. */
async function openQuickLook(page) {
    await page.getByRole('button', { name: /^Kod Mire, host mira_z/ }).click();
    await page.getByRole('dialog', { name: 'Kod Mire' }).waitFor();
}

export default [
    // four lobbies: private, one with an unassigned member, a full one, and ana_k's own ("You're in")
    { name: 'lobby-list', path: '/lobbies', viewports: BOTH, user: ANA, api: ['player.json', 'lobbies.json'] },
    // the quick-look: the mini table at 60 %, host, privacy, the password field and "Join lobby"
    { name: 'lobby-quicklook', path: '/lobbies', viewports: BOTH, user: ANA, api: ['player.json', 'lobbies.json'], setup: openQuickLook },
    // Home's "Create lobby" link lands here
    { name: 'lobby-create', path: '/lobbies?create=1', viewports: BOTH, user: ANA, api: ['player.json', 'lobbies.json'] },
    // the host at the bottom, the reason line and a disabled Start match
    { name: 'lobby-host', path: '/lobby/l1', viewports: BOTH, user: MIRA, api: ['lobbies.json', signedIn(MIRA)] },
    // a member not seated: "Sit here, team B", Not seated "tea_r · you", the hint and Leave
    { name: 'lobby-member', path: '/lobby/l2', viewports: BOTH, user: TEA, api: ['lobbies.json', signedIn(TEA)] },
    // an outsider: Open seats, the hint and "Join lobby" (private: the lock)
    { name: 'lobby-outsider', path: '/lobby/l1', viewports: BOTH, user: ANA, api: ['player.json', 'lobbies.json'] },
];
