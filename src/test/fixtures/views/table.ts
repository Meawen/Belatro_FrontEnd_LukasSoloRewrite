// A deterministic bela table for tests and the /dev/board playground. Four simple bots play whole
// hands, and every fan-out the server would send comes back in the server's order and shape
// (RUN/explore/game-data.md §2.2): one public frame plus one private frame per seat, built after
// each save, with the UI-redesign §6.1 fields or (fields: false) as an older backend sends them.
//
//   deal ............ GSC (turnExpiresAt null), TS
//   pass ............ TS, CTL                     (one save)
//   trump call ...... GSC (turnExpiresAt null), TS, CTL; +2 cards each, declarations revealed
//   card ............ TS, CTL                     (the 4th card shows the completed trick, the
//                                                  winner to act and seatingOrder rotated to them)
//   8th card ........ 'hand-complete' GSC (window null), 'window-open' GSC, 'window-open' CTL
//   window expiry ... 'window-close' GSC (HAND_COMPLETE, window null), then 'next-deal' GSC
//                     (BIDDING; the old trump's trick 8 and the old window still on the view),
//                     TS and GSC; or 'game-over' GSC ×2 when a team has reached the target
import { cardId, playOrder, trickWinner } from '../../../components/board/model/rules';
import type {
    Boja, DeclarationsView, GameBid, GameCard, GamePhase, LastTrickView, LiveTrick, PrivateGameView, PublicGameView, Rank,
} from '../../../types/game';

/** Seats in turn order (A1, B1, A2, B2): Team A is alice and carol, Team B bob and dave. */
export const PLAYERS = ['alice', 'bob', 'carol', 'dave'] as const;
export const GAME_ID = 'g1';

export interface TableOptions {
    /** Shuffle seed (default 7). */
    seed?: number;
    /** Dealer of the first hand (default 'dave', so alice bids first). */
    dealer?: string;
    /** Which bid of a hand calls trump, 0…3; the bids before it pass (default 3: the dealer must call). */
    callAt?: number;
    /** The trump called (default 'HERC'). */
    trump?: Boja;
    /** Send the §6.1 fields (default true). */
    fields?: boolean;
    /** Scores before the first hand, [A, B] (default [0, 0]). */
    scores?: [number, number];
    /** How many hands to play (default 1). */
    hands?: number;
    /** A team at or above this score with unequal scores wins at the window's end (default 1001). */
    target?: number;
    /** Epoch ms of the first fan-out (default 1_760_040_000_000). */
    start?: number;
}

/** One fan-out: what every subscriber receives after one save (or a clock-only re-broadcast). */
export interface FanOut {
    /** 'deal', 'bid:alice:PASS', 'call:dave:HERC', 'play:bob:PIK-AS', 'hand-complete', 'window-open',
     *  'window-close', 'next-deal' or 'game-over'. */
    label: string;
    trigger: 'GSC' | 'TS' | 'CTL';
    /** Epoch ms when it was built (serverNow). */
    at: number;
    /** The state version it carries (also counted when `fields` is false). */
    version: number;
    public: PublicGameView;
    private: Record<string, PrivateGameView>;
}

export type Delivery =
    | { channel: 'public'; body: PublicGameView }
    | { channel: 'private'; body: PrivateGameView }
    | { channel: 'snapshot'; body: PrivateGameView };

const TEAM_A: readonly string[] = ['alice', 'carol'];
const TEAM_B: readonly string[] = ['bob', 'dave'];
const BOJE: readonly Boja[] = ['HERC', 'KARA', 'PIK', 'TREF'];
/** Rank enum order, 7 → A: how the server sorts a hand within a suit, and how sequences run. */
const RANKS: readonly Rank[] = ['SEDMICA', 'OSMICA', 'DEVETKA', 'DESETKA', 'DECKO', 'BABA', 'KRALJ', 'AS'];
const TRUMP_POINTS: Partial<Record<Rank, number>> = { DECKO: 20, DEVETKA: 14, AS: 11, DESETKA: 10, KRALJ: 4, BABA: 3 };
const PLAIN_POINTS: Partial<Record<Rank, number>> = { AS: 11, DESETKA: 10, KRALJ: 4, BABA: 3, DECKO: 2 };
const FOUR_POINTS: Partial<Record<Rank, number>> = { DECKO: 200, DEVETKA: 150, AS: 100, DESETKA: 100, KRALJ: 100, BABA: 100 };
const STEP_MS = 800;
const TURN_MS = 30_000;
const WINDOW_MS = 10_000;

