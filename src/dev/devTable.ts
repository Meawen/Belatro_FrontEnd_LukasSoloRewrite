// The dev board's data (spec §4.17): Phase 3's deterministic table as the frames one seat receives,
// clean or with chaos, the structured moves the server would have stored by then, and the URL options.
// Dev only: src/dev is imported behind import.meta.env.DEV || VITE_DEV_BOARD (App.tsx).
import {
    deliveries, duplicated, indexOf, playTable, privateFirst, staleRedelivery, type Delivery, type FanOut,
} from '../test/fixtures/views/table';
import type { Frame } from '../components/board/model/accept';
import type { TableEffects } from '../settings/tableEffects';
import type { Boja, GameCard, PublicGameView } from '../types/game';
import type { HandDTO, TrickDTO } from '../types/match';

export const SEATS = ['alice', 'bob', 'carol', 'dave'] as const;
/** names=long: every seat named by the longest username the backend allows (20 of [A-Za-z0-9_]), wide letters and narrow. */
export const LONG_NAMES: Readonly<Record<(typeof SEATS)[number], string>> = {
    alice: 'WWWWWWWWWWWWWWWWWWWW',
    bob: 'MMMMMMMMMMMMMMMMMMMM',
    carol: 'mmmmmmmmmmmmmmmmmmmm',
    dave: 'aaaaaaaaaaaaaaaaaaaa',
};
export const LAYOUTS = ['fit', '375x812', '812x375', '1440x900'] as const;
export type DevLayout = (typeof LAYOUTS)[number];

export interface DevOptions {
    /** Whose frames the board gets. */
    seat: string;
    seed: number;
    trump: Boja;
    /** Hands to play (the table stops early when a team reaches 1001). */
    hands: number;
    /** Scores before the first hand: "990,900" makes the first hand decide the game. */
    scores: [number, number] | null;
    /** Jump straight to this fan-out (an index or a label prefix such as "window-open"), as a snapshot. */
    at: string | null;
    /** Duplicates, stale re-deliveries and the public frame first (the server's order). */
    chaos: boolean;
    layout: DevLayout;
    reduced: boolean;
    /** Table effects to set on load; null keeps the device's setting. */
    effects: TableEffects | null;
    /** The control bar; 0 hides it (the visual harness's shots). */
    controls: boolean;
    /** Skip every animation (MotionGlobalConfig.skipAnimations): the visual harness's shots. */
    skip: boolean;
    /** Start playing at once. */
    play: boolean;
    /** Deliveries per 400 ms. */
    speed: number;
    /** Every seat named by a 20-character name (LONG_NAMES): the visual harness's names check. */
    names: boolean;
}

const one = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;

/** `/dev/board?seat=carol&at=window-open&layout=375x812&effects=off&motion=reduce&chaos=1&controls=0&skip=1&play=1&speed=2&seed=7&trump=KARA&hands=2&scores=990,900&names=long` */
export function parseDevOptions(search: string): DevOptions {
    const q = new URLSearchParams(search);
    const scores = (q.get('scores') ?? '').split(',').map(Number);
    return {
        seat: one(q.get('seat'), SEATS, 'alice'),
        seed: Number(q.get('seed')) || 7,
        trump: one(q.get('trump'), ['HERC', 'KARA', 'PIK', 'TREF'] as const, 'HERC'),
        hands: Math.max(1, Number(q.get('hands')) || 2),
        scores: scores.length === 2 && scores.every(Number.isFinite) ? [scores[0], scores[1]] : null,
        at: q.get('at'),
        chaos: q.get('chaos') === '1',
        layout: one(q.get('layout'), LAYOUTS, 'fit'),
        reduced: q.get('motion') === 'reduce',
        effects: q.has('effects') ? one(q.get('effects'), ['full', 'calm', 'off'] as const, 'full') : null,
        controls: q.get('controls') !== '0',
        skip: q.get('skip') === '1',
        play: q.get('play') === '1',
        speed: Math.min(8, Math.max(0.25, Number(q.get('speed')) || 1)),
        names: q.get('names') === 'long',
    };
}

/** The id the board plays as: the seat, or its long name with names=long. */
export function seatId(options: Pick<DevOptions, 'seat' | 'names'>): string {
    return options.names ? LONG_NAMES[options.seat as (typeof SEATS)[number]] : options.seat;
}

/** Every player id in the frames (a whole JSON string: keys and values) replaced by its long name; labels stay. */
function withLongNames(fanOuts: FanOut[]): FanOut[] {
    const labels = fanOuts.map((f) => f.label);
    let text = JSON.stringify(fanOuts.map((f) => ({ ...f, label: '' })));
    for (const seat of SEATS) text = text.split(JSON.stringify(seat)).join(JSON.stringify(LONG_NAMES[seat]));
    return (JSON.parse(text) as FanOut[]).map((f, i) => ({ ...f, label: labels[i] }));
}

/** The table for these options, its clock set so that fan-out `atIndex` happens now (live countdowns). */
export function devTable(options: Pick<DevOptions, 'seed' | 'trump' | 'hands' | 'scores'> & { names?: boolean }, now: number, atIndex = 0): FanOut[] {
    const base = { seed: options.seed, trump: options.trump, hands: options.hands, ...(options.scores ? { scores: options.scores } : {}) };
    const probe = playTable(base);
    const offset = probe[Math.min(Math.max(0, atIndex), probe.length - 1)].at - probe[0].at;
    const table = playTable({ ...base, start: now - offset });
    return options.names ? withLongNames(table) : table;
}

