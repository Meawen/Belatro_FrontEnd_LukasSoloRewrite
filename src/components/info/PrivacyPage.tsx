import React from 'react';
import { PublicPage, Section } from './PublicPage';
import { SupportEmailLink } from '../layout/LegalLinks';

/** The privacy notice of the invite-only beta (R-40); text approved by the owner. */
export const PrivacyPage: React.FC = () => (
    <PublicPage title="Privacy notice">
        <p className="t-footnote text-text-2">Last updated: October 2026.</p>
        <p>
            This notice explains what Stiglja, an invite-only beta of the card game Belot, does with
            your personal data.
        </p>

        <Section title="Who runs Stiglja">
            <p>Stiglja is run by Lukas Miholić, Bregana, Croatia.</p>
            <p>The operator decides how your data is used. For anything about your data, write to <SupportEmailLink />.</p>
        </Section>

        <Section title="What we collect">
            <ul className="list-disc pl-6 space-y-2">
                <li>
                    <strong>Your account:</strong> your username, your email address (and a new address
                    while it waits for confirmation) and your password, which we store only as a one-way
                    hash that cannot be turned back into the password.
                </li>
                <li>
                    <strong>Your games:</strong> every game you play (bids, cards, challenges and results),
                    your match history, your Elo rating and its history, your number of games and level,
                    the lobbies you create or join, and your friends and friend requests.
                </li>
                <li>
                    <strong>Security data:</strong> your IP address, kept only in the server's memory to
                    limit how often sign-in and signup can be tried, and never written to our database;
                    and your username in the server's logs, which record what the service did (for
                    example a sign-in or a game event).
                </li>
                <li>
                    <strong>In your browser:</strong> when you sign in, the site keeps a sign-in token and
                    your user id and username in your browser's local storage, so that you stay signed in.
                    Signing out removes them. Stiglja sets no advertising or analytics cookies and uses no
                    trackers.
                </li>
            </ul>
        </Section>

        <Section title="Why we use it">
            <ul className="list-disc pl-6 space-y-2">
                <li>
                    To provide the game you signed up for (our contract with you): your account, your
                    games, rankings and friends, and the emails about your account (confirming your
                    address, resetting your password, security notices).
                </li>
                <li>
                    To keep Stiglja secure and working (our legitimate interest): limiting sign-in and
                    signup attempts, and keeping logs to find faults and abuse.
                </li>
            </ul>
            <p>We do not sell your data or use it for advertising.</p>
        </Section>

        <Section title="Who processes it for us, and where">
            <p>These companies handle data on our behalf, only to run Stiglja:</p>
            <ul className="list-disc pl-6 space-y-2">
                <li><strong>Fly.io</strong> runs the game server, in Frankfurt, Germany.</li>
                <li>
                    <strong>MongoDB Atlas</strong> stores accounts and game history, on Amazon Web Services
                    in Frankfurt, Germany (eu-central-1).
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
        </Section>

        <Section title="How long we keep it">
            <ul className="list-disc pl-6 space-y-2">
                <li>Your account and game history: for as long as your account exists.</li>
                <li>
                    A running game: up to 24 hours after its last move; a finished one: 10 minutes. Its
                    record then stays in your match history.
                </li>
                <li>IP addresses held to limit attempts: dropped within about an hour, and whenever the server restarts.</li>
                <li>Server logs: only as long as our hosting provider, Fly.io, keeps them.</li>
            </ul>
            <p>
                You can ask us to delete your account at any time, with "Request account deletion" on your
                profile or by writing to <SupportEmailLink />. We delete your account and its data within
                30 days of your request.
            </p>
        </Section>

        <Section title="Your rights">
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
        </Section>

        <Section title="Age">
            <p>Stiglja is for people aged 16 or over. Please do not sign up if you are younger.</p>
        </Section>

        <Section title="Changes to this notice">
            <p>
                If we change this notice, we update this page. If a change affects how we use your data,
                we tell players by email or in the game before it applies.
            </p>
        </Section>
    </PublicPage>
);