type Team = 'A' | 'B';
const teamOf = (id: string): Team => (TEAM_A.includes(id) ? 'A' : 'B');
const nextOf = (id: string): string => PLAYERS[(PLAYERS.indexOf(id as (typeof PLAYERS)[number]) + 1) % 4];

function random(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffled<T>(items: readonly T[], rnd: () => number): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/** The server's hand order: suit groups shuffled with a seed made from the hand itself, then 7 → A. */
export function serverOrder(hand: readonly GameCard[]): GameCard[] {
    let seed = 0;
    for (const ch of hand.map(cardId).sort().join(',')) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) | 0;
    const suits = shuffled(BOJE, random(seed));
    return [...hand].sort((x, y) => suits.indexOf(x.boja) - suits.indexOf(y.boja) || RANKS.indexOf(x.rank) - RANKS.indexOf(y.rank));
}

function declarationsOf(hand: readonly GameCard[]): DeclarationsView {
    let best = 0;
    let bestSuit: Boja | null = null;
    for (const suit of BOJE) {
        const idx = hand.filter((card) => card.boja === suit).map((card) => RANKS.indexOf(card.rank)).sort((x, y) => x - y);
        let run = 1;
        for (let i = 1; i <= idx.length; i++) {
            if (i < idx.length && idx[i] === idx[i - 1] + 1) {
                run++;
                continue;
            }
            const points = run >= 5 ? 100 : run === 4 ? 50 : run === 3 ? 20 : 0;
            if (points > best) {
                best = points;
                bestSuit = suit;
            }
            run = 1;
        }
    }
    let four = 0;
    for (const rank of RANKS) {
        if (hand.filter((card) => card.rank === rank).length === 4) four = Math.max(four, FOUR_POINTS[rank] ?? 0);
    }
    return { bela: false, sequencesBySuit: bestSuit ? { [bestSuit]: best } : {}, fourOfAKindPoints: four, bestSequencePoints: best };
}

