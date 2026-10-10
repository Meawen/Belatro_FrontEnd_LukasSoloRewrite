// Phase 8's Match History and Match details scenes (spec §4.9). The scene format is documented at the top of
// e2e/visual.mjs. Dates are fixed (more than a week back), so every run draws the same day labels; the hands are
// dealt and played from a fixed seed by the game's trick rule, so every run draws the same tricks.

const PLAYER = { id: 'u1', username: 'ana_k' };
const BOTH = ['1440x900', '375x812'];

const TEAM_A = [{ id: 'u1', username: 'ana_k' }, { id: 'u2', username: 'ivo_b' }];
const TEAM_B = [{ id: 'u9', username: 'mira_z' }, { id: 'u4', username: 'luka_p' }];
// seat (turn) order A1, B1, A2, B2
const SEATS = [TEAM_A[0].username, TEAM_B[0].username, TEAM_A[1].username, TEAM_B[1].username];
const teamOf = (name) => (TEAM_A.some((player) => player.username === name) ? 'A' : 'B');

const SUITS = ['HERC', 'KARA', 'PIK', 'TREF'];
const RANKS = ['SEDMICA', 'OSMICA', 'DEVETKA', 'DESETKA', 'DECKO', 'BABA', 'KRALJ', 'AS'];
const TRUMP_ORDER = ['SEDMICA', 'OSMICA', 'BABA', 'KRALJ', 'DESETKA', 'AS', 'DEVETKA', 'DECKO'];
const PLAIN_ORDER = ['SEDMICA', 'OSMICA', 'DEVETKA', 'DECKO', 'BABA', 'KRALJ', 'DESETKA', 'AS'];
const TRUMP_POINTS = { DECKO: 20, DEVETKA: 14, AS: 11, DESETKA: 10, KRALJ: 4, BABA: 3 };
const PLAIN_POINTS = { AS: 11, DESETKA: 10, KRALJ: 4, BABA: 3, DECKO: 2 };

let seed = 11;
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = (list) => list[Math.floor(random() * list.length)];

// the game's rule: a trump beats every other suit, the led suit beats the rest, then strength
const rank = (card, lead, trump) => (card.suit === trump ? 100 + TRUMP_ORDER.indexOf(card.rank) : card.suit === lead ? 50 + PLAIN_ORDER.indexOf(card.rank) : 0);
const points = (card, trump) => (card.suit === trump ? TRUMP_POINTS : PLAIN_POINTS)[card.rank] ?? 0;

let order = 0;

/**
 * One hand dealt and played. `passes` bids pass before the next bidder calls `trump`; `fouls` are [trick, play]
 * spots stored with legal:false; `fell` makes the caller's team fall (padanje); `endAfter` [trick, cards] cuts the
 * hand short after a successful `challenge`.
 */
