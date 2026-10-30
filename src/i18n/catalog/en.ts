import { plural } from '../plural';

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
    // server errors in the user's language (spec §1.1, §8: what happened and what to do), wherever an error shows.
    // English keeps the server's own words where an English test pins the client's copy of them.
    errors: {
        // a network failure, a 5xx, or a code the catalogs don't know (English shows the server's sentence instead)
        generic: 'Something went wrong. Try again.',
        // the credential rules: the forms' own check, and the server's field message for the same rule
        rules: {
            password: 'Password must be at least 8 characters and at most 72 bytes',
            username: 'Username must be 3-20 characters: English letters a-z, digits or underscore',
        },
        // one line per code: the REST codes (backend exceptions/ErrorCodes.java) and the game's refusals on
        // /user/queue/errors (matched by their text in serverErrors.ts)
        codes: {
            // signing in, signing up and the account
            SESSION_EXPIRED: 'Your session has expired. Sign in again.',
            UNAUTHENTICATED: 'You need to sign in for that. Sign in, then try again.',
            BAD_CREDENTIALS: 'Wrong username or password. Check both and try again.',
            WRONG_PASSWORD: 'Current password is incorrect',
            ACCESS_DENIED: "You don't have permission to do that.",
            RATE_LIMITED: 'Too many tries. Wait a little, then try again.',
            SERVICE_UNAVAILABLE: "The server isn't answering right now. Try again in a minute.",
            INVITE_CODE_INVALID: 'Invalid invite code. Check it and try again.',
            USERNAME_TAKEN: 'Username is already taken. Choose another one.',
            EMAIL_TAKEN: 'That email address is already in use. Use another one.',
            LINK_INVALID: 'This link is invalid or has expired',
            NOTHING_TO_CONFIRM: "There's no email address waiting to be confirmed.",
            EMAIL_UNCHANGED: 'That is already your email address',
            PASSWORD_BLANK: 'Type a new password.',
            // a form the server refused for a reason other than the two rules above
            VALIDATION: "Something you entered isn't valid. Check the form and try again.",
            // lists (players, admin)
            PAGE_INVALID: "That page of the list doesn't exist. Go back to the first page.",
            SEARCH_INVALID: "The search contains a character that isn't allowed. Remove it and try again.",
            SORT_UNKNOWN: "The list can't be sorted that way. Choose another order.",
            USER_NOT_FOUND: "We couldn't find that player. They may no longer have an account.",
            BOT_NOT_DELETABLE: "Bot accounts can't be deleted.",
            // friends
            FRIEND_USER_REQUIRED: 'Choose who to add as a friend.',
            FRIEND_SELF: "You can't add yourself as a friend.",
            FRIEND_IS_BOT: "Bots can't be added as friends.",
            FRIENDSHIP_NOT_YOURS: "That isn't one of your friends or requests. Reload the page.",
            FRIEND_SENDER_ONLY: 'Only the player who sent this request can cancel it.',
            FRIEND_RECIPIENT_ONLY: 'Only the player who got this request can accept or decline it.',
            FRIENDSHIP_FINAL: 'This request has already been answered. Reload the page.',
            FRIENDSHIP_NOT_FOUND: 'That friend request no longer exists. Reload the page.',
            // tables (Tables and a table's room)
            LOBBY_ID_REQUIRED: "Something's wrong with this table's link. Open the table again from Tables.",
            LOBBY_NOT_FOUND: 'This table no longer exists. Choose another one in Tables.',
            LOBBY_CLOSED: 'This table is closed. Choose another one in Tables.',
            LOBBY_FULL: 'This table is full. Choose another one, or open your own.',
            LOBBY_PASSWORD_REQUIRED: 'This is a private table. Enter its password.',
            LOBBY_PASSWORD_WRONG: 'Wrong table password. Try again.',
            LOBBY_PASSWORD_TOO_LONG: 'That password is too long. Choose a shorter one.',
            HOST_ONLY: "Only the table's host can do that.",
            HOST_CANNOT_LEAVE: "The host can't leave the table. Delete the table instead.",
            KICK_TARGET_REQUIRED: 'Choose who to remove from the table.',
            NOT_IN_LOBBY: 'The table has changed since you opened it. Reload the page.',
            TEAM_REQUIRED: 'Choose a team first.',
            TEAM_INVALID: "That team doesn't exist. Choose team A or B.",
            TEAM_FULL: 'That team is full. Choose the other one.',
            TEAMS_INCOMPLETE: 'Each team needs exactly 2 players to start. Fill the empty seats or add bots.',
            PLAYERS_UNASSIGNED: "Some players aren't in a team yet. Put everyone in a team, then start.",
            BOTS_CASUAL_ONLY: 'Bots play only at casual tables.',
            NO_BOT_FREE: 'No bot is free right now. Try again in a moment.',
            NO_SEAT_TO_FILL: "There's no empty seat for a bot.",
            // ranked (the queue, a found match, match history)
            EMAIL_NOT_VERIFIED: 'Verify your email to play ranked. Open your confirmation link if you have one, or ask for a new one, then try again.',
            ALREADY_QUEUED: "You're already in the queue.",
            DECLINE_COOLDOWN: (seconds: number) =>
                `You declined a match. Wait ${seconds} more ${plural(seconds, { one: 'second', other: 'seconds' }, 'en')}, then queue again.`,
            DECLINE_TOO_LATE: 'This match can no longer be declined',
            NOT_A_PARTICIPANT: "You're not playing in this game.",
            MATCH_NOT_FOUND: "We couldn't find that match.",
            // the game: a refused move or Play again, shown on the table
            GAME_NOT_FOUND: 'This game is no longer running. Go back to Home.',
            CANT_CHALLENGE: "You can't challenge now.",
            DECLARATIONS_BEING_SAID: 'Wait until the declarations are shown, then play your card.',
            DEALER_MUST_CALL: 'You must call trump.',
            WAIT_FOR_PAUSE: 'Wait for the next hand to start.',
            REMATCH_UNAVAILABLE: "Play again isn't available for this game. Go back to Tables and sit at a new table.",
        },
    },
};