interface Completed {
    lead: string;
    plays: Record<string, GameCard>;
    order: string[];
    winnerId: string;
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Plays `options.hands` hands (default 1) and returns every fan-out, in order. */
export function playTable(options: TableOptions = {}): FanOut[] {
    const fields = options.fields ?? true;
    const callAt = options.callAt ?? 3;
    const trumpCall = options.trump ?? 'HERC';
    const target = options.target ?? 1001;
    const out: FanOut[] = [];
    let version = 0;
    let at = options.start ?? 1_760_040_000_000;
    let dealer = options.dealer ?? 'dave';
    let handNo = 0;
    const scores: Record<Team, number> = { A: options.scores?.[0] ?? 0, B: options.scores?.[1] ?? 0 };
    let phase: GamePhase = 'BIDDING';
    let order: string[] = [];
    let hands: Record<string, GameCard[]> = {};
    let talon: Record<string, GameCard[]> = {};
    let bids: GameBid[] = [];
    let trump: Boja | null = null;
    let trick = { lead: '', plays: {} as Record<string, GameCard>, seq: [] as string[] };
    let completed: Completed[] = [];
    let stale: LiveTrick | null = null;
    let declarations: Record<string, DeclarationsView> = {};
    let bela: Record<string, boolean> = {};
    let current: string | null = null;
    let turnExpiresAt: number | null = null;
    let window: number | null = null;
    let winnerTeamId: Team | null = null;
    const won: Record<Team, number> = { A: 0, B: 0 };
    const handPoints: Record<Team, number> = { A: 0, B: 0 };

    const asLive = (lead: string, plays: Record<string, GameCard>, seq: string[]): LiveTrick => {
        const cards = seq.map((id) => plays[id]);
        const best = trickWinner(cards, trump);
        return { leadPlayerId: lead, trump, plays: clone(plays), winningCard: best < 0 ? null : clone(cards[best]) };
    };
    const display = (): LiveTrick => {
        if (phase === 'BIDDING') return stale ?? { leadPlayerId: '_NO_LEAD_', trump: null, plays: {}, winningCard: null };
        if (trick.seq.length > 0 || completed.length === 0) return asLive(trick.lead, trick.plays, trick.seq);
        const last = completed[completed.length - 1];
        return asLive(last.lead, last.plays, last.order);
    };
    const publicView = (): PublicGameView => {
        const seat = (id: string) => ({ id, cardsLeft: hands[id].length });
        const last = completed[completed.length - 1];
        const lastTrick: LastTrickView | null = last
            ? { leadPlayerId: last.lead, plays: clone(last.plays), order: [...last.order], winnerId: last.winnerId }
            : null;
        const view: PublicGameView = {
            gameId: GAME_ID,
            gameState: phase,
            bids: clone(bids),
            currentTrick: display(),
            teamAScore: scores.A,
            teamBScore: scores.B,
            teamA: TEAM_A.map(seat),
            teamB: TEAM_B.map(seat),
            challengeUsedByPlayer: Object.fromEntries(PLAYERS.map((id) => [id, false])),
            winnerTeamId,
            tieBreaker: false,
            seatingOrder: order.map(seat),
            declarations: clone(declarations),
            belaDeclaredByPlayer: { ...bela },
            challengeWindowExpiresAt: window,
            currentPlayerId: current,
            turnExpiresAt,
            endReason: null,
            forfeitTeamId: null,
        };
        if (!fields) return view;
        return { ...view, stateVersion: version, lastTrick, tricksWonA: won.A, tricksWonB: won.B, dealerId: dealer, serverNow: at };
    };
    const emit = (label: string, trigger: FanOut['trigger']) => {
        const pub = publicView();
        const live = phase === 'BIDDING' || phase === 'PLAYING';
        out.push({
            label,
            trigger,
            at,
            version,
            public: pub,
            private: Object.fromEntries(PLAYERS.map((id) => [id, {
                publicPart: clone(pub),
                hand: serverOrder(hands[id]),
                yourTurn: live && current === id,
                challengeUsed: false,
            }])),
        });
    };

    const deal = () => {
        handNo++;
        const rnd = random((options.seed ?? 7) * 1009 + handNo);
        const deck = shuffled(BOJE.flatMap((boja) => RANKS.map((rank) => ({ boja, rank }))), rnd);
        order = playOrder(PLAYERS, nextOf(dealer));
        hands = {};
        talon = {};
        order.forEach((id, i) => {
            hands[id] = deck.slice(i * 6, i * 6 + 6);
            talon[id] = deck.slice(24 + i * 2, 26 + i * 2);
        });
        phase = 'BIDDING';
        bids = [];
        trump = null;
        trick = { lead: '', plays: {}, seq: [] };
        completed = [];
        declarations = {};
        bela = Object.fromEntries(PLAYERS.map((id) => [id, false]));
        won.A = 0;
        won.B = 0;
        handPoints.A = 0;
        handPoints.B = 0;
        current = order[0];
    };

    const reveal = () => {
        const all = Object.fromEntries(order.map((id) => [id, declarationsOf(hands[id])]));
        const shown: Record<string, DeclarationsView> = {};
        for (const kind of ['bestSequencePoints', 'fourOfAKindPoints'] as const) {
            const top = Math.max(...order.map((id) => all[id][kind] ?? 0));
            if (top === 0) continue;
            const team = teamOf(order.find((id) => all[id][kind] === top)!);
            for (const id of order) {
                if (teamOf(id) !== team || !all[id][kind]) continue;
                const entry = shown[id] ?? { bela: false, sequencesBySuit: {}, fourOfAKindPoints: 0, bestSequencePoints: 0 };
                if (kind === 'bestSequencePoints') {
                    entry.bestSequencePoints = all[id].bestSequencePoints;
                    entry.sequencesBySuit = all[id].sequencesBySuit;
                } else entry.fourOfAKindPoints = all[id].fourOfAKindPoints;
                shown[id] = entry;
            }
        }
        declarations = shown;
    };

    const bid = (player: string, call: Boja | null) => {
        at += STEP_MS;
        bids.push({ playerId: player, action: call ? 'CALL_TRUMP' : 'PASS', selectedTrump: call });
        if (!call) {
            current = nextOf(player);
            version++;
            turnExpiresAt = at + TURN_MS;
            emit(`bid:${player}:PASS`, 'TS');
            emit(`bid:${player}:PASS`, 'CTL');
            return;
        }
        trump = call;
        order.forEach((id) => hands[id].push(...talon[id]));
        reveal();
        phase = 'PLAYING';
        trick = { lead: order[0], plays: {}, seq: [] };
        current = order[0];
        version++;
        turnExpiresAt = null;
        emit(`call:${player}:${call}`, 'GSC');
        turnExpiresAt = at + TURN_MS;
        emit(`call:${player}:${call}`, 'TS');
        emit(`call:${player}:${call}`, 'CTL');
    };

    const choose = (player: string): GameCard => {
        const hand = serverOrder(hands[player]);
        const lead = trick.seq.length ? trick.plays[trick.seq[0]].boja : null;
        const follow = lead ? hand.filter((card) => card.boja === lead) : [];
        const trumps = hand.filter((card) => card.boja === trump);
        const pool = follow.length ? follow : lead && trumps.length ? trumps : hand;
        return pool[0];
    };

    const endHand = () => {
        const declared: Record<Team, number> = { A: 0, B: 0 };
        Object.entries(declarations).forEach(([id, d]) => {
            declared[teamOf(id)] += (d.bestSequencePoints ?? 0) + (d.fourOfAKindPoints ?? 0);
        });
        Object.entries(bela).forEach(([id, on]) => {
            if (on) declared[teamOf(id)] += 20;
        });
        const total: Record<Team, number> = { A: handPoints.A + declared.A, B: handPoints.B + declared.B };
        if (won.A === 8) total.A += 90;
        if (won.B === 8) total.B += 90;
        const caller = teamOf(bids.find((b) => b.action === 'CALL_TRUMP')!.playerId);
        const other: Team = caller === 'A' ? 'B' : 'A';
        if (total[caller] <= total[other]) {
            scores[other] += total[caller] + total[other];
        } else {
            scores.A += total.A;
            scores.B += total.B;
        }
    };

    const play = (player: string) => {
        at += STEP_MS;
        const card = choose(player);
        hands[player] = hands[player].filter((held) => cardId(held) !== cardId(card));
        const partner = card.rank === 'KRALJ' ? 'BABA' : card.rank === 'BABA' ? 'KRALJ' : null;
        if (card.boja === trump && partner && hands[player].some((held) => held.boja === trump && held.rank === partner)) {
            bela[player] = true;
        }
        trick.plays[player] = card;
        trick.seq.push(player);
        const label = `play:${player}:${cardId(card)}`;
        if (trick.seq.length < 4) {
            current = nextOf(player);
            version++;
            turnExpiresAt = at + TURN_MS;
            emit(label, 'TS');
            emit(label, 'CTL');
            return;
        }
        const cards = trick.seq.map((id) => trick.plays[id]);
        const winnerId = trick.seq[trickWinner(cards, trump)];
        completed.push({ lead: trick.lead, plays: { ...trick.plays }, order: [...trick.seq], winnerId });
        won[teamOf(winnerId)]++;
        handPoints[teamOf(winnerId)] += cards.reduce((sum, c) => sum + ((c.boja === trump ? TRUMP_POINTS : PLAIN_POINTS)[c.rank] ?? 0), 0)
            + (completed.length === 8 ? 10 : 0);
        order = playOrder(order, winnerId);
        trick = { lead: winnerId, plays: {}, seq: [] };
        if (completed.length < 8) {
            current = winnerId;
            version++;
            turnExpiresAt = at + TURN_MS;
            emit(label, 'TS');
            emit(label, 'CTL');
            return;
        }
        endHand();
        phase = 'HAND_COMPLETE';
        current = null;
        turnExpiresAt = null;
        window = null;
        version++;
        emit('hand-complete', 'GSC');
        window = at + WINDOW_MS;
        version++;
        emit('window-open', 'GSC');
        version++;
        emit('window-open', 'CTL');
    };

    const windowExpiry = () => {
        const expired = window!;
        at = expired;
        window = null;
        version++;
        emit('window-close', 'GSC');
        if ((scores.A >= target || scores.B >= target) && scores.A !== scores.B) {
            phase = 'COMPLETED';
            winnerTeamId = scores.A > scores.B ? 'A' : 'B';
            version++;
            emit('game-over', 'GSC');
            emit('game-over', 'GSC');
            return false;
        }
        const last = completed[completed.length - 1];
        stale = asLive(last.lead, last.plays, last.order);
        window = expired;
        dealer = nextOf(dealer);
        deal();
        version++;
        turnExpiresAt = null;
        emit('next-deal', 'GSC');
        turnExpiresAt = at + TURN_MS;
        emit('next-deal', 'TS');
        emit('next-deal', 'GSC');
        return true;
    };

    deal();
    version++;
    turnExpiresAt = null;
    emit('deal', 'GSC');
    turnExpiresAt = at + TURN_MS;
    emit('deal', 'TS');
    for (let h = 0; h < (options.hands ?? 1); h++) {
        const bidders = [...order];
        bidders.forEach((id, i) => {
            if (i <= callAt && phase === 'BIDDING') bid(id, i === callAt ? trumpCall : null);
        });
        for (let card = 0; card < 32; card++) play(current!);
        if (!windowExpiry()) break;
    }
    return out;
}

/** What `me` receives, in the server's order: per fan-out the public frame, then the private one. */
export function deliveries(fanOuts: readonly FanOut[], me: string): Delivery[] {
    return fanOuts.flatMap((f): Delivery[] => [
        { channel: 'public', body: f.public },
        { channel: 'private', body: f.private[me] },
    ]);
}

/** The private frame before the public one in every fan-out (they travel on separate subscriptions). */
export function privateFirst(fanOuts: readonly FanOut[], me: string): Delivery[] {
    return fanOuts.flatMap((f): Delivery[] => [
        { channel: 'private', body: f.private[me] },
        { channel: 'public', body: f.public },
    ]);
}

/** Every delivery twice in a row. */
export function duplicated(stream: readonly Delivery[]): Delivery[] {
    return stream.flatMap((d) => [d, d]);
}

/** After every `every`-th private delivery, the private delivery before it once more (older after newer). */
export function staleRedelivery(stream: readonly Delivery[], every = 3): Delivery[] {
    const out: Delivery[] = [];
    let previous: Delivery | null = null;
    let count = 0;
    for (const d of stream) {
        out.push(d);
        if (d.channel !== 'private') continue;
        count++;
        if (count % every === 0 && previous) out.push(previous);
        previous = d;
    }
    return out;
}

/** The deliveries of fan-outs [0, from), then a snapshot of fan-out `to`: everything between is lost. */
export function snapshotJump(fanOuts: readonly FanOut[], me: string, from: number, to: number): Delivery[] {
    return [...deliveries(fanOuts.slice(0, from), me), { channel: 'snapshot', body: fanOuts[to].private[me] }];
}

/** Index of the first fan-out at or after `from` whose label starts with `prefix`; throws when there is none. */
export function indexOf(fanOuts: readonly FanOut[], prefix: string, from = 0): number {
    const i = fanOuts.findIndex((f, k) => k >= from && f.label.startsWith(prefix));
    if (i < 0) throw new Error(`no fan-out labelled ${prefix}…`);
    return i;
}

/** The first fan-out at or after `from` whose label starts with `prefix`. */
export function find(fanOuts: readonly FanOut[], prefix: string, from = 0): FanOut {
    return fanOuts[indexOf(fanOuts, prefix, from)];
}
