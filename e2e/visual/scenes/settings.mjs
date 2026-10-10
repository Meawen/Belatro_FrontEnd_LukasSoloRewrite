// Phase 9's Settings scenes (spec §4.13): Table effects, Account and Log out; a pending address; the
// change-of-address sheet; the deletion confirm step. The scene format is documented at the top of
// e2e/visual.mjs. The harness stores Table effects "off" before every shot.

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

export default [
    // a confirmed address: Table effects (Off picked), Account, Log out
    { name: 'settings', path: '/settings', viewports: BOTH, user: PLAYER, api: ['player.json'] },
    // a pending address with the resend button, under both banners (X-11 links lead here)
    { name: 'settings-pending', path: '/settings', viewports: BOTH, user: PLAYER, api: ['player.json', 'unverified-in-game.json'] },
    // the change of address in a sheet (bottom on phones, centred on desktop)
    { name: 'settings-change-email', path: '/settings', viewports: BOTH, user: PLAYER, api: ['player.json'], setup: changeEmail },
    // the deletion request's confirm step with its R-40 copy
    { name: 'settings-delete-confirm', path: '/settings', viewports: BOTH, user: PLAYER, api: ['player.json'], setup: askToDelete },
];
