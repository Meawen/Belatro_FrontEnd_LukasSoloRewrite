import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useReducedMotion } from '../../motion/useReducedMotion';
import { isExpired } from '../../services/tokenRenewal';
import { AppShell } from '../layout/AppShell';
import { Page } from '../layout/Page';
import { PixelIcon } from '../ui';
import { PublicPage, Section } from './PublicPage';
import { RulesGuide } from './RulesGuide';
import { RULE_RANKS, RULE_SECTIONS, type RuleSection } from './rulesData';

const TITLE = 'Rules';

const isRuleSection = (id: string): id is RuleSection => (RULE_SECTIONS as readonly string[]).includes(id);

/**
 * How Belot is played on Stiglja, as the server enforces it (R-41); text approved by the owner. The page opens with a
 * short visual guide; the full rules wait one tap away, every word kept (ranks spec §9, owner 2026-10-11). Signed in it
 * sits in the shell, with the sidebar, like every other page; signed out, in the public frame (owner 2026-10-11).
 * Nothing for the moment the session is read.
 */
export const RulesPage: React.FC = () => {
    const { isAuthenticated, isLoading, token } = useAuth();
    const { hash } = useLocation();
    const reduced = useReducedMotion();
    const [open, setOpen] = useState(false);
    const [target, setTarget] = useState<RuleSection | null>(null);

    const openRule = useCallback((rule: RuleSection) => {
        setOpen(true);
        setTarget(rule);
    }, []);

    // a page opened at one of the sections (/rules#rules-ranks) opens the full rules there
    useEffect(() => {
        const id = hash.slice(1);
        if (isRuleSection(id)) openRule(id);
    }, [hash, openRule]);

    // once the disclosure is open, bring the section into view (after the session is read: until then nothing renders)
    useEffect(() => {
        if (!open || !target || isLoading) return;
        document.getElementById(target)?.scrollIntoView?.({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
        setTarget(null);
    }, [open, target, reduced, isLoading]);

    if (isLoading) return null;

    const rules = (
        <>
            <p>
                Stiglja is Belot for four players in two teams of two, Team A and Team B; partners sit
                opposite each other. The first team to reach 1001 points wins.
            </p>

            <RulesGuide onOpenRule={openRule} />

            <details
                id="full-rules"
                open={open}
                onToggle={(event) => setOpen(event.currentTarget.open)}
                className="group space-y-8"
            >
                <summary className="focus-inside notch flex min-h-11 cursor-pointer list-none items-center gap-3 py-2 [&::-webkit-details-marker]:hidden">
                    <PixelIcon name="chevron" className="transition-transform group-open:rotate-90 motion-reduce:transition-none" />
                    <span className="flex flex-col">
                        <h2 className="t-headline text-text">Full rules</h2>
                        <span className="t-footnote text-text-2">Every rule, as the server enforces it.</span>
                    </span>
                </summary>

                <Section title="Cards" level={3} id="rules-cards">
                    <p>
                        Belot uses 32 cards: 7, 8, 9, 10, Decko (jack), Baba (queen), Kralj (king) and As (ace), in
                        four suits: Herc (hearts), Karo (diamonds), Pik (spades) and Tref (clubs).
                    </p>
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="t-callout text-left text-text-2">
                                <th className="py-1 pr-4">Order, highest first</th>
                                <th className="py-1">Card points</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-t-2 border-edge">
                                <td className="py-2 pr-4">Trump suit: Decko, 9, As, 10, Kralj, Baba, 8, 7</td>
                                <td className="py-2">Decko 20, 9 14, As 11, 10 10, Kralj 4, Baba 3, 8 and 7 nothing</td>
                            </tr>
                            <tr className="border-t-2 border-edge">
                                <td className="py-2 pr-4">Other suits: As, 10, Kralj, Baba, Decko, 9, 8, 7</td>
                                <td className="py-2">As 11, 10 10, Kralj 4, Baba 3, Decko 2, 9, 8 and 7 nothing</td>
                            </tr>
                        </tbody>
                    </table>
                    <p>The last trick of a hand is worth 10 more, so a hand holds 162 points in cards.</p>
                </Section>

                <Section title="Dealing and bidding" level={3} id="rules-bidding">
                    <ul className="list-disc pl-6 space-y-2">
                        <li>The first dealer is picked at random; after each hand the deal moves on to the next player.</li>
                        <li>Everyone gets six cards. Starting with the player after the dealer, each player either names a trump suit or passes.</li>
                        <li>The first player to name a suit makes it trump, and their team has to win the hand (see Scoring a hand).</li>
                        <li>If the other three pass, the dealer must name trump: the dealer cannot pass.</li>
                        <li>Then everyone gets two more cards, eight in all.</li>
                    </ul>
                </Section>

                <Section title="Playing a hand" level={3} id="rules-playing">
                    <p>
                        The player after the dealer leads the first trick; whoever wins a trick leads the next. A
                        trick goes to the highest trump in it or, if it has none, to the highest card of the suit
                        that was led.
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>
                            If you have a card of the suit that was led, you must play one.
                            <ul className="list-[circle] pl-6 mt-2 space-y-2">
                                <li>If nobody has trumped the trick yet, you must beat the best card of that suit on the table if you can.</li>
                                <li>Once someone has trumped (cut) the trick, you may play any card of the suit that was led.</li>
                                <li>If trump was led, you must play a higher trump than the best one on the table if you can.</li>
                            </ul>
                        </li>
                        <li>If you have no card of the suit that was led, you must play a trump: a higher trump than any already in the trick, if you can.</li>
                        <li>If you have neither, play any card.</li>
                    </ul>
                </Section>

                <Section title="Declarations (zvanja) and bela" level={3} id="rules-declarations">
                    <p>Declarations are counted for you when trump is named; you do not announce them.</p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>
                            A sequence is three or more cards in a row of one suit, in the order 7, 8, 9, 10, Decko,
                            Baba, Kralj, As. Three in a row score 20, four score 50, five or more score 100. Each
                            player counts only their best sequence.
                        </li>
                        <li>
                            Four of a kind: four jacks score 200, four 9s 150, and four aces, tens, kings or queens
                            100. Four 7s or four 8s score nothing.
                        </li>
                        <li>
                            Only one team scores its sequences: the team holding the best one. A sequence worth more
                            beats one worth less; between sequences worth the same, the higher top card wins (7
                            lowest, As highest); with the same top card, the one in trump wins; if they are still
                            equal, the player who comes first after the dealer wins. Four of a kind is compared
                            separately: jacks beat 9s, which beat the 100-point fours, and among those As beats 10,
                            10 beats Kralj and Kralj beats Baba. The winning team scores all its declarations of
                            that kind.
                        </li>
                        <li>A team that wins no trick in a hand loses its declarations and its bela for that hand.</li>
                        <li>
                            Bela is the Kralj and the Baba of trump in one hand, worth 20. It is not counted for
                            you: when you play the first of the two, choose Play + Bela.
                        </li>
                    </ul>
                </Section>

                <Section title="Scoring a hand" level={3} id="rules-scoring">
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Each team adds up the card points of the tricks it won, its declarations and its bela.</li>
                        <li>
                            The team that named trump must score more than the other team. If it scores the same or
                            less, it falls (padanje): the other team gets all the points of the hand.
                        </li>
                        <li>A team that wins all eight tricks (capot) gets 90 more points.</li>
                        <li>
                            When a hand ends with a team at 1001 points or more, the team with more points wins once
                            the hand's 10 seconds for challenges are over. If both are level, another hand is
                            played.
                        </li>
                    </ul>
                </Section>

                <Section title="Illegal cards and Challenge" level={3} id="rules-challenge">
                    <p>
                        The game does not stop you from playing a card the rules forbid; it notes it as a foul. If
                        you think an opponent played an illegal card this hand, press Challenge, during the hand
                        or in the 10 seconds after it ends. That includes the hand that takes a team past 1001:
                        the game ends only when its 10 seconds are over.
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>
                            If the other team fouled this hand (even if yours did too), the challenge succeeds: your
                            team wins the whole hand, 162 points plus your team's declarations and bela, and the
                            other team scores nothing for it. A new hand is dealt, unless the new score ends the
                            game.
                        </li>
                        <li>If nobody fouled, or only your own team did, the challenge fails and the score does not change.</li>
                        <li>Each player has one challenge per hand; a wrong challenge uses it up for that hand.</li>
                        <li>Which cards were illegal shows in Match Details only once the game has finished with a winner.</li>
                    </ul>
                </Section>

                <Section title="Casual and ranked games" level={3} id="rules-modes">
                    <ul className="list-disc pl-6 space-y-2">
                        <li>
                            Casual: create or join a lobby (a private lobby needs its password), pick teams, and the
                            host starts the game. Casual games never change your rating.
                        </li>
                        <li>
                            Ranked: press Find Match on the Play Game page; you need a confirmed email address.
                            Stiglja puts the four closest-rated waiting players together; the longer they wait, the
                            wider the rating gap it accepts, up to 1600 points between the highest and the lowest.
                            Your rating moves with your team's result: a win raises it and a loss lowers it, by more
                            when the other team was rated higher, by more for a bigger final score margin, and by more
                            in your first ranked games. A very narrow win can leave the shown number unchanged.
                        </li>
                    </ul>
                </Section>

                <Section title="Ranks" level={3} id="rules-ranks">
                    <table className="w-full text-sm border-collapse">
                        <caption className="sr-only">Ranks</caption>
                        <thead>
                            <tr className="t-callout text-left text-text-2">
                                <th className="py-1 pr-4">Rank</th>
                                <th className="py-1 pr-4">From</th>
                                <th className="py-1">Tagline</th>
                            </tr>
                        </thead>
                        <tbody>
                            {RULE_RANKS.map((rank) => (
                                <tr key={rank.key} className="border-t-2 border-edge">
                                    <td className="py-2 pr-4">{rank.name}</td>
                                    <td className="py-2 pr-4">{rank.from}</td>
                                    <td className="py-2">{rank.tagline}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p>Everyone starts at 1200. Your first 10 ranked games are placement: you are Cucek until they're played.</p>
                </Section>

                <Section title="When a player is away" level={3} id="rules-away">
                    <p>
                        Each turn has 30 seconds. If a player does not act in time, the server plays for them: it
                        passes in the bidding (or names a random trump for a dealer who must call), or plays a
                        legal card.
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Bidding, playing or challenging yourself resets your count of missed turns.</li>
                        <li>
                            After 5 missed turns in a row by the same player, the game ends. A casual game is
                            abandoned, with no result. In a ranked game the absent player's team loses, the absent
                            player's rating drops as for a 1001–0 defeat, their partner's by half a normal loss, and
                            the winners gain as for a normal win.
                        </li>
                        <li>If both players of the other team are missing turns too, the game is abandoned with no result.</li>
                        <li>If you leave the table, the Return to your game banner takes you back to your seat.</li>
                    </ul>
                </Section>

                <Section title="Declining a ranked match" level={3} id="rules-decline">
                    <p>
                        When a ranked match is found, you can press Decline in the Match Found dialog, as long as
                        no bid has been made and no more than 30 seconds have passed. The game is called off with
                        no rating change, the other three go back into the queue in their places, and you cannot
                        queue again for 2 minutes.
                    </p>
                </Section>

                <Section title="Play again" level={3} id="rules-again">
                    <p>
                        After a game that ends with a winner, Play again asks all four players for a rematch. When all four agree within 2
                        minutes, a new game starts with the same teams. A rematch is always casual, even after a
                        ranked game. If anyone leaves, there is no rematch.
                    </p>
                </Section>
            </details>
        </>
    );

    // an expired stored token reads as signed out here: the shell's requests would 401 and sign the reader out of
    // a page anyone may read (R-41)
    if (!isAuthenticated || (token && isExpired(token))) return <PublicPage title={TITLE}>{rules}</PublicPage>;
    return (
        <AppShell>
            <Page title={TITLE} width="read">
                <div className="t-body space-y-8">{rules}</div>
            </Page>
        </AppShell>
    );
};
