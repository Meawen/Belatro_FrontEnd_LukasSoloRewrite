import React from 'react';
import { PublicPage, Section } from './PublicPage';
import { SupportEmailLink } from '../layout/LegalLinks';

/** The terms of use of the invite-only beta (R-40); text approved by the owner. */
export const TermsPage: React.FC = () => (
    <PublicPage title="Terms of use">
        <p className="text-emerald-300 text-sm">Last updated: October 2026.</p>
        <p>By creating an account you accept these terms.</p>

        <Section title="The service">
            <p>
                Stiglja is an online version of the card game Belot, run by Lukas Miholić, Bregana, Croatia
                (<SupportEmailLink />). It is an invite-only beta: you need an invite code to sign up,
                playing is free, and features may change while we test.
            </p>
        </Section>

        <Section title="No warranty">
            <p>
                The beta is provided as it is, without any warranty. We work to keep it running and your
                data safe, but it may be unavailable, lose a game in progress, or contain errors. To the
                extent the law allows, we are not liable for any loss that comes from using it.
            </p>
        </Section>

        <Section title="Your account">
            <p>
                You must be 16 or older. Keep your password to yourself: you are responsible for what is
                done with your account.
            </p>
        </Section>

        <Section title="Fair play">
            <p>Play to win, honestly. In particular, do not:</p>
            <ul className="list-disc pl-6 space-y-2">
                <li>tell another player your cards or plan plays with them outside the game;</li>
                <li>use more than one account, or let someone else play on yours;</li>
                <li>use bots, scripts or anything else that plays or reads the game for you;</li>
                <li>exploit a bug (report it instead);</li>
                <li>insult, threaten or harass other players.</li>
            </ul>
        </Section>

        <Section title="Usernames">
            <p>
                Pick a username that is not offensive, does not pretend to be someone else, and does not
                contain another person's private details. We may rename or remove an account whose name
                breaks this rule.
            </p>
        </Section>

        <Section title="Reporting">
            <p>To report a player, a username, a bug or a security problem, write to <SupportEmailLink />.</p>
        </Section>

        <Section title="Removing accounts">
            <p>
                We may suspend or remove an account that cheats, abuses other players or the service, or
                otherwise breaks these terms. You may stop using Stiglja at any time and ask us to delete
                your account (see the Privacy notice).
            </p>
        </Section>

        <Section title="Changes and law">
            <p>
                We may update these terms. If a change matters to you, we tell you by email or in the game
                before it applies. These terms are governed by Croatian law.
            </p>
        </Section>
    </PublicPage>
);
