// Phase 2's scenes: the app shell (spec §4.1), the public frame (§4.15) and Not found (§4.16).
// The scene format is documented at the top of e2e/visual.mjs.

const PLAYER = { id: 'u1', username: 'ana_k' };
const ADMIN = { id: 'u9', username: 'mira_z' };
const BOTH = ['1440x900', '375x812'];

/** Opens the More sheet of the phone tab bar. */
async function openMore(page) {
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('dialog', { name: 'More' }).waitFor();
}

export default [
    // Home as it is today, inside the shell: sidebar with labels (1440), icons only (800), tab bar (375), landscape (812×375)
    { name: 'shell-home', path: '/dashboard', viewports: ['1440x900', '800x1000', '375x812', '812x375'], user: PLAYER, api: ['player.json'] },
    // both banners at the top of the content (R-33, X-11)
    { name: 'shell-banners', path: '/dashboard', viewports: BOTH, user: PLAYER, api: ['player.json', 'unverified-in-game.json'] },
    // More open on a phone
    { name: 'shell-more', path: '/dashboard', viewports: ['375x812'], user: PLAYER, api: ['player.json'], setup: openMore },
    // an admin sees Admin in the sidebar (AC 4); Settings is the placeholder until Phase 9
    { name: 'shell-settings-admin', path: '/settings', viewports: BOTH, user: ADMIN, api: ['admin.json'] },
    // the public frame, signed in with a game in progress (AC 9) and signed out
    { name: 'shell-rules', path: '/rules', viewports: BOTH, user: PLAYER, api: ['player.json', 'unverified-in-game.json'] },
    { name: 'shell-rules-signed-out', path: '/rules', viewports: BOTH, user: null },
    // Not found, both ways
    { name: 'shell-404', path: '/no/such/page', viewports: BOTH, user: PLAYER, api: ['player.json'] },
    { name: 'shell-404-signed-out', path: '/no/such/page', viewports: BOTH, user: null },
    // the leaderboard's prompt, signed out (M-13)
    { name: 'shell-users-signed-out', path: '/users', viewports: BOTH, user: null },
];