/** A fan-out index from `at`: a number, or the first label starting with it; 0 when neither. */
export function resolveAt(fanOuts: readonly FanOut[], at: string | null): number {
    if (at === null || at === '') return 0;
    if (/^\d+$/.test(at)) return Math.min(Number(at), fanOuts.length - 1);
    try {
        return indexOf(fanOuts, at);
    } catch {
        return 0;
    }
}

/** One delivery and the fan-out it came from. */
export interface DevStep {
    fanOut: number;
    delivery: Delivery;
}

/** What `me` receives: clean (each private frame first) or with chaos (public first, duplicates, stale re-deliveries). */
export function devStream(fanOuts: readonly FanOut[], me: string, chaos: boolean): DevStep[] {
    const origin = new Map<object, number>();
    fanOuts.forEach((f, i) => {
        origin.set(f.public, i);
        origin.set(f.private[me], i);
    });
    const stream = chaos ? duplicated(staleRedelivery(deliveries(fanOuts, me))) : privateFirst(fanOuts, me);
    return stream.map((delivery) => ({ fanOut: origin.get(delivery.body) ?? 0, delivery }));
}

/** A delivery as the acceptance rule takes it (useGameViews' routing). */
export function frameOf(delivery: Delivery): Frame {
    if (delivery.channel === 'public') return { kind: 'public', view: delivery.body };
    return { kind: 'private', view: delivery.body, source: delivery.channel === 'snapshot' ? 'snapshot' : 'live' };
}

const move = (card: GameCard, player: string, order: number) => ({ order, player, card: `${card.rank} of ${card.boja}`, legal: true });

function declared(view: PublicGameView, team: 'A' | 'B'): number {
    const members = (team === 'A' ? view.teamA : view.teamB).map((seat) => seat.id);
    let points = 0;
    for (const [id, d] of Object.entries(view.declarations ?? {})) {
        if (members.includes(id)) points += (d.bestSequencePoints ?? 0) + (d.fourOfAKindPoints ?? 0);
    }
    for (const [id, on] of Object.entries(view.belaDeclaredByPlayer ?? {})) if (on && members.includes(id)) points += 20;
    return points;
}

/**
 * The structured moves the server would have stored by fan-out `upTo` (GET /matches/{id}/structured-moves):
 * per hand its trump calls, its completed tricks with their winners, and its summary once it ended.
 */
export function devHands(fanOuts: readonly FanOut[], upTo: number): HandDTO[] {
    const hands: HandDTO[] = [];
    let current: HandDTO | null = null;
    let seen = '';
    let before = { a: fanOuts[0]?.public.teamAScore ?? 0, b: fanOuts[0]?.public.teamBScore ?? 0 };
    for (const f of fanOuts.slice(0, upTo + 1)) {
        const view = f.public;
        if ((f.label === 'deal' && !current) || (f.label === 'next-deal' && current?.handSummary)) {
            if (current?.handSummary) before = { a: current.handSummary.finalScoreA, b: current.handSummary.finalScoreB };
            current = { handNo: hands.length + 1, trumpCalls: [], tricks: [], challenges: [], handSummary: null };
            hands.push(current);
            seen = '';
        }
        if (!current) continue;
        current.trumpCalls = view.bids.map((bid, i) => ({ order: i, player: bid.playerId, trump: bid.action === 'PASS' ? 'PASS' : bid.selectedTrump }));
        const last = view.lastTrick;
        const key = last ? `${last.leadPlayerId}:${last.order.map((id) => `${last.plays[id].boja}-${last.plays[id].rank}`).join(',')}` : '';
        if (last && key !== seen && view.gameState !== 'BIDDING') {
            seen = key;
            const trickNo = (current.tricks ?? []).length + 1;
            const trick: TrickDTO = { trickNo, winnerId: last.winnerId, points: null, moves: last.order.map((id, k) => move(last.plays[id], id, k)), lastTrickBonus: trickNo === 8 };
            current.tricks = [...(current.tricks ?? []), trick];
        }
        if (view.gameState === 'HAND_COMPLETE' && !current.handSummary) {
            const gainA = view.teamAScore - before.a;
            const gainB = view.teamBScore - before.b;
            const caller = view.bids.find((bid) => bid.action === 'CALL_TRUMP')?.playerId;
            const callerTeam = caller && view.teamA.some((seat) => seat.id === caller) ? 'A' : 'B';
            current.handSummary = {
                teamAPoints: gainA - declared(view, 'A'),
                teamBPoints: gainB - declared(view, 'B'),
                teamADeclPoints: declared(view, 'A'),
                teamBDeclPoints: declared(view, 'B'),
                teamATricksWon: view.tricksWonA ?? 0,
                teamBTricksWon: view.tricksWonB ?? 0,
                padanje: (callerTeam === 'A' ? gainA : gainB) === 0,
                capot: view.tricksWonA === 8 || view.tricksWonB === 8,
                finalScoreA: view.teamAScore,
                finalScoreB: view.teamBScore,
            };
        }
    }
    return hands;
}
