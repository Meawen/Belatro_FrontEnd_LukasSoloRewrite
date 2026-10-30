import type { RulesDoc } from './types';
import { RULE_RANKS } from '../../components/info/rulesData';
import type { RankKey } from '../../types/user';

// the Ranks table's "From" column
const RANK_FROM: Record<RankKey, string> = {
    CUCEK: 'fewer than 10 ranked games',
    DECEC: 'below 1000',
    FAKIN: '1000',
    PAJDAS: '1200',
    GOSPON: '1400',
    MAJSTER: '1600',
    KAJKAVAC: '1800',
};

/** The Rules page in English: the owner-approved text (R-41, ranks spec §9), with the open beta's English names (S6). */
export const doc: RulesDoc = {
    intro: 'Stiglja is Belot for four players in two teams of two, Team A and Team B; partners sit opposite each other. The first team to reach 1001 points wins.',
    steps: {
        teams: { title: 'Two teams', text: 'Partners sit opposite. The first team to 1001 points wins.' },
        cards: { title: '32 cards, two orders', text: 'In trump the Decko and the 9 jump to the top. The last trick is worth 10 more: 162 points a hand.' },
        bidding: { title: 'Name trump or pass', text: 'Six cards each. Name a trump or pass; if all pass, the dealer must name one. Then two more cards.' },
        follow: {
            title: 'Follow suit',
            text: 'Follow suit and beat the best card if you can. No card of that suit? Play a trump, higher if you can. Neither? Play anything.',
        },
        declarations: {
            title: 'Declarations and bela',
            text: 'Said out loud when trump is named, before the first card: 3 in a row 20, 4 in a row 50, 5 to 7 in a row 100; all eight of a suit wins the game. The team with the best one scores all of its own. Bela you declare with Play + Bela.',
        },
        hand: {
            title: 'Win the hand',
            text: 'The team that named trump must score more, or it falls and the other team takes the whole hand. All eight tricks: 90 more.',
        },
        challenge: {
            title: 'Challenge a foul',
            text: "Illegal cards aren't blocked. Press Challenge during the hand or in the 10 seconds after: if the other team fouled, your team wins the hand. A wrong challenge costs no points, but you lose your challenge for the rest of the game.",
        },
        ranks: { title: 'Ranks', text: 'Everyone starts at 1200. After 10 placement games your rank follows your rating.' },
    },
    sections: {
        'rules-cards': {
            title: 'Cards',
            body: (
                <>
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
                </>
            ),
        },
        'rules-bidding': {
            title: 'Dealing and bidding',
            body: (
                <ul className="list-disc pl-6 space-y-2">
                    <li>The first dealer is picked at random; after each hand the deal moves on to the next player.</li>
                    <li>Everyone gets six cards. Starting with the player after the dealer, each player either names a trump suit or passes.</li>
                    <li>The first player to name a suit makes it trump, and their team has to win the hand (see Scoring a hand).</li>
                    <li>If the other three pass, the dealer must name trump: the dealer cannot pass.</li>
                    <li>Then everyone gets two more cards, eight in all.</li>
                </ul>
            ),
        },
        'rules-playing': {
            title: 'Playing a hand',
            body: (
                <>
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
                </>
            ),
        },
        'rules-declarations': {
            title: 'Declarations (zvanja) and bela',
            body: (
                <>
                    <p>
                        Declarations are found for you when trump is named. Before the first card the table says
                        them out loud, in turn order from the player after the dealer, and play waits a few seconds
                        while they are said.
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>
                            A sequence is three or more cards in a row of one suit, in the order 7, 8, 9, 10, Decko,
                            Baba, Kralj, As. Three in a row score 20, four score 50, five, six or seven score 100.
                            Every sequence you hold counts, two in one suit too.
                        </li>
                        <li>
                            Four of a kind: four jacks score 200, four 9s 150, and four aces, tens, kings or queens
                            100. Four 7s or four 8s score nothing. A card can count in a sequence and in a four of a
                            kind.
                        </li>
                        <li>
                            Belot: all eight cards of one suit. The game ends at once and that team wins, with its
                            score raised to 1001.
                        </li>
                        <li>
                            Only one team scores declarations: the team holding the single best one. It scores every
                            declaration of both its players; the other team scores none.
                        </li>
                        <li>
                            The best is the one worth more. Between two worth the same, four of a kind beats a
                            sequence; then the higher top card wins (7 lowest, As highest), and among fours As beats
                            10, 10 beats Kralj and Kralj beats Baba. If they are still equal, the player who comes
                            first after the dealer wins. Trump makes no difference.
                        </li>
                        <li>
                            Each player says their best value. When values are equal between the two teams, those
                            players also say how high they go ("up to Baba"); partners don't need to. The winning team's
                            declared cards are shown beside their seats until the first trick is taken; the other
                            team's stay hidden.
                        </li>
                        <li>A team that wins no trick in a hand loses its declarations and its bela for that hand.</li>
                        <li>
                            Bela is the Kralj and the Baba of trump in one hand, worth 20. It is not counted for
                            you: when you play the first of the two, choose Play + Bela.
                        </li>
                    </ul>
                </>
            ),
        },
        'rules-scoring': {
            title: 'Scoring a hand',
            body: (
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
            ),
        },
        'rules-challenge': {
            title: 'Illegal cards and Challenge',
            body: (
                <>
                    <p>
                        The game does not stop you from playing a card the rules forbid; it notes it as a foul. If
                        you think an opponent played an illegal card this hand, press Challenge, during the hand
                        or in the 10 seconds after it ends. That includes the hand that takes a team past 1001:
                        the game ends only when its 10 seconds are over.
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>
                            If the other team fouled this hand (even if yours did too), the challenge is right: your
                            team wins the whole hand, 162 points plus your team's declarations and bela, and the
                            other team scores nothing for it. The hand ends as usual, with its 10 seconds, and you
                            keep your challenge.
                        </li>
                        <li>
                            If nobody fouled, or only your own team did, the challenge is wrong: the score does not
                            change, but you have no challenge left for the rest of the game. Everyone at the table
                            sees it.
                        </li>
                        <li>Each player has one challenge per game. A right challenge keeps it; a wrong one uses it up.</li>
                        <li>You can challenge once the hand's first card is down, until the hand's 10 seconds are over.</li>
                        <li>Which cards were illegal shows in Match Details only once the game has finished with a winner.</li>
                    </ul>
                </>
            ),
        },
        'rules-modes': {
            title: 'Casual and ranked games',
            body: (
                <ul className="list-disc pl-6 space-y-2">
                    <li>
                        Casual: create or join a table (a private table needs its password), pick teams, and the
                        host starts the game. Casual games never change your rating.
                    </li>
                    <li>
                        Ranked: press Find Match on the Ranked page; you need a confirmed email address.
                        Stiglja puts the four closest-rated waiting players together; the longer they wait, the
                        wider the rating gap it accepts, up to 1600 points between the highest and the lowest.
                        Your rating moves with your team's result: a win raises it and a loss lowers it, by more
                        when the other team was rated higher, by more for a bigger final score margin, and by more
                        in your first ranked games. A very narrow win can leave the shown number unchanged.
                    </li>
                </ul>
            ),
        },
        'rules-ranks': {
            title: 'Ranks',
            body: (
                <>
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
                                    <td className="py-2 pr-4">{RANK_FROM[rank.key]}</td>
                                    <td className="py-2">{rank.tagline}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p>Everyone starts at 1200. Your first 10 ranked games are placement: you are Cucek until they're played.</p>
                </>
            ),
        },
        'rules-away': {
            title: 'When a player is away',
            body: (
                <>
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
                </>
            ),
        },
        'rules-decline': {
            title: 'Declining a ranked match',
            body: (
                <p>
                    When a ranked match is found, you can press Decline in the Match Found dialog, as long as
                    no bid has been made and no more than 30 seconds have passed. The game is called off with
                    no rating change, the other three go back into the queue in their places, and you cannot
                    queue again for 2 minutes.
                </p>
            ),
        },
        'rules-again': {
            title: 'Play again',
            body: (
                <p>
                    After a game that ends with a winner, Play again asks all four players for another game. When all four agree
                    within 2 minutes, a new game starts with the same teams. The new game is always casual, even after a ranked
                    game. If anyone leaves, there is no new game.
                </p>
            ),
        },
    },
};