function playHand(handNo, totals, { passes, trump, fouls = [], fell = false, endAfter = null, challenge = null, declA = 0, declB = 0 }) {
    const dealer = (handNo + 2) % 4;
    const bidders = [1, 2, 3, 4].map((k) => SEATS[(dealer + k) % 4]);
    const caller = bidders[passes];
    const trumpCalls = [...bidders.slice(0, passes).map((player) => ({ player, trump: 'PASS' })), { player: caller, trump }].map((call, i) => ({ order: i + 1, ...call }));
    const deck = SUITS.flatMap((suit) => RANKS.map((r) => ({ suit, rank: r }))).sort(() => random() - 0.5);
    const held = Object.fromEntries(SEATS.map((player, i) => [player, deck.slice(i * 8, i * 8 + 8)]));
    let lead = bidders[0];
    const tricks = [];
    for (let t = 0; t < 8; t++) {
        const at = SEATS.indexOf(lead);
        const players = [0, 1, 2, 3].map((k) => SEATS[(at + k) % 4]);
        const plays = [];
        for (const player of players) {
            const hand = held[player];
            const led = plays[0]?.card.suit;
            const follow = hand.filter((card) => card.suit === led);
            const trumps = hand.filter((card) => card.suit === trump);
            const card = pick(plays.length === 0 ? hand : follow.length ? follow : trumps.length ? trumps : hand);
            held[player] = hand.filter((other) => other !== card);
            plays.push({ player, card });
            if (endAfter && t === endAfter[0] - 1 && plays.length === endAfter[1]) break;
        }
        const complete = plays.length === 4;
        const best = complete ? plays.reduce((top, play) => (rank(play.card, plays[0].card.suit, trump) > rank(top.card, plays[0].card.suit, trump) ? play : top)) : null;
        tricks.push({
            trickNo: t + 1,
            winnerId: best?.player ?? null,
            points: plays.reduce((sum, play) => sum + points(play.card, trump), 0) + (t === 7 ? 10 : 0),
            moves: plays.map((play, k) => ({
                order: ++order,
                player: play.player,
                card: `${play.card.rank} of ${play.card.suit}`,
                legal: !fouls.some(([ft, fk]) => ft === t + 1 && fk === k + 1),
            })),
            lastTrickBonus: t === 7,
        });
        if (!complete) break;
        lead = best.player;
    }
    const won = (team) => tricks.filter((trick) => trick.winnerId && teamOf(trick.winnerId) === team);
    let a = won('A').reduce((sum, trick) => sum + trick.points, 0);
    let b = won('B').reduce((sum, trick) => sum + trick.points, 0);
    let padanje = false;
    const capot = !endAfter && (won('A').length === 8 || won('B').length === 8);
    if (endAfter) {
        // the challenger's team takes the hand
        if (teamOf(challenge.player) === 'A') [a, b] = [162 + declA + declB, 0];
        else [a, b] = [0, 162 + declA + declB];
    } else if (capot) {
        if (won('A').length === 8) [a, b] = [252 + declA, 0];
        else [a, b] = [0, 252 + declB];
    } else if (fell) {
        // the caller's team falls: the other team takes the hand and every declaration
        padanje = true;
        if (teamOf(caller) === 'A') [a, b] = [0, 162 + declA + declB];
        else [a, b] = [162 + declA + declB, 0];
    } else {
        a += declA;
        b += declB;
    }
    totals.a += a;
    totals.b += b;
    return {
        handNo,
        trumpCalls,
        tricks,
        challenges: challenge ? [{ order: 1, ...challenge }] : [],
        handSummary: {
            teamAPoints: a, teamBPoints: b, teamADeclPoints: declA, teamBDeclPoints: declB,
            teamATricksWon: won('A').length, teamBTricksWon: won('B').length,
            padanje, capot, finalScoreA: totals.a, finalScoreB: totals.b,
        },
    };
}

function playMatch(plans) {
    const totals = { a: 0, b: 0 };
    return plans.map((plan, i) => playHand(i + 1, totals, plan));
}

const HANDS = playMatch([
    { passes: 1, trump: 'TREF', fouls: [[2, 3], [6, 1]], fell: true, declA: 20 },
    { passes: 3, trump: 'KARA', fouls: [[4, 2]] },
    { passes: 2, trump: 'TREF', endAfter: [5, 2], challenge: { player: 'luka_p', success: true }, declB: 50 },
    { passes: 0, trump: 'HERC', fouls: [[7, 4]], declA: 20 },
    { passes: 2, trump: 'PIK', declB: 20 },
    { passes: 1, trump: 'KARA', fouls: [[3, 2]] },
    { passes: 3, trump: 'HERC', fouls: [[1, 4], [5, 3]], declA: 50 },
    { passes: 0, trump: 'PIK', declB: 20 },
    { passes: 2, trump: 'TREF', fouls: [[2, 1], [4, 4], [6, 2], [8, 3]], fell: true },
]);
const LAST = HANDS[HANDS.length - 1].handSummary;
const RESULT = `Team ${LAST.finalScoreA > LAST.finalScoreB ? 'A' : 'B'} wins ${LAST.finalScoreA}–${LAST.finalScoreB}`;

const MATCH_ID = '6ac9061df0a9f70ffc4dfa74';
const FORFEIT_ID = '6ac54c0e9d10aa77e1b2c3d4';
const match = (id, result, startTime, endTime, gameMode = 'CASUAL') => ({ id, teamA: TEAM_A, teamB: TEAM_B, originLobby: null, gameMode, result, startTime, endTime });

