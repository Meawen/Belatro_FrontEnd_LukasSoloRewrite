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
    // generic words and fallbacks, the same at every site (S4 and S5 reuse them)
    common: {
        // closes a form or a sheet without doing anything (Change email, Change password, Remove a friend)
        cancel: 'Cancel',
        tryAgain: 'Try Again',
        refresh: 'Refresh',
        refreshing: 'Refreshing...',
        logOut: 'Log out',
        // a player without a username
        unknownPlayer: 'Unknown User',
        // before a player's level: "Level 3"
        level: 'Level',
        continue: 'Continue',
        signIn: 'Sign in',
        // the bare loading line (spec §1.4 Loading): the sign-in and sign-up pages while the session is read
        loading: 'Shuffling…',
        // the × in a sheet's header (ui/Sheet)
        close: 'Close',
        // the pager under a long list (ui/Pager): the leaderboard, Matches
        pager: {
            label: 'Pagination',
            previous: 'Previous',
            next: 'Next',
            pageOf: (page: number, count: number) => `Page ${page} of ${count}`,
            page: (page: number) => `Page ${page}`,
        },
    },
    // the main navigation: the sidebar and the phone tab bar (each destination's name is its page title, titles.*)
    nav: {
        label: 'Main navigation',
        // the tab bar's last tab, and the title of the sheet it opens
        more: 'More',
    },
    // around every signed-in page: the banners, the footer, the app-wide fallback, the route guards
    shell: {
        // the banner on every page but the game and Home while you have a seat in a running game (ActiveGameBanner)
        activeGame: {
            label: 'Game in progress',
            body: 'You have a game in progress.',
            action: 'Return to your game',
        },
        // the banner while your email address is not confirmed (UnverifiedEmailBanner)
        unverified: {
            label: 'Email confirmation',
            // the address can never be confirmed (the resend answered "nothing to confirm")
            unconfirmable: 'Add or change your email address to play ranked.',
            confirm: (address: string) => `Confirm ${address} to play ranked: use the link if one arrived, or ask for a new one.`,
            noAddress: 'Add an email address to play ranked.',
            // the link after noAddress
            openSettings: 'Open settings',
        },
        // the footer of every page but the game: "© {year} Stiglja · {cardArt}"
        footer: {
            cardArt: 'Card art by Maks Markovic',
        },
        // the footer's links, also on the auth pages and the public pages (LegalLinks)
        links: {
            label: 'Site links',
            rules: 'Rules',
            privacy: 'Privacy',
            terms: 'Terms',
            // before the support address: "Contact: support@stiglja.com"
            contact: 'Contact:',
        },
        // the app-wide fallback when a page crashes (ErrorBoundary)
        errorBoundary: {
            heading: 'Something went wrong',
            body: 'An unexpected error occurred. Please refresh the page or try again later.',
            reload: 'Reload',
            home: 'Go to dashboard',
        },
        // a signed-in page while the stored session is read (ProtectedRoute)
        checkingSession: 'Checking authentication...',
    },
    // field labels, placeholders and checks shared by several forms: sign in, sign up, the e-mail pages, Settings
    forms: {
        username: 'Username',
        password: 'Password',
        email: 'Email',
        emailPlaceholder: 'Enter your email',
        usernameRequired: 'Username is required',
        passwordRequired: 'Password is required',
        emailRequired: 'Email is required',
        emailInvalid: 'Email is invalid',
        passwordsDontMatch: 'Passwords do not match',
        currentPasswordRequired: 'Current password is required',
        currentPasswordPlaceholder: 'Enter current password...',
    },
    // the auth pages: sign in, sign up, the three e-mail pages, and the resend button
    auth: {
        // under the wordmark on every auth page (AuthFrame)
        tagline: 'Belot for four, online.',
        // /login (LoginForm)
        signIn: {
            heading: 'Welcome Back',
            subtitle: 'Sign in to your account',
            usernamePlaceholder: 'Enter your username',
            passwordPlaceholder: 'Enter your password',
            submit: 'Sign In',
            submitting: 'Signing In...',
            forgot: 'Forgot password?',
            // "{noAccount} [signUpLink]"
            noAccount: "Don't have an account?",
            signUpLink: 'Sign up',
            // a failure that is neither the server's nor the network's
            failed: 'Login failed',
        },
        // /signup (SignupForm)
        signUp: {
            // the heading and the button
            createAccount: 'Create Account',
            subtitle: 'Join the game today',
            usernamePlaceholder: 'Choose a username',
            passwordPlaceholder: 'Create a password',
            confirmPassword: 'Confirm Password',
            confirmPasswordPlaceholder: 'Confirm your password',
            confirmPasswordRequired: 'Please confirm your password',
            inviteCode: 'Invite code',
            inviteCodePlaceholder: 'From your invitation',
            inviteCodeInvalid: 'Invalid invite code',
            failed: 'Registration failed',
            submitting: 'Creating Account...',
            // the legal line under the button: "{termsBefore} [termsLink]{termsBetween} [privacyLink]."
            termsBefore: 'By creating an account you accept the',
            termsLink: 'Terms',
            termsBetween: '; see the',
            privacyLink: 'Privacy notice',
            // "{haveAccount} [Sign in]"
            haveAccount: 'Already have an account?',
            // after a sign-up: "{before} **the address**{after}", then Continue
            checkInbox: {
                heading: 'Check your inbox',
                before: 'If this address can be used, a confirmation link is on its way to',
                after: '. Check your inbox (and spam). Confirm it to play ranked; casual games work right away.',
            },
        },
        // /forgot-password (ForgotPasswordPage)
        forgot: {
            heading: 'Forgot your password?',
            // the same answer whether or not the address has an account
            sent: 'If that address has an account, we sent a link to reset your password. The link works for 15 minutes.',
            submit: 'Send reset link',
            back: 'Back to sign in',
        },
        // /reset-password, the link from the reset mail (ResetPasswordPage)
        reset: {
            heading: 'Choose a new password',
            done: 'Your password has been reset. Sign in with your new password.',
            newPassword: 'New password',
            confirmNewPassword: 'Confirm new password',
            rateLimited: 'Wait a while, then reload this page to try again.',
            submit: 'Reset password',
            // after a dead link: "[requestNewLink]", or after a network or server failure "[requestNewLink] {keepsHappening}"
            requestNewLink: 'Request a new link',
            keepsHappening: 'if this keeps happening.',
            // a network or server failure
            failed: 'We could not reset your password.',
        },
        // /confirm-email, the link from the confirmation mail (ConfirmEmailPage)
        confirm: {
            heading: 'Confirm your email address',
            confirmed: 'Your email address is confirmed.',
            button: 'Confirm email address',
            // a network or server failure
            failed: 'We could not confirm your email address.',
            // after a 429, and after a network or server failure
            reloadLater: 'Reload this page later to try again.',
            reload: 'Reload this page to try again.',
            // what to do next, signed in: "{newLinkInSettings} [settingsLink]." or "{changeAddressInSettings} [settingsLink]."
            newLinkInSettings: 'You can send a new link from',
            changeAddressInSettings: 'You can change your email address from',
            settingsLink: 'Settings',
            // signed out: "[Sign in] {toNewLink}" or "[Sign in] {toChangeAddress}"
            toNewLink: 'to send a new link.',
            toChangeAddress: 'to change your email address.',
        },
        // the "Resend confirmation email" button: the unconfirmed-email banner and Settings → Account
        resend: {
            button: 'Resend confirmation email',
            sent: 'If the address can still be confirmed, a new link is on its way.',
            // a network or server failure
            notSent: 'We could not send the email. Try again.',
            failed: 'Could not send the email',
            // after "nothing to confirm": the button or the link to Settings
            addOrChange: 'Add or change your email address',
        },
    },
    // a player's profile (/profile, /profile/:id); the h1 of its empty states is titles.profile
    profile: {
        notFound: 'Profile not found',
        notFoundBody: 'Profile information is not available.',
        loadFailed: "Couldn't load this profile",
        loading: 'Loading profile...',
        // the Recent matches list
        recentFailed: "Couldn't load the recent matches.",
        recentLoading: 'Loading matches...',
        noMatches: 'No matches yet',
        // the role chips on your own profile, for screen readers
        roles: 'Roles',
        // the stat tiles: Elo, Games, Level (common.level)
        games: 'Games',
        recent: 'Recent matches',
    },
    // Friends (/friends), the friend buttons on the leaderboard and on profiles, and the remove sheet
    friends: {
        // an empty list, per tab
        empty: {
            friendsTitle: 'No Friends Yet',
            friendsBody: 'Start adding friends to see them here!',
            pendingTitle: 'No Pending Requests',
            pendingBody: 'Friend requests will appear here.',
            sentTitle: 'No Sent Requests',
            sentBody: 'Your sent friend requests will appear here.',
        },
        // a row's date: on Friends, and on a request
        since: (date: string) => `Friends since ${date}`,
        requested: (date: string) => `Requested ${date}`,
        viewProfile: 'View profile',
        remove: 'Remove',
        accept: 'Accept',
        decline: 'Decline',
        // withdraws a request you sent (Friends → Sent)
        cancelRequest: 'Cancel',
        addFriend: 'Add Friend',
        // your request waits for an answer; pressing it withdraws the request
        pending: 'Pending',
        loading: 'Loading friends...',
        loadFailedTitle: 'Error Loading Friends',
        loadFailedBody: 'Failed to load friends list',
        // the switch between the three lists, for screen readers, and its tabs with their counts
        lists: 'Friend lists',
        tabFriends: (n: number) => `Friends (${n})`,
        tabRequests: (n: number) => `Requests (${n})`,
        tabSent: (n: number) => `Sent (${n})`,
        // the search box's name, for screen readers, and its placeholder
        search: 'Search friends',
        searchPlaceholder: 'Search friends...',
        updating: 'Updating...',
        // an empty list's way on
        openLeaderboard: 'Open the Leaderboard',
        // the name for a player without a username: on a profile, and on Friends
        thisPlayer: 'this player',
        someone: 'user',
        // a friend action the server refused without saying why
        failed: {
            send: 'Failed to send friend request',
            accept: 'Failed to accept friend request',
            reject: 'Failed to reject friend request',
            cancel: 'Failed to cancel friend request',
            remove: 'Failed to remove friend',
        },
        // the question before a friend is removed (RemoveFriendSheet)
        removeSheet: {
            title: (name: string) => `Remove ${name}?`,
            body: (name: string) => `Are you sure you want to remove ${name} from your friends?`,
            confirm: (name: string) => `Remove ${name}`,
        },
    },
    // the leaderboard (/users), and its prompt when signed out
    leaderboard: {
        // a row's tags
        you: 'You',
        unranked: 'Unranked',
        // a row's line: "{games} · Level 3"
        games: (n: number) => `${n} ${plural(n, { one: 'game', other: 'games' }, 'en')}`,
        // above the list
        found: (n: number) => `${n} ${plural(n, { one: 'user', other: 'users' }, 'en')} found`,
        loading: 'Loading users...',
        loadFailed: 'Error Loading Users',
        loadFailedBody: 'Failed to load user list',
        retrying: 'Retrying...',
        // a search that finds nobody
        noMatch: (query: string) => `No players match '${query}'`,
        clearSearch: 'Clear Search',
        empty: 'No Users Found',
        emptyBody: 'No users available.',
        // the search box's name, for screen readers, and its placeholder
        search: 'Search players',
        searchPlaceholder: 'Search users by username...',
        // signed out: the prompt in the public frame, with its two buttons
        signedOutTitle: 'Authentication Required',
        signedOutBody: 'Please log in to view the user leaderboard.',
        login: 'Login',
        signUp: 'Sign Up',
    },
    // any path no route knows (NotFoundPage); its h1 is titles.notFound, and signed out its button is common.signIn
    notFound: {
        body: "The page you're looking for doesn't exist.",
        goHome: 'Go home',
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
        // the Table effects section (TableEffectsSection): the heading also names the three-way switch
        tableEffects: {
            heading: 'Table effects',
            body: 'The season and its particles when trump is called. Calm and Off suit slower phones. Kept on this device.',
            full: 'Full',
            calm: 'Calm',
            off: 'Off',
            // under reduced motion
            reduced: 'Your device asks for reduced motion, so the table shows no particles, whatever you pick here.',
        },
        // the Account section (AccountSection)
        account: {
            heading: 'Account',
            // the address: none, or not confirmed yet
            notSet: 'Not set',
            notConfirmed: '(not confirmed)',
            pending: (address: string) => `Waiting for confirmation: ${address}`,
            // the e-mail button and its sheet's title: no address yet, or one to change
            addEmail: 'Add an email address',
            changeEmail: 'Change Email',
            // the password button, its sheet's title, and the sheet's submit
            changePassword: 'Change Password',
            // after a change of address was sent
            emailNotice: (address: string) => `If this address can be used, a confirmation link is on its way to ${address}. Check your inbox (and spam).`,
            // the deletion request
            deletionRequested: 'Deletion requested — an administrator will process your account removal.',
            deletionQuestion: 'Request deletion of your account? We delete your account and its data within 30 days of your request. You can keep playing until then.',
            keepAccount: 'Keep my account',
            confirmDeletion: 'Confirm request',
            requestDeletion: 'Request account deletion',
            deletionFailed: 'Failed to request deletion',
        },
        // the change-of-address sheet (ChangeEmailForm)
        changeEmail: {
            newEmail: 'New email address',
            newEmailPlaceholder: 'you@example.com',
            newEmailRequired: 'New email address is required',
            currentPassword: 'Current password',
            // under the fields: "{note}", and with an address in force "{note} {keepNote}"
            note: 'If the address can be used, we send a confirmation link to it.',
            keepNote: 'Your current address stays in use until you confirm.',
            submit: 'Send confirmation link',
            // a network or server failure
            notChanged: 'We could not change your email address. Try again.',
            failed: 'Failed to change the email address',
        },
        // the change-of-password sheet (ChangePasswordForm)
        changePassword: {
            currentPassword: 'Current Password',
            newPassword: 'New Password',
            newPasswordPlaceholder: 'Enter new password...',
            confirmNewPassword: 'Confirm New Password',
            confirmNewPasswordPlaceholder: 'Repeat new password...',
            newPasswordRequired: 'New password is required',
            failed: 'Failed to change password',
        },
        // the Log out panel at the bottom of the page
        signedInAs: (username: string) => `Signed in as ${username}`,
    },
    // a table's room (/lobby/:id); S4 extends it
    table: {
        // a failed refresh while the last good table stays on screen
        refreshFailed: (reason: string) => `Could not refresh the table: ${reason}`,
        // the reason when there is none
        unknownError: 'unknown error',
    },
    // a match's details (/matches/:id); S4 extends it
    matchDetails: {
        handsLoadFailed: "Couldn't load the hands",
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
        // under a 429: the forgot-password page and the resend button
        waitAndRetry: 'Wait a while, then try again.',
        // the game socket's own lines (services/gameSocket, mapped in i18n/socketErrors), and Ranked's queue without it
        socket: {
            sessionEnded: 'Your session ended — please sign in again',
            connectRefused: 'Could not connect to the game server. Try again.',
            signInNeeded: 'Authentication required',
            notConnected: 'Not connected to the game server',
        },
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
