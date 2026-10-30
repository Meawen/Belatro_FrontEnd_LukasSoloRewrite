import type { LegalDoc } from './types';
import { SupportEmailLink } from '../../components/layout/LegalLinks';

/** The privacy notice in English (spec §1.2): legal text; the owner reviews it with the Croatian (R1). */
export const doc: LegalDoc = {
    updated: 'Last updated: October 2026.',
    intro: 'This notice explains what Stiglja, a beta of the card game Belot, does with your personal data.',
    sections: [
        {
            title: 'Who runs Stiglja',
            body: (
                <>
                    <p>Stiglja is run by Lukas Miholić, Bregana, Croatia.</p>
                    <p>The operator decides how your data is used. For anything about your data, write to <SupportEmailLink />.</p>
                </>
            ),
        },
        {
            title: 'What we collect',
            body: (
                <ul className="list-disc pl-6 space-y-2">
                    <li>
                        <strong>Your account:</strong> your username, your email address (and a new address
                        while it waits for confirmation) and your password, which we store only as a one-way
                        hash that cannot be turned back into the password.
                    </li>
                    <li>
                        <strong>Your language:</strong> the language you choose for the site, Croatian or English. Your browser keeps
                        it on this device; if you have an account, we also save it on your account and send your emails in it. When
                        you sign up, your account starts in the language the site was in.
                    </li>
                    <li>
                        <strong>Your games:</strong> every game you play (bids, cards, challenges and results),
                        your match history, your Elo rating and its history, your number of games and level,
                        the tables you create or join, and your friends and friend requests.
                    </li>
                    <li>
                        <strong>As a guest:</strong> if you play without an account, we make a guest for you: a guest name such as
                        gost_4821 (you can change it), the site's language, when the guest was made and last used, and the games it
                        plays (bids, cards, challenges and results). A guest has no email address.
                    </li>
                    <li>
                        <strong>On the waitlist:</strong> when signup is full, you can leave your email address so that we can tell
                        you when a place opens. We keep the address, the language the site was in when you joined, and when you
                        joined and confirmed it.
                    </li>
                    <li>
                        <strong>Security data:</strong> your IP address, kept only in the server's memory to
                        limit how often sign-in, signup, guest play, the waitlist and Bela school's counts can be used,
                        and never written to our database; and your username in the server's logs, which record what the
                        service did (for example a sign-in or a game event).
                    </li>
                    <li>
                        <strong>In your browser:</strong> when you sign in, the site keeps a sign-in token and
                        your user id and username in your browser's local storage, so that you stay signed in.
                        Signing out removes them. If you play as a guest, the site keeps the guest there in the same way. It also
                        keeps your language and your table effects setting there. For a private table you create, it keeps the
                        password in the tab's session storage until you close the tab, so that you can share it. Stiglja sets no
                        advertising or analytics cookies and uses no trackers.
                    </li>
                    <li>
                        <strong>Simple counts:</strong> to see whether the beta works, the server keeps a few daily totals: how many
                        games finished with two or more people at the table, how often Bela school was started and each of its two
                        hands finished, and how many guests signed up. These are numbers only. To count the players who come back,
                        it also notes which accounts and guests played on which day, by user id only, and deletes each note after
                        40 days. When you use Bela school, your browser tells the server when you start it and when you finish each
                        hand; the server only adds one to that day's total and does not record who you are.
                    </li>
                </ul>
            ),
        },
        {
            title: 'Why we use it',
            body: (
                <>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>
                            To provide the game you signed up for (our contract with you): your account, your
                            games, rankings and friends, and the emails about your account (confirming your
                            address, resetting your password, security notices).
                        </li>
                        <li>
                            To let you play as a guest, and to show the site and send your emails in your language (our contract
                            with you).
                        </li>
                        <li>
                            To run the waitlist you asked to join (at your request): we email you to confirm your address and, when a
                            place opens, to send your signup link. We send nothing else to that address.
                        </li>
                        <li>To see whether the beta works (our legitimate interest): the simple counts described above.</li>
                        <li>
                            To keep Stiglja secure and working (our legitimate interest): limiting sign-in and
                            signup attempts, and keeping logs to find faults and abuse.
                        </li>
                    </ul>
                    <p>We do not sell your data or use it for advertising.</p>
                </>
            ),
        },
        {
            title: 'Who processes it for us, and where',
            body: (
                <>
                    <p>These companies handle data on our behalf, only to run Stiglja:</p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li><strong>Fly.io</strong> runs the game server, in Frankfurt, Germany.</li>
                        <li>
                            <strong>MongoDB Atlas</strong> stores accounts, guests, the waitlist, the counts and game history, on
                            Amazon Web Services in Frankfurt, Germany (eu-central-1).
                        </li>
                        <li>
                            <strong>Redis Cloud</strong> holds running games and sign-in sessions, on Amazon Web
                            Services in Frankfurt, Germany (eu-central-1).
                        </li>
                        <li><strong>Brevo</strong> sends our emails, from the European Union.</li>
                        <li>
                            <strong>Cloudflare</strong> serves this website and the card images, runs our domain's
                            DNS, and forwards mail sent to <SupportEmailLink />.
                        </li>
                    </ul>
                    <p>
                        Fly.io and Cloudflare see your IP address when they carry your traffic. Some of these
                        companies are based outside the European Union, mainly in the United States; we use their
                        EU locations wherever we can.
                    </p>
                </>
            ),
        },
        {
            title: 'How long we keep it',
            body: (
                <>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Your account and game history: for as long as your account exists.</li>
                        <li>
                            An account whose email address is not confirmed within 7 days of signup: removed when those 7 days are
                            over. The email we send when you sign up gives the date.
                        </li>
                        <li>A guest: removed 30 days after it was last used, never in the middle of a game.</li>
                        <li>
                            When we remove a guest or an unconfirmed account, we replace its name and delete its email address and
                            password. Its games stay in the other players' match history, where it shows as "Guest".
                        </li>
                        <li>
                            A waitlist address: deleted if it is not confirmed within 7 days. A confirmed address stays until you
                            sign up, until the signup link we send you expires unused (after 7 days), or until you ask us to remove
                            it.
                        </li>
                        <li>Notes of who played on which day, for the counts: 40 days. The daily totals hold no personal data.</li>
                        <li>
                            A running game: up to 24 hours after its last move; a finished one: 10 minutes. Its
                            record then stays in your match history.
                        </li>
                        <li>IP addresses held to limit attempts: dropped within about an hour, and whenever the server restarts.</li>
                        <li>Server logs: only as long as our hosting provider, Fly.io, keeps them.</li>
                    </ul>
                    <p>
                        You can ask us to delete your account at any time, with "Request account deletion" in
                        Settings or by writing to <SupportEmailLink />. We delete your account and its data within
                        30 days of your request.
                    </p>
                    <p>To leave the waitlist, write to <SupportEmailLink /> from the address on the list, and we remove it.</p>
                </>
            ),
        },
        {
            title: 'Your rights',
            body: (
                <>
                    <p>
                        You may ask for a copy of your data, have it corrected or deleted, ask us to limit or stop
                        using it, and receive it in a machine-readable form. Write to <SupportEmailLink />; we
                        answer within one month.
                    </p>
                    <p>
                        If you think we handle your data unlawfully, you can complain to the Croatian data
                        protection authority, Agencija za zaštitu osobnih podataka (AZOP):{' '}
                        <a href="https://azop.hr" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2 hover:text-text">azop.hr</a>.
                    </p>
                </>
            ),
        },
        {
            title: 'Age',
            body: <p>Stiglja is for people aged 16 or over. Please do not sign up or play as a guest if you are younger.</p>,
        },
        {
            title: 'Changes to this notice',
            body: (
                <p>
                    If we change this notice, we update this page. If a change affects how we use your data,
                    we tell players by email or in the game before it applies.
                </p>
            ),
        },
    ],
};
