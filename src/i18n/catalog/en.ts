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
        // the landing page (/) for a signed-out visitor or a guest: the browser tab only (its h1 is landing.headline)
        landing: 'Belot for four, online',
        // Škola bele (/learn): the tab and the intro's h1 (spec §1.4 Guided hand)
        learn: 'Bela school',
        // the waitlist's confirm page (/waitlist/confirm, from B7's mail): the browser tab; spec §1.4's name
        waitlist: 'Waitlist',
    },
    // the compact HR · EN switch at the top of the signed-in shell and of the public pages: its group's name for screen
    // readers
    langSwitch: {
        label: 'Site language',
        // a toast when the English catalog (its own chunk, i18n/catalog/loadEn) failed or took over 3 s: the first paint,
        // the switch, a sign-in; it shows in the page's language, so in Croatian (Ruling 62)
        englishFailed: "English didn't load. Reload the page to try again.",
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
        unknownPlayer: 'Unknown player',
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
        // a retry after a failed load: Tables, a table, Matches, a match's hands, your climb, the ladder
        retry: 'Try again',
        // any missing value: a name, a mode, a result, a date, a duration
        unknown: 'Unknown',
        // a missing match id or email address
        notAvailable: 'N/A',
        // the label of a list's order: Tables, the admin's users
        sortBy: 'Sort by',
        // you, as a tag or a name: your seat, the ladder's marker, your row in the admin list, a declarations line
        you: 'You',
        // you, in the upper-case tags: Match found, a match's teams and tricks
        youCaps: 'YOU',
        // a team's name: "Team A"
        team: (team: string) => `Team ${team}`,
        // a team's name in the upper-case tags: "TEAM A"
        teamCaps: (team: string) => `TEAM ${team}`,
        // a guest's way back to the landing page (/): the end of a game, the game menu, a game that isn't theirs, a friend's
        // table (a guest can't open Doma or Tables)
        back: 'Back',
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
            // spec §2.1 (D-25): the day an unconfirmed account goes (GET /user/me verifyBy, i18n/format formatLongDate): the banner, Settings → Account, Doma's ranked lock
            removeBy: (date: string) => `If no email address is confirmed by ${date}, the account will be removed.`,
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
            home: 'Back to home',
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
        // the wordmark on every auth page is a link to the landing page (/): its name for screen readers (AuthFrame)
        toStart: 'Stiglja, start page',
        // /login (LoginForm)
        signIn: {
            heading: 'Welcome Back',
            subtitle: 'Sign in to your account',
            usernamePlaceholder: 'Enter your username',
            passwordPlaceholder: 'Enter your password',
            submit: 'Sign In',
            submitting: 'Signing in…',
            forgot: 'Forgot password?',
            // "{noAccount} [signUpLink]"
            noAccount: "Don't have an account?",
            signUpLink: 'Sign up',
            // a failure that is neither the server's nor the network's
            failed: 'Login failed',
            // /login?reason=session-ended (services/gameSocket sends the tab here): sign in, since a reload does nothing
            // on this page; the game connection's own line is errors.socket.sessionEnded (R1-11)
            sessionEnded: 'Your session ended. Sign in again.',
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
            // under the h1 on /signup?invite=… (the personal link from the waitlist's spot email)
            inviteSubtitle: 'A place has opened for you. Create your account with this link.',
            failed: 'Registration failed',
            // a guest signing up under its own name while still at a table or in a game (409 IN_GAME, Ruling 5); the form keeps what was typed
            inGame: 'This name is still at a table or in a game. You can keep it once you leave the table or the game ends, or pick another name now.',
            submitting: 'Creating your account…',
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
                // the panel's second line: the 7 days, as the signup email says them
                removal: 'If the address is not confirmed within 7 days, the account will be removed.',
            },
        },
        // "Red za stol" (spec §2.2): /signup while signup is full (WaitlistForm); title is §1.4's name, also the sign-up doors' label while full (Ruling 6); its bot button is guest.needsAccount.bots, its joined heading auth.signUp.checkInbox.heading
        waitlist: {
            title: 'Waitlist',
            lead: "Signup is full for now. Leave your email address and we'll write to you as soon as a place opens.",
            confirmFirst: "First we'll send a link to confirm the address: it holds a place only once it's confirmed.",
            submit: 'Join the waitlist',
            guestNow: "Don't want to wait? Play right now, as a guest.",
            // after joining: "{joinedBefore} **the address**{joinedAfter}"
            joinedBefore: 'If this address can join the waitlist, a link to confirm it is on its way to',
            joinedAfter: ". Check your inbox (and spam) and confirm it within 7 days. When a place opens, we'll email you a signup link.",
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
            // signed out, under "[Sign in] {toNewLink}": an account not confirmed in 7 days was removed (D-25, R1-05)
            removedSignUp: 'Signed up more than 7 days ago? That account has been removed, so sign up again.',
        },
        // /waitlist/confirm?token=…, the link in the waitlist's confirmation mail; the reload hints are auth.confirm.*
        waitlistConfirm: {
            heading: 'Confirm your place on the waitlist',
            button: 'Confirm my place',
            confirmed: "Your address is on the waitlist. When a place opens, we'll email you a personal signup link, valid for 7 days.",
            // a network or server failure
            failed: "We couldn't confirm your place.",
            // after a dead link (none, expired or unknown): back to /signup, which shows whichever form applies
            again: 'Join the waitlist again',
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
    // any path no route knows (NotFoundPage); its h1 is titles.notFound. Signed in its button is goHome (Doma), signed out
    // goStart (the landing page, /)
    notFound: {
        body: "The page you're looking for doesn't exist.",
        goHome: 'Go home',
        goStart: 'Go to the start page',
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
    // Tables (/lobbies): the list of open tables, a row's quick-look, and the Create table sheet
    tables: {
        // the page's line under its title
        open: (n: number) => `${n} ${plural(n, { one: 'table', other: 'tables' }, 'en')} open`,
        // the page's button and the create sheet's title
        create: 'Create table',
        loadFailed: "Couldn't load the tables",
        loading: 'Loading tables…',
        // the search box's name
        search: 'Search tables',
        // the "Sort by" choices
        sort: {
            newest: 'Newest',
            name: 'Name',
            players: 'Most players',
        },
        // a failed poll while the last good list stays on screen
        pollFailed: "Couldn't refresh — showing the last list",
        // no open table, and a search that finds none
        empty: 'No open tables.',
        emptyBody: 'Create one and invite friends.',
        // the empty list's second way on (spec §8): a game against three bots now (spec §6); its first is privateTable
        emptyBots: 'Play against bots',
        noMatch: 'No tables match your search.',
        // the list's name, for screen readers
        list: 'Open tables',
        // a row's host line, also in its spoken name: "host mira_z"
        host: (name: string) => `host ${name}`,
        // a host without a username
        unknownHost: 'unknown',
        // the lock tag on a row, the quick-look's privacy line, the room's chip
        private: 'Private',
        // a row's tags
        full: 'Full',
        youreIn: "You're in",
        // how a row's spoken name ends: "…, private, you're in"
        rowPrivate: 'private',
        rowYoureIn: "you're in",
        // people of the cap: "2 of 4"
        count: (people: number, cap: number) => `${people} of ${cap}`,
        // the bots after the count: "2 of 4 · 2 bots"
        bots: (n: number) => `${n} ${plural(n, { one: 'bot', other: 'bots' }, 'en')}`,
        // a table without a name
        unnamed: 'Unnamed Table',
        // the quick-look: the table has left the list since it opened
        gone: 'This table is no longer open',
        // the quick-look's host line, and the host's tag on a seat
        hostLabel: 'Host',
        // the quick-look's age line: "Created 5 minutes ago"
        created: (ago: string) => `Created ${ago}`,
        public: 'Public',
        // the quick-look's way in for a member
        enter: 'Go to table',
        // the quick-look's disabled button at a table of four people
        fullButton: 'Table full',
        // the create sheet's switch, the title of the password sheet in a table's room, and the empty Birtija's primary button
        privateTable: 'Private table',
        // the Create table sheet (CreateLobbySheet)
        form: {
            nameLabel: 'Table name',
            namePlaceholder: 'Enter table name...',
            // the name a Stol za ekipu starts with (spec §5; Doma's button and the empty list's): the host can change it
            privateName: (username: string) => `${username}'s table`,
            nameRequired: 'Table name is required',
            casual: "Table games are casual: they don't change your rating.",
            // under the private switch
            privateHelper: 'Private tables require a password to join',
            passwordRequired: 'Password is required for private tables',
            passwordPlaceholder: 'Enter table password...',
            submit: 'Create',
            // a refusal without a reason
            failed: 'Failed to create table',
        },
    },
    // a table's room (/lobby/:id): its seats, its sheets and its action bar
    table: {
        // a failed refresh while the last good table stays on screen
        refreshFailed: (reason: string) => `Could not refresh the table: ${reason}`,
        // the reason when there is none
        unknownError: 'unknown error',
        // a bot request with no usable answer (no answer, or a 5xx)
        botsUnavailable: "Bots aren't available right now. Try again later.",
        // a member following the started match into the game, when that fails
        followFailed: (reason: string) => `Could not open the match: ${reason}`,
        loading: 'Loading table...',
        // the end of a table for you: closed, or the host removed you
        closed: 'This table was closed.',
        removed: 'You were removed from this table.',
        // a failed first load, and its reason when there is none
        loadFailed: "Couldn't load this table",
        loadFailedBody: 'Failed to load table',
        // the way back to the list
        backToTables: 'Back to tables',
        // the invite link: the toast after a copy, and its buttons (the header's and the host's options)
        inviteCopied: 'Invite link copied',
        copyInvite: 'Copy invite link',
        // the invite's second line at a private table (spec §5): its password, when this tab created the table (kept in the tab's session storage, as Privacy says)
        sharePassword: (password: string) => `Password: ${password}`,
        // … or, when this tab didn't create it: the friend asks the host
        shareHostKnows: 'The host knows the password.',
        // the toast after copying the link and the password
        invitePasswordCopied: 'Invite link and password copied',
        // the host's button under the table
        fill: 'Fill with bots',
        // what a seat says while its request runs
        busy: {
            joining: 'Joining…',
            switching: 'Switching…',
            adding: 'Adding…',
            filling: 'Filling with bots…',
            removing: 'Removing…',
        },
        // a request at the table that failed without a reason of its own
        failed: {
            switch: 'Failed to switch team',
            addBot: 'Failed to add a bot',
            fill: 'Failed to fill with bots',
            removeBot: 'Failed to remove the bot',
            join: 'Failed to join table',
            start: 'Failed to start match',
            leave: 'Failed to leave table',
            kick: 'Failed to kick player',
            close: 'Failed to delete table',
        },
        // the question before you leave
        leaveTitle: 'Leave this table?',
        leaveBody: 'Your seat opens for someone else.',
        leave: 'Leave table',
        stay: 'Stay',
        // the host's question before removing a person
        removeTitle: (name: string) => `Remove ${name}?`,
        removeBody: 'They leave the table at once and can join again from the list.',
        removeConfirm: (name: string) => `Remove ${name}`,
        // the host's question before closing the table
        closeTitle: 'Close this table?',
        closeBody: 'Everyone goes back to the list.',
        close: 'Close table',
        // the mode chip under the title
        ranked: 'Ranked',
        casual: 'Casual',
        // the members without a seat, and your own chip's suffix (" · you")
        notSeated: 'Not seated',
        youSuffix: 'you',
        // the action bar: its name for screen readers, a member following the match, and its buttons
        actions: 'Table actions',
        opening: 'Opening the match…',
        options: 'Table options',
        start: 'Start match',
        leaveShort: 'Leave',
        join: 'Join table',
        // your own seat's sheet (SeatSheet)
        seatSheet: {
            title: 'Your seat',
            // a member, who may also leave; the host only stands up
            bodyLeave: 'Stand up to free the seat, or leave the table.',
            body: 'Stand up to free the seat.',
            standUp: 'Stand up',
        },
        // the host's options sheet, under its title
        optionsBody: 'Only you can see these.',
        // an outsider's password sheet at a private table: its line and its submit
        passwordBody: 'Enter the password the host gave you.',
        passwordSubmit: 'Join',
        // a seat's name for screen readers: "Sit here, team B", "ana (you), team A", "Remove Bot-Ana, team A, bot"
        seat: {
            team: (team: string) => `team ${team}`,
            // an empty seat: one you can take, or not; also the seat's name plate
            sitHere: 'Sit here',
            open: 'Open seat',
            // an open seat's name plate, short enough for the 104-px seat in Croatian (R1-36); `open` stays its spoken name
            openPlate: 'Open seat',
            you: '(you)',
            bot: 'bot',
            host: 'host',
            // the host's tap on a bot's seat removes it
            remove: (name: string) => `Remove ${name}`,
            // a bot's tag under its name plate
            tagBot: (team: string) => `Bot · Team ${team}`,
        },
        // the host's "+ Bot" chip under an empty seat: its name for screen readers, and its text
        addBot: (team: string) => `Add a bot to team ${team}`,
        botChip: 'Bot',
        // the table's centre: the quick-look's "players" (and " · 1 bot"), the room's "Ready to deal" or "seated"
        players: 'players',
        readyToDeal: 'Ready to deal',
        seated: 'seated',
        // the host's reason line in the action bar
        waitingFor: (n: number) => `Waiting for ${n} more ${plural(n, { one: 'player', other: 'players' }, 'en')}.`,
        notSeatedYet: (name: string) => `${name} hasn't taken a seat yet.`,
        // a member without a username
        someone: 'Someone',
        everyoneSeated: 'Everyone is seated.',
        // the hint under the table
        hint: {
            outsider: 'You are looking at this table. Join to play.',
            unseated: 'Pick a seat. Partners sit opposite each other.',
            seated: 'The host starts the match when all four seats are taken.',
            // the host's, at a public table with a bot
            host: "Anyone who joins takes a bot's seat. To play alone, create a private table.",
        },
        // a member's status line in the action bar
        onTeam: (team: string) => `You're on Team ${team}.`,
        tapSeat: 'Tap an open seat.',
    },
    // Ranked (/play): the queue, and the Match found sheet over any page
    ranked: {
        // the banner when a declined match sends the other three back here, still queued
        declined: 'Match declined',
        // the panel's eyebrow (the release gate's harness waits for the English)
        eyebrow: 'RANKED',
        // the panel's h1, also its name for screen readers
        heading: 'Find a match',
        // the queue button, by state
        connecting: 'Connecting...',
        joining: 'Joining Queue...',
        leaving: 'Leaving Queue...',
        leave: 'Leave Queue',
        find: 'Play ranked',
        // above the button while the game socket connects, and when it fails
        connectingServer: 'Connecting to game server...',
        connectionError: (reason: string) => `Connection error: ${reason}`,
        // a failure to join or leave the queue
        error: (reason: string) => `Error: ${reason}`,
        // while queued (QueueStatus): the line and the three tiles
        searching: 'Finding players…',
        inQueue: 'Players in queue',
        wait: 'Estimated wait',
        timeInQueue: 'Time in queue',
        // the estimated wait: none yet, then seconds, minutes, or both
        calculating: 'Calculating...',
        seconds: (s: number) => `${s}s`,
        minutes: (m: number) => `${m}m`,
        minutesSeconds: (m: number, s: number) => `${m}m ${s}s`,
        // the Match found sheet (MatchFoundModal); its teams are common.team
        found: {
            title: 'Match found',
            autoAccept: (n: number) => `Auto-accepting in ${n} ${plural(n, { one: 'second', other: 'seconds' }, 'en')}...`,
            accept: 'Accept Match',
            decline: 'Decline',
            // a refused decline without a reason
            declineFailed: 'Could not decline the match',
        },
    },
    // Matches (/matches): the list, its rows (also on Home and Profile) and the Recent form strip
    matches: {
        // the page's line under its title
        count: (n: number) => `${n} ${plural(n, { one: 'match', other: 'matches' }, 'en')}`,
        loadFailed: 'Unable to load match history',
        loadFailedBody: 'Something went wrong while fetching your matches',
        loading: 'Loading your match history...',
        // a page past the last one
        noMore: 'No more matches',
        // no match yet, and the way to play one
        empty: 'No matches yet',
        emptyBody: 'Play a game and it shows up here.',
        findGame: 'Find a game',
        // a refresh while the list stays on screen
        refreshing: 'Loading matches...',
        // the pager's note on a full page: "· 10 matches per page"
        perPage: (n: number) => `${n} ${plural(n, { one: 'match', other: 'matches' }, 'en')} per page`,
        // your result: a row's word, a strip square's name
        outcome: {
            win: 'Victory',
            loss: 'Defeat',
            draw: 'Draw',
        },
        // a strip square's letter
        letter: {
            win: 'W',
            loss: 'L',
            draw: 'D',
        },
        // the game mode's tag; any other mode shows as the server wrote it
        mode: {
            RANKED: 'RANKED',
            CASUAL: 'CASUAL',
        },
        // a row's score when the match was forfeited
        forfeit: 'Forfeit',
        // a row's date: today with its time, yesterday, days ago; after a week the day and month
        today: (time: string) => `Today ${time}`,
        yesterday: 'Yesterday',
        daysAgo: (n: number) => `${n}d ago`,
        // the Recent form strip (RecentForm)
        form: {
            // its name for screen readers, and its heading
            label: 'Recent form',
            // the squares, for screen readers
            order: 'Most recent first',
            // "2 wins · 1 loss on this page", then " · won the last 2"
            line: (wins: number, losses: number) =>
                `${wins} ${plural(wins, { one: 'win', other: 'wins' }, 'en')} · ${losses} ${plural(losses, { one: 'loss', other: 'losses' }, 'en')} on this page`,
            won: (n: number) => `won the last ${n}`,
            lost: (n: number) => `lost the last ${n}`,
        },
    },
    // a match's details (/matches/:id), its hands and their tricks
    matchDetails: {
        handsLoadFailed: "Couldn't load the hands",
        // the hero's h1: your result, when the match names your team
        you: {
            win: 'WIN',
            loss: 'LOSS',
        },
        // the h1 of a match without a result
        unknownResult: 'Unknown Result',
        // a result rebuilt from the server's (spec §1.1): the English is the server's own sentence; a result that
        // doesn't parse shows as the server wrote it
        result: {
            wins: (team: string, a: number, b: number) => `Team ${team} wins ${a}–${b}`,
            byBelot: (team: string, a: number, b: number) => `Team ${team} wins ${a}–${b} by belot`,
            byForfeit: (team: string) => `Team ${team} wins by forfeit`,
        },
        // the hero's id line, and the word beside its count of players
        matchId: (id: string) => `Match ID: ${id}`,
        players: (n: number) => plural(n, { one: 'Player', other: 'Players' }, 'en'),
        // the stat tiles
        tile: {
            duration: 'Duration',
            mode: 'Mode',
            hands: 'Hands',
            tricks: 'Tricks',
        },
        // a team's panel, under its name
        members: (n: number) => `${n} ${plural(n, { one: 'member', other: 'members' }, 'en')}`,
        // the Match summary: each team's final score and its declarations ("40 decl"), a forfeit or a belot
        final: (team: string) => `Team ${team} Final`,
        decl: (n: number) => `${n} decl`,
        wonByForfeit: 'Won by forfeit',
        wonByBelot: 'Won by belot',
        summary: 'Match summary',
        // the raw moves of a match without structured hands: its name, its heading and its columns
        movesLabel: 'Game moves',
        moves: (n: number) => `Game moves (${n})`,
        order: 'Order',
        player: 'Player',
        card: 'Card',
        // the hands: their section's name, and its heading "Game history (2 hands)"
        history: 'Game history',
        handCount: (n: number) => `${n} ${plural(n, { one: 'hand', other: 'hands' }, 'en')}`,
        // the page's states and its way back
        loading: 'Loading match…',
        loadFailed: "Couldn't load this match",
        notAvailable: 'Match data is not available',
        backToList: 'Back to Matches',
        // a passed bid's chip (§1.4 Dalje)
        pass: 'PASS',
        // an open hand's summary: its name and heading, each team's points, the counts, and its tags
        handSummary: 'Hand summary',
        teamPoints: (team: string, points: number) => `Team ${team}: ${points} pts`,
        tricksCount: (n: number) => `Tricks: ${n}`,
        callsCount: (n: number) => `Trump calls: ${n}`,
        capot: 'CAPOT',
        awarded: 'HAND AWARDED (PADANJE)',
        // a hand's row: its tags and its name
        padanje: 'PADANJE',
        illegal: (n: number) => `${n} ILLEGAL`,
        hand: (n: number) => `Hand ${n}`,
        // the declarations line under a hand's summary: its name, then what the table heard
        zvanja: {
            label: 'Declarations',
            none: 'Declarations: none.',
            // "Declarations: ivo 20 (up to Baba), mara –. Team B scores 20."
            said: (list: string, team: string, total: number) => `Declarations: ${list}. Team ${team} scores ${total}.`,
            // "Belot: cy held all eight Pik."
            belot: (text: string) => `Belot: ${text}.`,
        },
        // an open hand's bids, and its challenges with how each went
        calls: 'Trump declarations',
        challenges: 'Challenges',
        challengeBy: 'Challenge by',
        challengeHeld: 'SUCCESS',
        challengeFailed: 'FAIL',
        // Tricks played (TricksPlayed): an illegal card's tooltip, a cell's badges, the section, its tricks and legend
        illegalHint: 'This card broke the rules. It stood unless a challenge caught it.',
        playOrder: 'Play order',
        wonTrick: 'Won the trick',
        trumpTag: 'TRUMP',
        illegalTag: 'ILLEGAL',
        tricksPlayed: 'Tricks played',
        trump: (suit: string) => `Trump: ${suit}`,
        trick: (n: number) => `Trick ${n}`,
        cardCount: (n: number) => `${n} ${plural(n, { one: 'card', other: 'cards' }, 'en')}`,
        partial: 'PARTIAL TRICK (HAND ENDED)',
        legend: 'Columns are players in seat order. The number is the order the card was played; the crown marks the trick’s winner; trumps carry a ring and a chip in the trump suit’s colour.',
    },
    // ranks: the profile header's rank (RankBlock), your climb on your Profile, the ladder above the leaderboard;
    // rank names and taglines are the server's and stay as they are (spec §1.3)
    rank: {
        // the next rank when the ladder hasn't named it
        next: 'the next rank',
        // a placement rank's count (RankBlock, your climb)
        placement: (played: number, total: number) => `Placement: ${played} of ${total} ranked games`,
        // your climb at the top rank, and RankBlock's line there
        top: (name: string) => `${name}: the top rank.`,
        topRank: 'Top rank',
        // RankBlock: "110 to Gospon", and its progress bar's name
        toNext: (gap: number, next: string) => `${gap} to ${next}`,
        progressTo: (next: string) => `Progress to ${next}`,
        // the lines under your climb (the rank's name goes between the pieces, in bold)
        forecast: {
            luck: (points: number, games: number) => `Luck alone can move you about ±${points} points over ${games} games.`,
            far: (next: string, games: number) => `${next} is more than ${games} games away at this pace.`,
            // "At this pace: **Majster** in about 36 games"
            atPace: 'At this pace:',
            inAbout: (n: number) => `in about ${n} ${plural(n, { one: 'game', other: 'games' }, 'en')}`,
            // "148 points to **Majster**: about 5 more wins than losses."
            gapBefore: (gap: number) => `${gap} ${plural(gap, { one: 'point', other: 'points' }, 'en')} to`,
            gapAfter: (wins: number) => `: about ${wins} more ${plural(wins, { one: 'win', other: 'wins' }, 'en')} than losses.`,
        },
        // your climb (ClimbPanel, ClimbChart): the section, its states, the chart's name, its readout and its table
        climb: {
            title: 'Your climb',
            loadFailed: "Couldn't load your climb.",
            loading: 'Loading your climb…',
            empty: 'Your climb starts with your first ranked game.',
            chart: 'Your climb: rating over your ranked games',
            // the readout before the first game
            start: 'Start',
            // the readout and the axis: "Game 57"
            game: (n: number) => `Game ${n}`,
            // the forecast's readout: "about 1480 ± 38", "In 3 games"
            about: (centre: number, spread: number) => `about ${centre} ± ${spread}`,
            inGames: (n: number) => `In ${n} ${plural(n, { one: 'game', other: 'games' }, 'en')}`,
            // the hidden table for screen readers
            caption: 'Your rating after each ranked game',
            gameColumn: 'Game',
        },
        // a column of the hidden tables under both charts
        rating: 'Rating',
        // the ladder (LadderPanel, LadderChart): the panel, its states, your place, the legend and the chart
        ladder: {
            title: 'The ladder',
            loadFailed: "Couldn't load the ladder.",
            loading: 'Loading the ladder…',
            fillsIn: 'The ladder fills in as players finish their first 10 ranked games.',
            ahead: (percent: number) => `Ahead of ${percent}% of ranked players`,
            toJoin: (n: number) => `Play ${n} more ranked ${plural(n, { one: 'game', other: 'games' }, 'en')} to join the ladder.`,
            perRank: 'Players per rank',
            placing: (n: number) => `${n} ${plural(n, { one: 'player still placing', other: 'players still placing' }, 'en')}`,
            // beside the title
            players: (n: number) => `${n} ${plural(n, { one: 'ranked player', other: 'ranked players' }, 'en')}`,
            chart: 'The ladder: players by rating',
            // a bar's readout
            playerCount: (n: number) => `${n} ${plural(n, { one: 'player', other: 'players' }, 'en')}`,
            // the hidden tables for screen readers
            byRating: 'Players by rating',
            playersColumn: 'Players',
            byRank: 'Players by rank',
            rankColumn: 'Rank',
        },
    },
    // Admin (/admin): the permission check, the statistics and the user management
    admin: {
        checking: 'Checking permissions...',
        denied: 'Access Denied',
        deniedBody: "You don't have permission to access the admin panel.",
        // the statistics (AdminStats)
        stats: {
            loading: 'Loading statistics...',
            title: 'System Statistics',
            users: 'Total Users',
            matches: 'Total Matches',
            tables: 'Active Tables',
            deletions: 'Pending Deletions',
        },
        // the signup cap and the waitlist (BetaPanel, spec §2.2, US-17); its counts are spec §9's (S15)
        beta: {
            title: 'Signups and the waitlist',
            loading: 'Loading signup numbers...',
            loadFailed: "Couldn't load the signup numbers",
            // the four tiles: accounts (against the cap: "12 / 50"), confirmed addresses waiting, addresses not yet confirmed, personal links sent but unused
            accounts: 'Accounts',
            waiting: 'Waiting (confirmed)',
            unconfirmed: 'Not confirmed yet',
            invites: 'Links sent, not used yet',
            // the cap's field, its helper, and its save
            cap: 'Signup cap',
            capHelper: "The most accounts the beta takes; bots and guests don't count. Leave it empty for no cap. Raising it emails the next people on the waitlist at once.",
            save: 'Save cap',
            saved: 'Cap saved.',
            // a network or server failure
            saveFailed: "The cap wasn't saved. Try again.",
            // the beta's counts under the cap (BetaPanel's second section, spec §9, US-18; GET /admin/beta's counts from B9): ten numbers and the last 14 Zagreb days; an older backend sends none and the section doesn't show
            counts: {
                title: 'Beta counts',
                lead: 'Is the beta working? Each number covers the last 7 days, today included, unless it says 28. Players who came back finished games on two or more different days, as accounts or guests. A game with people had at least two humans at the table, guests included.',
                days: "The last 14 days in Zagreb time, newest first. Today's numbers can still grow.",
                // the tiles, keyed by the wire's names: the last 7 days with today, unless the label says 28
                tile: {
                    returning7: 'Came back (7 days)',
                    returning28: 'Came back (28 days)',
                    casualWithHumans7: 'Casual games with people',
                    ranked7: 'Ranked games',
                    guideStarted7: 'Bela school started',
                    guideHand1_7: 'Hand 1 finished',
                    guideHand2_7: 'Hand 2 finished',
                    guestSignups7: 'Guests who signed up',
                    invitesSent7: 'Waitlist links sent',
                    invitesUsed7: 'Waitlist links used',
                },
                // the table's columns, keyed by perDay's names
                column: {
                    day: 'Day',
                    casualWithHumans: 'Casual with people',
                    ranked: 'Ranked',
                    guideStarted: 'School: started',
                    guideHand1: 'School: hand 1',
                    guideHand2: 'School: hand 2',
                    guestSignups: 'Guest signups',
                    invitesSent: 'Links sent',
                    invitesUsed: 'Links used',
                },
            },
        },
        // the user management (UserManagement): the list, its columns and tags, and the delete dialog
        users: {
            title: 'User Management',
            found: (n: number) => `${n} ${plural(n, { one: 'user', other: 'users' }, 'en')} found`,
            loading: 'Loading users...',
            loadFailed: 'Error Loading Users',
            loadFailedBody: 'Failed to load user management',
            view: 'View',
            delete: 'Delete',
            // the first column, and the role of a user without one
            user: 'User',
            role: 'Role',
            status: 'Status',
            actions: 'Actions',
            // the status tags
            deletionRequested: 'Deletion Requested',
            active: 'Active',
            empty: 'No Users Found',
            noMatch: 'No users match your search criteria.',
            none: 'No users available.',
            // the search box's name, for screen readers, and its placeholder
            search: 'Search users',
            searchPlaceholder: 'Search by username, email, or ID...',
            failedDelete: 'Failed to delete the user',
            // the delete dialog: "{deleteBefore} **bob**{deleteAfter}"
            confirmTitle: 'Confirm User Deletion',
            warning: 'Warning',
            deleteBefore: 'Delete the account of',
            deleteAfter: '? This cannot be undone.',
            deleteScope: 'Deletes the user record; friendships, match history and rank history remain.',
            deleteUser: 'Delete User',
        },
    },
    // card names: the table, a match's details, the Rules page's cards (the French-suited Croatian set in both languages;
    // a declined form comes only from a whole phrase per rank, never from code)
    cards: {
        // the suits, keyed by the server's enum
        suit: {
            HERC: 'Herc',
            KARA: 'Karo',
            PIK: 'Pik',
            TREF: 'Tref',
        },
        // the ranks, keyed by the server's enum
        rank: {
            SEDMICA: '7',
            OSMICA: '8',
            DEVETKA: '9',
            DESETKA: '10',
            DECKO: 'Decko',
            BABA: 'Baba',
            KRALJ: 'Kralj',
            AS: 'As',
        },
        // every card's name: "As Herc" (cardLabel)
        card: (rank: string, suit: string) => `${rank} ${suit}`,
        // a run's height when it ties an opponent's: "up to Baba" (the declaration moment, the hand history)
        upTo: {
            SEDMICA: 'up to 7',
            OSMICA: 'up to 8',
            DEVETKA: 'up to 9',
            DESETKA: 'up to 10',
            DECKO: 'up to Decko',
            BABA: 'up to Baba',
            KRALJ: 'up to Kralj',
            AS: 'up to As',
        },
        // a four's height when it ties a run: "four Asovi"
        four: {
            SEDMICA: 'four 7',
            OSMICA: 'four 8',
            DEVETKA: 'four Devetke',
            DESETKA: 'four Desetke',
            DECKO: 'four Decki',
            BABA: 'four Babe',
            KRALJ: 'four Kralji',
            AS: 'four Asovi',
        },
        // a belot: the end sheet's reason and the hand history's line; the name may be "You"
        heldAllEight: (name: string, suit: string) => `${name} held all eight ${suit}`,
    },
    // the game page around the table (/game/:id), the phases in words, and how a game ends
    game: {
        // the HUD's phase (game-phase) and the hand result's title before its number is known
        phase: {
            BIDDING: 'Bidding',
            PLAYING: 'Playing',
            HAND_COMPLETE: 'Hand finished',
            COMPLETED: 'Game over',
            CANCELLED: 'Cancelled',
            INITIALIZED: 'Starting',
            DECLARATIONS: 'Declarations',
            SCORING: 'Scoring',
        },
        // a game the server never sent, or says isn't yours: the line and its way back
        notYours: "This game isn't yours or has ended",
        goHome: 'Back to home',
        // a move made while the socket is down (the table's error line; the e2e harness matches the English)
        notSent: 'Not sent — reconnecting',
        // the Reconnecting strip over the table and on Ranked (ReconnectBanner); Retry tries at once
        reconnecting: 'Reconnecting…',
        retry: 'Retry',
        // the hidden "This hand" summary and the menu: a bela declared ("ivo: bela 20")
        belaLine: (player: string) => `${player}: bela 20`,
        // the end sheet: its heading, the winner line under it, and why a game ended other than played out
        end: {
            // the heading for a forfeit, a spectator, or a page without the end yet
            over: 'Game over',
            cancelled: 'Match cancelled',
            // the heading for a played-out game, from my seat (spec §1.4 Win, Loss)
            won: 'You won!',
            lost: 'Next time.',
            // the winner line (the e2e harness reads "Team A wins")
            wins: (team: string) => `Team ${team} wins`,
            winsByBelot: (team: string) => `Team ${team} wins by belot`,
            // the reasons (end-reason)
            forfeited: (team: string, winner: string) => `Team ${team} forfeited — Team ${winner} wins`,
            teamLeft: (team: string) => `Team ${team} left — the game was abandoned (no result)`,
            everyoneLeft: 'Everyone left — the game was abandoned (no result)',
            // a declined ranked match: its reason, and the notice Ranked shows after it
            declined: "A player declined — you're back in the queue",
            cancelledReason: 'The game was cancelled',
        },
    },
    // the table (components/board): the HUD, the seats, my hand, the bids, bela, the challenge, the declarations,
    // the sheets and the live region for screen readers
    board: {
        // the table's region name
        label: 'Game table',
        // the badge over my hand on my turn, and its live line (spec §1.4); in its last 10 s it asks (§1.4 Away)
        yourTurn: 'Your turn',
        away: 'Still there?',
        // the trick in words, for screen readers: "Trick: alice 7 Pik, bob Baba Pik"
        trickWords: (plays: string) => `Trick: ${plays}`,
        // a pass: the bid button, a seat's chip, the bids list (spec §1.4 Dalje)
        pass: 'Pass',
        // all eight tricks: the hand result's tag and Bela Blok's (spec §1.4 Capot)
        capot: 'Capot',
        // the menu's section and the hidden summary's heading
        thisHand: 'This hand',
        // the hidden summary when it isn't my turn
        waiting: 'Waiting for other players...',
        // the crown on a trick's winning card
        wonTrick: 'won the trick',
        // the season beside the trump in the HUD, keyed by the trump suit
        season: {
            HERC: 'spring',
            KARA: 'summer',
            PIK: 'autumn',
            TREF: 'winter',
        },
        // the trick piles: the toast on the opponents' pile, and the piles' names
        piles: {
            closed: "You can only look at your team's tricks",
            mine: (n: number) => `Look at your team's tricks (${n})`,
            theirs: (n: number) => `Opponents' tricks (${n})`,
        },
        // the bid panel (BidPanel): its name and note, the dealer's forced call (spec §1.4), a suit's button
        bid: {
            label: 'Your bid',
            mustCall: 'You must call trump.',
            call: (suit: string) => `Call ${suit}`,
        },
        // the bela prompt over the trump K or Q, and the seat's chip once bela is declared (spec §1.4 Bela)
        bela: {
            prompt: (card: string) => `Declare bela with ${card}?`,
            play: 'Play',
            playBela: 'Play + Bela',
            chip: 'Bela!',
        },
        // a seat's plate and chips (Seats)
        seat: {
            // after a bot's name, in its title and for screen readers
            bot: '(bot)',
            // the dealer chip, for screen readers (the chip shows "D")
            dealer: 'Dealer',
            // the word after a seat's count of cards, for screen readers
            cards: (n: number) => plural(n, { one: 'card', other: 'cards' }, 'en'),
            // the chip on a seat whose challenge is gone, and its words for screen readers
            noChallenge: 'No challenge',
            noChallengeLeft: (name: string) => `${name}: no challenge left`,
            // the declared cards beside a seat, named for screen readers
            declaredMine: 'Your declared cards',
            declared: (name: string) => `${name}'s declared cards`,
        },
        // Challenge (the HUD, the hand result), its hint, and the banner that says it out loud
        challenge: {
            button: 'Challenge',
            used: 'Challenge used',
            info: 'What does Challenge do?',
            hint: "Think an opponent played an illegal card this hand? Challenge to win the whole hand. If you're wrong it costs no points, but you lose your challenge for the rest of the game.",
            usedInfo: "Your challenge was wrong, so it's gone for the rest of the game.",
            // the banner: who, then the outcome; a right one is also the hand result's title
            whoMine: 'You challenge!',
            who: (name: string) => `${name} challenges!`,
            foul: (team: string) => `Foul found: Team ${team} takes the hand`,
            noFoulMine: 'No foul: you have no challenge left',
            noFoul: (name: string) => `No foul: ${name} has no challenge left`,
        },
        // the declaration moment after the trump call (DeclarationMoment): its panel, the winner line, the live line
        moment: {
            title: 'Declarations',
            // the panel is a button that skips the moment (or a belot's wait for the end sheet)
            skip: 'Skip declarations',
            skipToResult: 'Skip to the result',
            // the winner line, and why when the opponents tied on value
            scores: (team: string, total: number) => `Team ${team} scores ${total}`,
            higherMine: (team: string, total: number) => `Yours is higher: Team ${team} scores ${total}`,
            higher: (name: string, team: string, total: number) => `${name}'s is higher: Team ${team} scores ${total}`,
            fourMine: (team: string, total: number) => `Your four beats the run: Team ${team} scores ${total}`,
            four: (name: string, team: string, total: number) => `${name}'s four beats the run: Team ${team} scores ${total}`,
            firstMine: (team: string, total: number) => `You were first: Team ${team} scores ${total}`,
            first: (name: string, team: string, total: number) => `${name} was first: Team ${team} scores ${total}`,
            // my name inside the live line, and a seat that declared nothing
            you: 'you',
            nothing: (name: string) => `${name} nothing`,
            // the whole moment for screen readers: "Declarations: ivo 20, mara nothing. Team B scores 20."
            srLine: (said: string, line: string) => `Declarations: ${said}. ${line}.`,
            // a winning seat's chip for the rest of the hand: "Decl. 50 + 20" (owner, Task M: "Declarations" overran the
            // board's upright seat columns; "Declarations" stays everywhere else)
            chip: (points: string) => `Decl. ${points}`,
            // a belot's line
            belotMine: (suit: string) => `Belot! You hold all eight ${suit}`,
            belot: (name: string, suit: string) => `Belot! ${name} holds all eight ${suit}`,
        },
        // the live region's lines for screen readers, one per event
        say: {
            turn: (name: string) => `${name}'s turn`,
            passed: (name: string) => `${name}: Pass`,
            // a trump call: the live line, and the caller's badge for screen readers
            calledMine: (suit: string) => `You called ${suit}`,
            called: (name: string, suit: string) => `${name} called ${suit}`,
            trump: (suit: string) => `Trump: ${suit}`,
            // a card played; the name is "You" for mine
            played: (name: string, card: string) => `${name} played ${card}`,
            trickMine: 'You win the trick',
            trick: (name: string) => `${name} wins the trick`,
            // the hand's 8th trick (spec §1.4 Last trick)
            lastTrickMine: 'You win the last trick',
            lastTrick: (name: string) => `${name} wins the last trick`,
            bela: (name: string) => `${name}: Bela!`,
            // an older backend's challenges, inferred from the scores
            upheld: (team: string) => `Challenge upheld: Team ${team} takes the hand`,
            upheldNoTeam: 'Challenge upheld',
            failedMine: 'No foul found',
            failed: (name: string) => `${name} challenged: no foul found`,
        },
        // the hand result (HandResult): its title, the challenge window, a row's tags (spec §1.4 Pad) and declarations
        result: {
            hand: (n: number) => `Hand ${n}`,
            nextIn: (seconds: number) => `Next hand in ${seconds} s`,
            nextSoon: 'Next hand shortly',
            fellMine: 'Fell! You fell.',
            fellTheirs: 'They fell.',
            decl: (points: number) => `incl. ${points} from declarations`,
        },
        // the end sheet (EndSheet): Play again's votes and outcomes, its buttons (spec §1.4 Rematch)
        end: {
            votes: (n: number) => `${n}/4 want to play again`,
            left: (name: string) => `${name} left — no new game`,
            expired: 'Too late to play again',
            playAgain: 'Play again',
            // a guest's way to people (spec §6): sign up (Ruling 6); a guest's way out is common.back, a member's titles.home
            withPeople: 'Play with people',
        },
        // the game menu (GameMenu): its title (also the HUD button's name), the hand, the way home and its note
        menu: {
            title: 'Game menu',
            noBids: 'No bids yet',
            backHome: 'Back to home',
            leaveNote: "Your seat stays. If you're away, the timer plays for you; 5 missed turns in a row forfeit (casual: the game is cancelled).",
            yourTeam: (team: string) => `Your team: ${team}`,
        },
        // Bela Blok (BelaBlok): the score sheet, a column on desktops and a sheet on phones ("Blok" in the HUD)
        blok: {
            title: 'Bela Blok',
            short: 'Blok',
            hint: "Tap your team's pile to look at the tricks you've won this hand.",
            // a row's tag for the team that fell (a record, not the moment)
            pad: 'Pad',
            empty: 'No hands yet',
            total: 'Total',
        },
        // my hand (Hand): the toolbar's name, and the hidden list of my cards
        hand: {
            label: 'Your hand',
            list: (cards: string) => `Your hand: ${cards}`,
            // a card Škola bele's coach marks (open beta §7.2, §7.3): its name for screen readers, "As Herc, highlighted"
            marked: (card: string) => `${card}, highlighted`,
        },
        // the won-trick peek (Peek): my team's tricks this hand; the 8th is "Last trick" (spec §1.4)
        peek: {
            title: "Your team's tricks",
            loading: 'Loading the tricks…',
            empty: 'No tricks won yet this hand.',
            trick: (n: number) => `Trick ${n}`,
            lastTrick: 'Last trick',
        },
    },
    // the Rules page (/rules): the guide's pictures and buttons, and the full rules' disclosure; its prose (the opening
    // line, the guide's steps, every rule) is in src/i18n/docs/rules.{hr,en}.tsx
    rules: {
        // the guide (RulesGuide): its heading (also the steps list's name) and each step's link to its full rule
        guide: {
            heading: 'How to play',
            fullRule: 'Full rule ›',
            partner: 'Partner',
            opponent: 'Opponent',
            // step 2's switch between a suit's two orders, and the row's name for screen readers
            order: {
                label: 'Card order',
                plain: 'Other suits',
                plainList: 'Herc as another suit, highest first',
                trumpList: 'Herc as trump, highest first',
            },
            trump: 'Trump',
            toCome: 'two more cards to come',
            // step 4: a trick to try
            follow: {
                question: 'Karo 9 was led. Which card may you play?',
                led: 'Led',
                yourCards: 'Your cards',
                prompt: 'Tap a card to see if you may play it.',
                // the line after a tap, by card (rulesData FOLLOW_HAND)
                verdict: {
                    beats: 'Yes: it follows suit and beats the 9.',
                    mustBeat: 'Not this one: you can beat the 9 with your Kralj, so you must.',
                    followFirst: 'Not this one: you have Karo, so you must follow suit before you trump.',
                    mustFollow: 'Not this one: you have Karo, so you must follow suit.',
                },
            },
            padanje: 'Padanje',
            capot: 'Capot +90',
            illegal: 'Illegal',
        },
        // the disclosure that holds every rule
        full: {
            heading: 'Full rules',
            note: 'Every rule, as the server enforces it.',
        },
        // the Rules page's top link into Škola bele (spec §7.1)
        learn: 'Rather learn by playing? Try Bela school ›',
    },
    // a guest (spec §3): the page a guest gets in place of a member-only one (NeedsAccountPage), the guest door on sign-in from a table's link, and the name a removed account shows under
    guest: {
        // a removed account's name (obrisan_…, spec §3.1, §1.4 Guest) in lists, seats and history (components/common/displayName)
        removed: 'Guest',
        // NeedsAccountPage: its h1 is the area's own name (titles.*); then this title, the area's line and the unlock line, and two buttons
        needsAccount: {
            title: 'This needs an account',
            // one line per locked area: what it is
            what: {
                home: 'Your stats, your recent games and all the ways to play, in one place.',
                ranked: 'Ranked games against people, with a rating and a rank that climb as you win.',
                tables: 'The open tables: sit down with other players, or open a table of your own.',
                matches: 'All your games, hand by hand.',
                friends: 'The players you add as friends, and the requests they send you.',
                leaderboard: "Every player's rank and rating.",
                profile: "Your rank, how your rating moves and your games, and other players' profiles.",
                settings: 'Your email, your password, table effects and your account. You can change the language as a guest too, just below.',
            },
            unlock: "A free account unlocks it. As a guest you can already play against bots, or sit at a friend's table from the link they send you.",
            // to /signup, which becomes the waitlist when signup is full (Ruling 6: auth.waitlist.title while signup is full)
            signUp: 'Sign up',
            bots: 'Play against bots as a guest',
        },
        // sign-in, reached from a friend's table link (/lobby/…) with no session (spec §3.2); only with call 5
        tableDoor: {
            // the page's h1 above the door; the sign-in form's heading is then an h2 (R1-01, Ruling 79)
            heading: 'A table is waiting for you',
            lead: 'You can sit at this table without an account, as a guest.',
            sitDown: 'Sit down as a guest',
        },
    },
    // the landing page (/, spec §4): signed out or a guest. The top row's "Sign in" is titles.signIn; the doors' errors are table.botsUnavailable and errors.*
    landing: {
        headline: 'Belot for four, online.',
        lead: 'Your table is ready: three bots are waiting, or bring your crew.',
        doors: 'Ways to start',
        // door 1 (highlighted): Škola bele
        learn: {
            title: 'Bela school',
            body: 'Play your first hand with a guide, step by step. No account needed.',
            action: 'Teach me',
        },
        // door 2: a bot game now, as a guest
        bots: {
            title: 'Bots',
            body: 'I know how to play: a game against three bots, right now, as a guest.',
            action: 'Play now',
        },
        // door 3: sign up (Ruling 6: auth.waitlist.title while signup is full)
        people: {
            title: 'People',
            body: 'Ranked and friends. An account is free.',
            action: 'Sign up',
        },
        // the line above the doors after a guest session ended for good (Ruling 7); label names the region
        ended: {
            label: 'Guest session ended',
            body: 'Your guest session has ended. Choose below how to start again.',
        },
        // a returning guest's panel above the doors; with a game running it shows shell.activeGame.body and .action
        guest: {
            continueAs: (name: string) => `Continue as ${name}`,
            body: "This browser remembers your guest name. Change it whenever you like: it's the name everyone at the table sees.",
            rename: 'Change name',
        },
        // the sheet that changes a guest's name (its field is forms.username)
        rename: {
            title: 'Change your guest name',
            save: 'Save',
            failed: "Your name wasn't changed. Try again in a moment.",
        },
    },
    // Doma (/dashboard, spec §5); the game card is shell.activeGame, the ranked lock is shell.unverified, the stat "Level" is common.level, and "Elo" stays as on the profile
    home: {
        greeting: (name: string) => `Hi, ${name}! What are we playing?`,
        greetingNoName: 'Hi! What are we playing?',
        // the half "Protiv botova"; its seats are common.you and bot
        bots: {
            title: 'Against bots',
            body: "Three bots, and the game starts at once. It doesn't change your rating.",
            seats: 'Seats at the table',
            bot: 'Bot',
            play: 'Play now',
        },
        // the half "Protiv ljudi": ranked (primary), Stol za ekipu, Birtija (n)
        people: {
            title: 'Against people',
            body: 'Real players: ranked for your rating, tables for company.',
            ranked: 'Play ranked',
            private: 'Private table',
            tables: (n: number) => `Tables (${n})`,
        },
        stats: {
            games: 'Games',
        },
        // the recent matches beside the stats
        recent: {
            title: 'Recent matches',
            all: 'All matches',
            failed: "Couldn't load your recent matches.",
            loading: 'Loading matches...',
            none: 'No matches yet',
        },
        // under everything: to Škola bele
        newToBela: {
            title: 'New to bela?',
            action: 'Bela school',
        },
    },
    // Škola bele (/learn, spec §7): the intro before the deal (its h1 is titles.learn), the lesson panel on the board,
    // hand 1's lessons in order (D-19, Ruling 49), why a move isn't the step's move, the way out, and the end of hand 1.
    // Players are named as in B8's recording; cards as the board names them.
    guide: {
        intro: {
            lead: "You'll play one hand at a real table, step by step. First, meet the cards.",
            deck: 'Belot uses 32 cards: 7, 8, 9, 10, Decko (jack), Baba (queen), Kralj (king) and As (ace), in four suits: Herc (hearts), Karo (diamonds), Pik (spades) and Tref (clubs).',
            // the table: its caption and columns
            caption: 'What each card is worth',
            card: 'Card',
            trump: 'In trump',
            plain: 'In other suits',
            trumpNote: 'Trump is the suit someone calls at the start of a hand, and it beats every other suit. In trump the Decko and the 9 jump to the top.',
            // the two orders: "Decko, 9, As, 10, Kralj, Baba, 8, 7"
            trumpOrder: (ranks: string) => `In trump, highest first: ${ranks}.`,
            plainOrder: (ranks: string) => `In other suits, highest first: ${ranks}.`,
            lastTrick: "The last trick is worth 10 more: a hand's cards are worth 152, and 162 with the last trick.",
            start: 'Deal the cards',
        },
        // the panel's title while the cards are dealt, before the first lesson
        dealing: 'Dealing…',
        // a lesson that waits for no move: on to the next (not "Pass", which is the bid)
        next: 'Next',
        // under every lesson: its section of the Rules, in a new tab (US-23)
        rules: 'More in the Rules ›',
        lessons: {
            dalje: { title: 'Bidding', body: "You sit at the bottom. Mara, opposite you, is your partner; Ivo and Ana play against you. Everyone holds six cards; two more come once someone calls trump. In turn from the player after the dealer, each calls a trump suit or passes. Ivo passed. You're the dealer, so you go last." },
            mus: { title: 'You must call trump.', body: "Mara and Ana passed too. When everyone passes, the dealer must call trump and can't pass. You may call any suit, but the team that calls trump must end the hand with more points than the other. Herc is your best: you hold three, and the Kralj and Baba of trump in one hand are bela, 20 more points." },
            zvanja: { title: 'Declarations', body: "Everyone got two more cards. You now hold 9, 10, Decko and Baba of Tref in a row: a declaration worth 50. Ivo holds Decko, Baba and Kralj of Pik: 20. The game finds declarations for you and says them before the first card. Only the team with the best one scores, and it scores all of its own: yours is worth more than Ivo's, so your team scores 50 and Ivo and Ana nothing." },
            followSuit: { title: 'Follow suit', body: 'Ivo led As Tref; with your card these four cards make a trick. You must follow with Tref, and none of yours beats the As: play the weakest.' },
            mustTrump: { title: 'Trump it', body: 'Ivo led 9 Karo. You have no Karo, so you must trump with Herc; nobody has trumped yet, so any Herc will do.' },
            lead: { title: 'Your lead', body: 'The trick is yours: even the smallest trump beats every other suit. Whoever takes a trick leads the next, so you may play any card. The As Tref has been played, so 10 Tref is now the best Tref left.' },
            foul: { title: 'Watch this trick', body: "Ivo trumps with 9 Herc. That's allowed only if he has no Tref; if he has one, it's a foul." },
            bela: { title: 'Bela', body: 'Ivo led Decko Herc, the top trump: follow with any Herc. Kralj and Baba of trump are bela, 20 points, but you have to call it yourself.' },
            foulSeen: { title: 'He had Tref after all', body: "Ivo led Kralj Tref: he held Tref, yet trumped in the third trick. That's a foul." },
            followAfterCut: { title: 'After someone trumps', body: 'Ana has no Tref, so she trumped. You must follow with Tref, but once someone has trumped, any Tref will do: give her the Decko, worth 2.' },
            followTrump: { title: 'Trump on trump', body: 'Ana led As Herc, a trump. When trump is led you must follow with trump, higher if you can: your only Herc is the Baba.' },
            followPik: { title: 'Follow suit again', body: "Ana took the trick again and led As Pik. You hold 7 Pik, so you must follow with Pik, even though it can't beat the As." },
            lastTrick: { title: 'Last trick', body: 'Ana led 9 Pik; you have no Pik and no trump, so any card will do. All the cards are worth 152 points, and 162 with the last trick.' },
            padanje: { title: 'Fell! You fell.', body: "Mara took the last trick. Your team has 102 points: 5 and 17 from two tricks, 10 for the last trick, 50 for the declaration and 20 for bela. Ivo and Ana have 130. The team that calls trump must score more than the other; yours didn't, so it fell, and Ivo and Ana take all 232 points of the hand." },
            challenge: { title: 'Challenge', body: "Now challenge Ivo's foul from the third trick. The game doesn't block illegal cards, it records them: people slip up, but the bots on Stiglja never play one. You challenge during a hand or in the 10 seconds after it; here the clock waits for you. Each player has one challenge per game. A right challenge stays yours, and your team takes the whole hand. A wrong one costs no points, but you lose your challenge for the rest of the game." },
            foulFound: { title: 'Foul found', body: 'Ivo broke the rules, so your team takes the whole hand: 162 points in cards, 50 for the declaration and 20 for bela, 232 in all. Ivo and Ana score nothing, and you keep your challenge because you were right.' },
        },
        // what to do, on the steps that wait for a move (the board's own button and card names)
        do: {
            mus: 'Press "Call Herc".',
            followSuit: 'Play 9 Tref.',
            mustTrump: 'Play 7 Herc.',
            lead: 'Play 10 Tref.',
            bela: 'Tap Kralj Herc, then choose "Play + Bela".',
            followAfterCut: 'Play Decko Tref.',
            followTrump: 'Play Baba Herc.',
            followPik: 'Play 7 Pik.',
            lastTrick: 'Play Baba Tref.',
            challenge: 'Press "Challenge".',
        },
        // why a tapped card isn't the move: it breaks a rule here
        illegal: {
            followSuit: 'You hold Tref, so you must follow with Tref.',
            mustTrump: 'You have no Karo, so you must trump: play a Herc.',
            bela: 'Herc was led and you hold Herc: you must follow with Herc.',
            followAfterCut: 'You hold Tref, so you must follow with Tref, even though Ana trumped.',
            followTrump: 'Trump was led and you hold Herc: you must follow with trump.',
            followPik: 'You hold Pik, so you must follow with Pik.',
        },
        // why a tapped card isn't the move: it is allowed, but the lesson plays another
        other: {
            followSuit: "You may, but you can't beat the As, so don't give away points: 9 Tref is worth nothing outside trump.",
            mustTrump: 'You may, but keep the Kralj and Baba of Herc for bela. Play 7 Herc.',
            lead: 'You may lead any card, but here play 10 Tref.',
            bela: 'You may play the Baba, but here play Kralj Herc and declare bela.',
            followAfterCut: 'You may play the Baba, but Ana takes this trick, so give her less: play Decko Tref.',
        },
        // why a move isn't the step's move, whatever the lesson
        refuse: {
            bela: 'Right card, but declare bela too: choose "Play + Bela", or you miss its 20 points.',
            bid: 'You may call any suit, but here call Herc: you hold three, the Kralj and Baba among them for bela.',
            pass: "You can't pass: when everyone else passes, the dealer must call trump.",
            challengeEarly: 'In a real game you may challenge from the first card. But nobody has broken a rule yet: the challenge would be wrong and use up your only one for the game.',
            challengeFoul: 'Well spotted! In a real game a right challenge now would end the hand at once. Here we play it out so you see the scoring too, and you challenge after the hand.',
            // at the padanje stop the hand is over: its 10 seconds are the real time to challenge (Ruling 70)
            challengeNow: 'Right time: in a real game you\'d challenge now, within 10 seconds. Read this first, then press "Next".',
            readFirst: 'Read this first, then press "Next".',
            card: 'Here, play the highlighted card.',
        },
        // the way out: the button, where it goes (a member: Home; a guest or a visitor: the landing page), and the
        // game menu's note
        exit: {
            label: 'Exit',
            home: 'Back to Home',
            start: 'Back to the start page',
            menuHome: 'You go back Home. You can replay Bela school any time.',
            menuStart: 'You go back to the start page. You can replay Bela school any time.',
        },
        // the end of hand 1 (S14 completes it): what was learned, what comes next, and the ways on
        end: {
            title: 'Hand 1 done',
            learned: 'Now you know how to call trump, follow suit, trump, declare bela, count a hand and challenge a foul.',
            next: 'Next is hand 2, against three bots, with a fresh deal.',
            // signed out only: the game makes them a guest
            guest: "You'll play as a guest: no account needed.",
            play: 'Play hand 2',
            again: 'Replay Bela school',
            // the hand-2 intro (S14): how hand 2 differs, and that the guide ends with it
            hints: 'This time the deal is random and the moves are yours. On your turn the cards you may play are highlighted, and "Why?" says why. Before an illegal card you get a warning, but the choice is yours.',
            after: 'The guide ends with that hand; then you choose how to go on.',
        },
        // hand 2 on the game page (/game/:id?guide=1, spec §7.3): the panel under the HUD, the hint (why the marked cards:
        // the rule the server applied), the trump tip, and the warning before an illegal card (D-24)
        hand2: {
            title: 'Hand 2',
            wait: 'Play as in a real game. On your turn, the cards you may play are highlighted.',
            play: 'The highlighted cards are the ones you may play.',
            tip: 'Call the suit you hold most of, best with its Decko or 9, the top trumps. Nothing good? Pass. The team that calls trump must end the hand with more points.',
            tipMust: 'Everyone else passed, so you call: pick the suit you hold most of, best with its Decko or 9.',
            done: 'The hand is over. Look at the result; then you choose how to go on.',
            hint: 'Why?',
            // the rule behind the marked cards, by what the server allowed; the suits as the board names them
            why: {
                lead: 'You lead this trick, so any card may go.',
                follow: (suit: string) => `${suit} was led and you hold ${suit}, so you must follow suit. Any ${suit} of yours may go here.`,
                beat: (suit: string) => `${suit} was led and you can beat the best ${suit} on the table, so you must play a higher one.`,
                followTrump: 'Trump was led and you hold trump, so you must follow with trump. Any of yours may go here.',
                overTrump: 'Trump was led and you can beat the best trump on the table, so you must play a higher trump.',
                cut: (suit: string, trump: string) => `You have no ${suit}, so you must trump: play a ${trump}.`,
                overCut: (suit: string) => `You have no ${suit}, so you must trump, higher than every trump already in the trick, since you can.`,
                any: (suit: string) => `You have no ${suit} and no trump, so any card may go.`,
                noTrump: 'Trump was led and you have no trump, so any card may go.',
                other: 'The highlighted cards are the ones the rules allow now.',
            },
            // before a card outside the highlighted ones: it still goes if they say so
            warning: {
                title: 'An illegal card',
                body: 'Against people, someone could challenge this card. Bots never challenge.',
                anyway: 'Play it anyway',
                other: 'Choose another card',
            },
        },
        // the guide's end, over the game after hand 2's first hand (spec §7.4, Ruling 9); the sign-up button is
        // guest.needsAccount.signUp or auth.waitlist.title
        done: {
            title: 'Bela school is done',
            lead: 'You know how to play now. Choose where to go next.',
            guestCan: 'As a guest you can already:',
            guestBots: 'play against bots, any time',
            guestFriends: "sit at a friend's table from the link they send you",
            accountAdds: 'What a free account adds:',
            addsRanked: 'Ranked, and a rank of your own',
            addsFriends: 'Friends',
            addsMatches: 'Matches: every game you play',
            addsName: "a name that's yours for good",
            clock: "The game goes on meanwhile: on your turn, if you're away, the timer plays for you.",
            continue: 'Continue this game',
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
        // under a 429: the forgot-password page and the resend button
        waitAndRetry: 'Wait a while, then try again.',
        // the game socket's own lines (services/gameSocket, mapped in i18n/socketErrors), and Ranked's queue without it
        socket: {
            sessionEnded: 'Your session ended. Reload the page, and sign in again if asked.',
            connectRefused: 'Could not connect to the game server. Try again.',
            signInNeeded: 'Authentication required',
            notConnected: 'Not connected to the game server',
        },
        // the credential rules: the forms' own check, and the server's field message for the same rule
        rules: {
            password: 'Password must be at least 8 characters and at most 72 bytes',
            username: 'Username must be 3–20 characters: letters (including č ć š ž đ), digits or _',
        },
        // one line per code: the REST codes (backend exceptions/ErrorCodes.java) and the game's refusals on
        // /user/queue/errors (matched by their text in serverErrors.ts)
        codes: {
            // signing in, signing up and the account
            SESSION_EXPIRED: 'Your session has expired. Reload the page, and sign in again if asked.',
            UNAUTHENTICATED: 'You need to sign in for that. Sign in, then try again.',
            BAD_CREDENTIALS: 'Wrong username or password. Check both and try again.',
            WRONG_PASSWORD: 'Current password is incorrect',
            ACCESS_DENIED: "You don't have permission to do that.",
            RATE_LIMITED: 'Too many tries. Wait a little, then try again.',
            SERVICE_UNAVAILABLE: "The server isn't answering right now. Try again in a minute.",
            INVITE_CODE_INVALID: 'Invalid invite code. Check it and try again.',
            USERNAME_TAKEN: 'Username is already taken. Names that differ only in capitals or in the marks on č ć š ž đ count as the same name. Choose another one.',
            // sign-up (and later a guest's new name): obrisan_… is the name a removed account gets
            USERNAME_RESERVED: 'Names starting with obrisan_ are reserved. Choose another one.',
            // a guest's new name (and, from B7, a guest claiming it at sign-up) while at a table or in a game
            IN_GAME: "You can't change your name while you're at a table or in a game. Leave the table or finish the game, then try again.",
            // a member at a guest's own name route (B4); the SPA offers it only to a guest
            GUEST_ONLY: 'Only a guest can change their name this way.',
            // the cap and the waitlist (B7): /signup turns into the waitlist under SIGNUP_FULL or INVITE_LINK_INVALID; WAITLIST_LINK_INVALID on the confirm page (expired and unknown alike, Ruling 42; joining again voids the old mail's link, Ruling 81)
            SIGNUP_FULL: "Signup is full, so no account was created. Join the waitlist below, and we'll email you when a place opens.",
            INVITE_LINK_INVALID: 'This signup link is invalid or has expired, and signup is full right now. Join the waitlist again below, or play as a guest.',
            WAITLIST_LINK_INVALID: 'This waitlist link is invalid or has expired. If you got more than one mail, only the link in the newest one works. Join the waitlist again to get a new one.',
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
            // the admin's signup cap (BetaPanel): the server's refusal and the field's own check
            CAP_INVALID: 'The signup cap must be a whole number, 0 or more. Leave it empty for no cap.',
            // B9's guide count route (POST /api/public/guide-events): never shown, since the counts fail silently (S15); here so every code has a line (Ruling 4)
            GUIDE_EVENT_INVALID: "The server didn't recognise this Bela school event, so nothing was recorded.",
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
            LOBBY_ID_REQUIRED: 'This table no longer exists.',
            LOBBY_NOT_FOUND: 'This table no longer exists.',
            LOBBY_CLOSED: 'This table is closed.',
            LOBBY_FULL: 'This table is full.',
            LOBBY_PASSWORD_REQUIRED: 'This is a private table. Enter its password.',
            LOBBY_PASSWORD_WRONG: 'Wrong table password. Try again.',
            LOBBY_PASSWORD_TOO_LONG: 'That password is too long. Choose a shorter one.',
            HOST_ONLY: "Only the table's host can do that.",
            HOST_CANNOT_LEAVE: "The host can't leave the table. Close the table instead.",
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
            // the one-click bot game (spec §6)
            ALREADY_IN_GAME: 'You already have a game in progress. Go back to it first.',
            // ranked (the queue, a found match, match history)
            EMAIL_NOT_VERIFIED: 'Verify your email to play ranked. Open your confirmation link if you have one, or ask for a new one, then try again.',
            ALREADY_QUEUED: "You're already in the queue.",
            DECLINE_COOLDOWN: (seconds: number) =>
                `You declined a match. Wait ${seconds} more ${plural(seconds, { one: 'second', other: 'seconds' }, 'en')}, then queue again.`,
            DECLINE_TOO_LATE: 'This match can no longer be declined',
            NOT_A_PARTICIPANT: "You're not playing in this game.",
            MATCH_NOT_FOUND: "We couldn't find that match.",
            // the game: a refused move or Play again, shown on the table
            GAME_NOT_FOUND: 'This game is no longer running.',
            CANT_CHALLENGE: "You can't challenge now.",
            DECLARATIONS_BEING_SAID: 'Wait until the declarations are shown, then play your card.',
            DEALER_MUST_CALL: 'You must call trump.',
            WAIT_FOR_PAUSE: 'Wait for the next hand to start.',
            REMATCH_UNAVAILABLE: "Play again isn't available for this game.",
        },
    },
};
