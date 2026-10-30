// The English catalog (spec §1.2); hr.ts has the same keys. Values are strings or (…args) => string.
// Rule for every catalog file: import only `type Catalog`, `type Lang` and `plural`. A function takes ready-made
// strings and numbers (the caller formats a date first and passes the string); a catalog never imports t.ts,
// format.ts, lang.ts or a service, so the review script (scripts/catalog-review.mjs) can load the catalogs alone.
// Each top-level key is a screen or an area, and one section of the owner's review page.
export const en = {
    // index.html's <meta name="description">, kept in the language by usePageTitle
    meta: {
        description: 'Stiglja: Belot for four, online.',
    },
    // each page's title: the browser tab ("{title} · Stiglja") and, on most pages, the h1
    titles: {
        home: 'Home',
        tables: 'Tables',
        table: 'Table',
        matches: 'Matches',
        matchDetails: 'Match details',
        friends: 'Friends',
        profile: 'Profile',
        settings: 'Settings',
        ranked: 'Ranked',
        leaderboard: 'Leaderboard',
        admin: 'Admin',
        game: 'Game',
        rules: 'Rules',
        privacy: 'Privacy notice',
        terms: 'Terms of use',
        signIn: 'Sign in',
        signUp: 'Sign up',
        forgotPassword: 'Forgot password',
        resetPassword: 'Reset password',
        confirmEmail: 'Confirm email',
        notFound: 'Page not found',
    },
    // the compact HR · EN switch at the top of the signed-in shell: its group's name for screen readers
    langSwitch: {
        label: 'Site language',
    },
    // Settings (/settings)
    settings: {
        // the Language section, first on the page
        language: {
            heading: 'Language',
            body: "The site's language. Kept on this device and on your account.",
            hr: 'Hrvatski',
            en: 'English',
        },
    },
    // relative times ("5 minutes ago"), wherever a time is shown
    time: {
        justNow: 'just now',
    },
};
