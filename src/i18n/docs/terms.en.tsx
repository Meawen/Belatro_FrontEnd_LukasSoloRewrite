import type { LegalDoc } from './types';
import { SupportEmailLink } from '../../components/layout/LegalLinks';

/** The terms of use in English (spec §1.2): legal text; the owner reviews it with the Croatian (R1). */
export const doc: LegalDoc = {
    updated: 'Last updated: October 2026.',
    intro: 'By creating an account or playing as a guest you accept these terms.',
    sections: [
        {
            title: 'The service',
            body: (
                <p>
                    Stiglja is an online version of the card game Belot, run by Lukas Miholić, Bregana, Croatia
                    (<SupportEmailLink />). It is a beta: playing is free, and features may change while we test.
                </p>
            ),
        },
        {
            title: 'No warranty',
            body: (
                <p>
                    The beta is provided as it is, without any warranty. We work to keep it running and your
                    data safe, but it may be unavailable, lose a game in progress, or contain errors. To the
                    extent the law allows, we are not liable for any loss that comes from using it.
                </p>
            ),
        },
        {
            title: 'Your account',
            body: (
                <p>
                    You must be 16 or older. Keep your password to yourself: you are responsible for what is
                    done with your account.
                </p>
            ),
        },
        {
            title: 'Signing up and the waitlist',
            body: (
                <>
                    <p>
                        While the beta has room, anyone can sign up. The number of accounts is limited, and we may change the limit
                        at any time. Confirm your email address within 7 days of signing up, or the account is removed; the
                        confirmation email gives the date.
                    </p>
                    <p>
                        When the beta is full, you can join the waitlist with your email address. Confirm it from the email we send
                        within 7 days, or it is dropped. When a place opens, we email the next confirmed address a personal signup
                        link, in the order the addresses were confirmed. The link works for 7 days, even if signup is full again;
                        if it is not used, the place goes to the next person. Signing up takes you off the list.
                    </p>
                </>
            ),
        },
        {
            title: 'Playing as a guest',
            body: (
                <>
                    <p>
                        You can play without an account, as a guest: against bots, and at a table someone sent you the link to.
                        Guests must be 16 or older too. A guest gets a name such as gost_4821, which you can change; guest names
                        follow the same rules as usernames (see Usernames).
                    </p>
                    <p>
                        A guest belongs to the browser it was made in: if you clear that browser's storage, the guest is lost, and a
                        guest not used for 30 days is removed. Ranked games, a rating, friends and match history need an account.
                        If you sign up in the same browser you start fresh: you may keep the guest's name, but its games do not move
                        to your account.
                    </p>
                </>
            ),
        },
        {
            title: 'Fair play',
            body: (
                <>
                    <p>Play to win, honestly. In particular, do not:</p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>tell another player your cards or plan plays with them outside the game;</li>
                        <li>use more than one account, or let someone else play on yours;</li>
                        <li>use bots, scripts or anything else that plays or reads the game for you;</li>
                        <li>exploit a bug (report it instead);</li>
                        <li>insult, threaten or harass other players.</li>
                    </ul>
                </>
            ),
        },
        {
            title: 'Usernames',
            body: (
                <p>
                    Pick a username that is not offensive, does not pretend to be someone else, and does not
                    contain another person's private details. We may rename or remove an account whose name
                    breaks this rule.
                </p>
            ),
        },
        {
            title: 'Reporting',
            body: <p>To report a player, a username, a bug or a security problem, write to <SupportEmailLink />.</p>,
        },
        {
            title: 'Removing accounts',
            body: (
                <p>
                    We may suspend or remove an account or a guest that cheats, harasses other players, abuses the service,
                    or otherwise breaks these terms. You may stop using Stiglja at any time and ask us to delete
                    your account (see the Privacy notice). We also remove an account whose email address is not confirmed within
                    7 days of signing up, and a guest not used for 30 days.
                </p>
            ),
        },
        {
            title: 'Changes and law',
            body: (
                <p>
                    We may update these terms. If a change matters to you, we tell you by email or in the game
                    before it applies. These terms are governed by Croatian law.
                </p>
            ),
        },
    ],
};
