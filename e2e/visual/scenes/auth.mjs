// Phase 6's scenes: sign in, sign up and the e-mail pages on the auth frame (spec §4.2, §4.3, X-1), and Google's name
// step (Google sign-in spec §3.3). The scene format is documented at the top of e2e/visual.mjs. Every scene is signed out.

const BOTH = ['1440x900', '375x812'];

/** Fills the sign-up form the way the release harness does, then presses Create Account. */
async function fillSignup(page) {
    await page.getByLabel('Username', { exact: true }).fill('ana_k');
    await page.getByLabel('Email', { exact: true }).fill('ana@example.test');
    await page.getByLabel('Password', { exact: true }).fill('visual-password-1');
    await page.getByLabel('Confirm Password', { exact: true }).fill('visual-password-1');
    await page.getByRole('button', { name: 'Create Account', exact: true }).click();
}

// A made-up Google ID token (header.payload.signature) for the address google-name-step.json answers with; the SPA only
// reads its payload's email, for display, and the harness's fixtures answer whatever it carries.
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const GOOGLE_CREDENTIAL = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ email: 'ana.k@gmail.com' })}.visual`;

/**
 * Google's answer, as if its window had closed on an account (Google sign-in P-4): the stub (e2e/visual/google-stub.js)
 * draws its box and keeps no callback, so the page loads again with the stub's initialize watched, and the callback the
 * SPA hands it gets GOOGLE_CREDENTIAL. On /signup a needsName answer then opens the name step.
 */
async function answerGoogle(page) {
    await page.addInitScript(() => {
        let google;
        Object.defineProperty(window, 'google', {
            configurable: true,
            get: () => google,
            set(value) {
                google = value;
                const id = value?.accounts?.id;
                if (!id) return;
                const initialize = id.initialize.bind(id);
                id.initialize = (config) => {
                    window.__visualGoogleCallback = config.callback;
                    initialize(config);
                };
            },
        });
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.__visualGoogleCallback === 'function');
    await page.evaluate((credential) => window.__visualGoogleCallback({ credential }), GOOGLE_CREDENTIAL);
    // the step's one field, in either language
    await page.locator('input[name="username"]').waitFor();
    await page.evaluate(() => document.fonts.ready);
}

/** The name step, then a name the server says is taken (step 2's 409 USERNAME_TAKEN, under the field). */
async function takenName(page) {
    await answerGoogle(page);
    await page.getByLabel('Username', { exact: true }).fill('ana_k');
    await page.getByRole('button', { name: 'Make my account', exact: true }).click();
    await page.getByText(/^Username is already taken\./).waitFor();
    // the pointer off the button, so the shot doesn't show its hover
    await page.mouse.move(0, 0);
}

export default [
    // sign in, plain and after the server ended the session (R-10, US-42)
    { name: 'auth-login', path: '/login', viewports: BOTH },
    { name: 'auth-login-session-ended', path: '/login?reason=session-ended', viewports: BOTH },
    // sign up: the form and the inbox panel (the refused invite code's scene is gone with the field, S11; Ruling 80)
    { name: 'auth-signup', path: '/signup', viewports: BOTH, fullPage: true },
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
    // Google's name step (Google sign-in spec §3.3): /signup after Google's button answered needsName, signup open; then
    // the same step after step 2 refused the name (USERNAME_TAKEN under the field, which has focus)
    { name: 'auth-google-name', path: '/signup', viewports: BOTH, api: ['google-name-step.json'], setup: answerGoogle },
    {
        name: 'auth-google-name-taken',
        path: '/signup',
        viewports: BOTH,
        api: ['google-name-step.json', 'google-username-taken.json'],
        setup: takenName,
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
