// Phase 9's legal scenes (spec §4.15): Rules, Privacy and Terms, signed out, the whole page each, in the 680-px
// reading frame. Phase 2's `shell-rules` shows the top of Rules signed in with a game in progress.

const BOTH = ['1440x900', '375x812'];

// ranks spec §9, §11.2: the Rules guide's two interactive steps, and the full rules opened
async function trumpOrder(page) {
    await page.getByRole('button', { name: 'Trump', exact: true }).click();
    await page.getByRole('list', { name: 'Herc as trump, highest first' }).waitFor();
    await page.getByRole('heading', { name: '32 cards, two orders' }).scrollIntoViewIfNeeded();
}
async function followSuit(page) {
    await page.getByRole('button', { name: '7 Karo' }).click();
    await page.getByText('Not this one: you can beat the 9 with your Kralj, so you must.').waitFor();
    await page.getByRole('heading', { name: 'Follow suit' }).scrollIntoViewIfNeeded();
}
async function fullRules(page) {
    await page.getByRole('heading', { name: 'Full rules' }).click();
    await page.getByRole('heading', { name: 'Ranks', level: 3 }).last().waitFor();
}

export default [
    { name: 'legal-rules', path: '/rules', viewports: BOTH, user: null, fullPage: true },
    { name: 'legal-privacy', path: '/privacy', viewports: BOTH, user: null, fullPage: true },
    { name: 'legal-terms', path: '/terms', viewports: BOTH, user: null, fullPage: true },
    { name: 'rules-guide-trump', path: '/rules', viewports: BOTH, user: null, setup: trumpOrder },
    { name: 'rules-guide-follow', path: '/rules', viewports: BOTH, user: null, setup: followSuit },
    { name: 'rules-full', path: '/rules', viewports: BOTH, user: null, fullPage: true, setup: fullRules },
];