const summary = (matchId, endTime, yourOutcome, gameMode, result) => ({ matchId, endTime, result, yourOutcome, gameMode });
const LIST = {
    'GET /user/u1/history/summary': {
        json: {
            content: [
                summary(MATCH_ID, '2026-09-26T18:28:00Z', LAST.finalScoreA > LAST.finalScoreB ? 'WIN' : 'LOSS', 'CASUAL', RESULT),
                summary('6ac8f3f6cf32dc27b44c2d88', '2026-09-26T17:33:00Z', 'WIN', 'CASUAL', 'Team A wins 1219–971'),
                summary('6ac77a12bb01ce4e9a1f0b33', '2026-09-25T20:05:00Z', 'WIN', 'RANKED', 'Team A wins 1436–1208'),
                summary(FORFEIT_ID, '2026-09-24T21:10:00Z', 'WIN', 'RANKED', 'Team A wins by forfeit'),
                summary('6ac43b2a8c11dd09f3a4b5c6', '2026-09-23T19:42:00Z', 'LOSS', 'RANKED', 'Team B wins 682–1012'),
                summary('6ac3a91f7e02cc18e2b3a4d5', '2026-09-22T18:15:00Z', 'LOSS', 'CASUAL', 'Team B wins 954–1104'),
                summary('6ac2f0e66d93bb27d1c29be4', '2026-09-21T16:50:00Z', 'WIN', 'CASUAL', 'Team A wins 1033–871'),
                summary('6ac1e8d55c84aa36c0d18af3', '2026-09-20T21:30:00Z', 'WIN', 'RANKED', 'Team A wins 1180–1062'),
                summary('6ac0d7c44b75993bbfce79e2', '2026-09-19T20:02:00Z', 'LOSS', 'RANKED', 'Team B wins 790–1001'),
                summary('6abfc6b33a668849aebd68d1', '2026-09-18T19:11:00Z', 'WIN', 'CASUAL', 'Team A wins 1007–962'),
            ],
        },
    },
};
const EMPTY = { 'GET /user/u1/history/summary': { json: { content: [] } } };
const DETAILS = {
    [`GET /matches/${MATCH_ID}`]: { json: match(MATCH_ID, RESULT, '2026-09-26T18:21:17Z', '2026-09-26T18:28:00Z') },
    [`GET /matches/${MATCH_ID}/structured-moves`]: { json: HANDS },
};
const FORFEIT = {
    [`GET /matches/${FORFEIT_ID}`]: { json: match(FORFEIT_ID, 'Team A wins by forfeit', '2026-09-24T20:58:02Z', '2026-09-24T21:10:00Z', 'RANKED') },
    [`GET /matches/${FORFEIT_ID}/structured-moves`]: { json: HANDS.slice(0, 2) },
};

/** Opens hand 3: a challenge ended it early, so it shows the partial trick, the challenge and the trump banner. */
const openHand3 = async (page) => {
    await page.getByRole('button', { name: /^Hand 3(,|$)/ }).click();
};

export default [
    // the list: Recent form, ten rows (a forfeit among them), the pager with the full-page note and Next
    { name: 'matches', path: '/matches', viewports: BOTH, user: PLAYER, api: ['player.json', LIST], fullPage: true },
    // a new player: "No matches yet" and "Find a game"
    { name: 'matches-empty', path: '/matches', viewports: BOTH, user: PLAYER, api: ['player.json', EMPTY] },
    // a match's page, every hand collapsed: hero, tiles, teams, the match summary, the game history
    { name: 'matches-details', path: `/matches/${MATCH_ID}`, viewports: BOTH, user: PLAYER, api: ['player.json', DETAILS], fullPage: true },
    // hand 3 open: the hand summary, declarations, the challenge, the trump banner, the columns, a partial trick
    { name: 'matches-details-hand', path: `/matches/${MATCH_ID}`, viewports: BOTH, user: PLAYER, api: ['player.json', DETAILS], setup: openHand3, fullPage: true },
    // desktop: the column header row stays in view while the tricks scroll under it
    {
        name: 'matches-details-sticky',
        path: `/matches/${MATCH_ID}`,
        viewports: ['1440x900'],
        user: PLAYER,
        api: ['player.json', DETAILS],
        setup: async (page) => {
            await openHand3(page);
            await page.getByRole('group', { name: 'Trick 3' }).scrollIntoViewIfNeeded();
            await page.mouse.wheel(0, 200);
        },
    },
    // a forfeit: "Won by forfeit" and the raw result instead of the two final scores
    { name: 'matches-forfeit', path: `/matches/${FORFEIT_ID}`, viewports: BOTH, user: PLAYER, api: ['player.json', FORFEIT], fullPage: true },
];
