// Phase 9's Settings scenes (spec §4.13): Table effects, Account and Log out; a pending address; the
// change-of-address sheet; the deletion confirm step; Google sign-in's three states (Google sign-in spec §5). The
// scene format is documented at the top of e2e/visual.mjs. The harness stores Table effects "off" before every shot.

const PLAYER = { id: 'u1', username: 'ana_k' };
const BOTH = ['1440x900', '375x812'];

async function changeEmail(page) {
    await page.getByRole('button', { name: 'Change Email' }).click();
    await page.getByRole('dialog', { name: 'Change Email' }).waitFor();
}

async function askToDelete(page) {
    await page.getByRole('button', { name: 'Request account deletion' }).click();
    await page.getByRole('button', { name: 'Confirm request' }).waitFor();
}

/**
 * The Account section with its Google block (Google sign-in spec §5), which sits below the fold: the page scrolled so the
 * section starts 16 px from the top (a full-page shot would cut the shell's sidebar at the screen's height).
 */
async function showGoogle(page) {
    await page.getByRole('heading', { name: 'Google sign-in', exact: true }).waitFor();
    await page.evaluate(() => {
        const section = document.getElementById('account');
        window.scrollTo({ top: section.getBoundingClientRect().top + window.scrollY - 16, behavior: 'instant' });
    });
}

/** Connect Google pressed: the password field and Google's button, the stub's box drawn in its slot. */
async function connectGoogle(page) {
    await page.getByRole('heading', { name: 'Google sign-in', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Connect Google', exact: true }).click();
    await page.getByLabel('Current password', { exact: true }).waitFor();
    await page.locator('div[aria-hidden="true"][style*="240px"]').waitFor();
    // the click and the field taking focus may have scrolled the page: the section starts at the top again
    await showGoogle(page);
}

export default [
    // a confirmed address: Table effects (Off picked), Account, Log out
    { name: 'settings', path: '/settings', viewports: BOTH, user: PLAYER, api: ['player.json'] },
    // a pending address with the resend button, under both banners (X-11 links lead here)
    { name: 'settings-pending', path: '/settings', viewports: BOTH, user: PLAYER, api: ['player.json', 'unverified-in-game.json'] },
    // the change of address in a sheet (bottom on phones, centred on desktop)
    { name: 'settings-change-email', path: '/settings', viewports: BOTH, user: PLAYER, api: ['player.json'], setup: changeEmail },
    // the deletion request's confirm step with its R-40 copy
    { name: 'settings-delete-confirm', path: '/settings', viewports: BOTH, user: PLAYER, api: ['player.json'], setup: askToDelete },
    // Google sign-in (Google sign-in spec §5), GET /user/me's google and passwordless in its three states. Not connected,
    // with Connect Google pressed: the current-password field (focused) over Google's button (the harness's 240×40 stub)
    {
        name: 'settings-google-off',
        path: '/settings',
        viewports: BOTH,
        user: PLAYER,
        api: ['player.json', 'player-google-off.json'],
        setup: connectGoogle,
    },
    // connected, with a password: Disconnect Google
    {
        name: 'settings-google-on',
        path: '/settings',
        viewports: BOTH,
        user: PLAYER,
        api: ['player.json', 'player-google-on.json'],
        setup: showGoogle,
    },
    // made with Google, no password yet: Set a password in place of the email and password buttons, and no Disconnect
    {
        name: 'settings-google-passwordless',
        path: '/settings',
        viewports: BOTH,
        user: PLAYER,
        api: ['player.json', 'player-google-passwordless.json'],
        setup: showGoogle,
    },
];
