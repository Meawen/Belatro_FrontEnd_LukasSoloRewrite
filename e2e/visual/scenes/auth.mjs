// Phase 6's scenes: sign in, sign up and the e-mail pages on the auth frame (spec §4.2, §4.3, X-1).
// The scene format is documented at the top of e2e/visual.mjs. Every scene is signed out.

const BOTH = ['1440x900', '375x812'];

/** Fills the sign-up form the way the release harness does, then presses Create Account. */
async function fillSignup(page, invite) {
    await page.getByLabel('Username', { exact: true }).fill('ana_k');
    await page.getByLabel('Email', { exact: true }).fill('ana@example.test');
    await page.getByLabel('Password', { exact: true }).fill('visual-password-1');
    await page.getByLabel('Confirm Password', { exact: true }).fill('visual-password-1');
    if (invite) await page.locator('input[name="inviteCode"]').fill(invite);
    await page.getByRole('button', { name: 'Create Account', exact: true }).click();
}

export default [
    // sign in, plain and after the server ended the session (R-10, US-42)
    { name: 'auth-login', path: '/login', viewports: BOTH },
    { name: 'auth-login-session-ended', path: '/login?reason=session-ended', viewports: BOTH },
    // sign up: the form, a refused invite code on its field (R-11, US-11), and the inbox panel
    { name: 'auth-signup', path: '/signup', viewports: BOTH, fullPage: true },
    {
        name: 'auth-signup-bad-invite',
        path: '/signup',
        viewports: BOTH,
        fullPage: true,
        api: [{ 'POST /api/auth/signup': { status: 403, json: { message: 'Invalid invite code' } } }],
        setup: async (page) => {
            await fillSignup(page, 'wrong-code');
            await page.getByText('Invalid invite code', { exact: true }).waitFor();
        },
    },
    {
        name: 'auth-signup-inbox',
        path: '/signup',
        viewports: BOTH,
        api: [{ 'POST /api/auth/signup': { json: { token: 'visual-signup-token', user: { id: 'u1', username: 'ana_k' }, message: null } } }],
        setup: async (page) => {
            await fillSignup(page);
            await page.getByRole('heading', { name: 'Check your inbox' }).waitFor();
        },
    },
    // forgot password: the form, then the sentence that is the same for every address (R-13)
    { name: 'auth-forgot', path: '/forgot-password', viewports: BOTH },
    {
        name: 'auth-forgot-sent',
        path: '/forgot-password',
        viewports: BOTH,
        api: [{ 'POST /api/auth/forgot-password': { status: 202 } }],
        setup: async (page) => {
            await page.getByLabel('Email', { exact: true }).fill('ana@example.test');
            await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
            await page.getByText(/If that address has an account/).waitFor();
        },
    },
    // reset password: the form from the mail link, and a link without a token
    { name: 'auth-reset', path: '/reset-password?token=visual-reset', viewports: BOTH },
    { name: 'auth-reset-no-token', path: '/reset-password', viewports: BOTH },
    // confirm email: the button (it confirms on click, never on load), confirmed, and a link without a token
    { name: 'auth-confirm', path: '/confirm-email?token=visual-confirm', viewports: BOTH },
    {
        name: 'auth-confirm-done',
        path: '/confirm-email?token=visual-confirm',
        viewports: BOTH,
        api: [{ 'POST /api/auth/confirm-email': { json: {} } }],
        setup: async (page) => {
            await page.getByRole('button', { name: 'Confirm email address', exact: true }).click();
            await page.getByText('Your email address is confirmed.').waitFor();
        },
    },
    { name: 'auth-confirm-no-token', path: '/confirm-email', viewports: BOTH },
];
