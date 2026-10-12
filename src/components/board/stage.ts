import { stagger } from '../../motion/tokens';
import { EMPTY_LOCAL, boardModel, type BoardLocal, type BoardModel, type InputState, type SeatModel, type Team, type TrickModel } from './model/boardModel';
import { settleInput } from './model/input';
import { stepBoard } from './model/step';
import type { BoardState } from './model/accept';
import type { BoardEvent } from './model/diffBoard';

/**
 * How a card element that mounts in this step comes in (spec §5.3.4): from a seat's hand anchor
 * (`targets.anchors`), after `delay` seconds, face down first when `flip`, at `scale`.
 */
export interface Entrance {
    from: string;
    delay: number;
    flip: boolean;
    scale: number;
}

/**
 * A trick on its way off the table: the sweep layer (spec §5.10). `table`: still on its slots while a
 * recovered 4th card lands; `pile`: flying to the winner's pile, then fading; `fade`: fading where it
 * lies (a successful challenge ended the hand).
 */
export interface Leaving {
    key: string;
    /** The deal it belongs to: its cards' layoutIds are `${deal}:${cardId}`. */
    deal: number;
    trick: TrickModel;
    team: Team | null;
    at: 'table' | 'pile' | 'fade';
    /** The recovered card that enters from its seat, if it isn't mine. */
    enter: string | null;
}

/**
 * Everything the board keeps besides the server's state (spec §5.3.4, §5.5): the model and its local
 * state, the last step's events, the finished trick held on the table, the tricks already off the
 * table, the sweep layer and how newly mounted cards enter. Pure: the Board's timers call the
 * transitions below.
 */
export interface Stage {
    me: string;
    state: BoardState | null;
    model: BoardModel | null;
    local: BoardLocal;
    /** The last step's events; null: it snapped. */
    events: BoardEvent[] | null;
    /** Counts the steps, so effects run once per step. */
    seq: number;
    /** Counts the deals. Card elements are keyed `${deal}:${cardId}`, so a card of a new hand is a new element. */
    deal: number;
    /** Counts the trump calls seen live: the arena's burst (never on a snap). */
    calls: number;
    /** The finished trick held on the table until its sweep (hold.trick). */
    held: { key: string; trick: TrickModel } | null;
    /** Tricks already swept or faded: the trick region no longer shows them, though the view still may. */
    cleared: readonly string[];
    leaving: readonly Leaving[];
    /** How the elements that mount in this step enter, by element key: a card id, or `back:{playerId}:{i}`. */
    entrances: Readonly<Record<string, Entrance>>;
    /** The last hand's score change, while the stored hand hasn't arrived (the hand-result sheet). */
    handDelta: { a: number; b: number } | null;
}

export function emptyStage(me: string): Stage {
    return {
        me, state: null, model: null, local: EMPTY_LOCAL, events: null, seq: 0, deal: 0, calls: 0,
        held: null, cleared: [], leaving: [], entrances: {}, handDelta: null,
    };
}

/** A trick's identity on the table: its lead and its cards. */
export function trickKey(trick: TrickModel): string {
    return `${trick.leadPlayerId}:${trick.plays.map((play) => play.id).join(',')}`;
}

/** Seat s's r-th new card, in turn order from the first bidder, leaves the dealer after (r·4 + s) × 30 ms. */
function fromDealer(model: BoardModel, order: readonly string[], from: string, keysOf: (seat: SeatModel) => string[]): Record<string, Entrance> {
    const entrances: Record<string, Entrance> = {};
    order.forEach((id, s) => {
        const seat = model.seats.find((one) => one.id === id);
        if (!seat) return;
        keysOf(seat).forEach((key, r) => {
            entrances[key] = { from, delay: (r * order.length + s) * stagger.deal, flip: seat.isMe, scale: 0.4 };
        });
    });
    return entrances;
}

const backs = (seat: SeatModel, first = 0) =>
    Array.from({ length: Math.max(0, seat.cardsLeft - first) }, (_, i) => `back:${seat.id}:${first + i}`);

/** One accepted state: the model, then what its events do to the table (spec §5.3.4); a snap resets it (§5.5). */
export function stepStage(stage: Stage, state: BoardState, now: number): Stage {
    const prev = stage.model;
    const step = stepBoard(prev, state, stage.me, stage.local, now);
    const model = step.model;
    const base = { ...stage, state, model, local: step.local, events: step.events, seq: stage.seq + 1 };
    if (step.events === null) {
        // a snap: every element at its target; a finished trick counts as gone, a trick in progress shows as is
        const shown = model.trick;
        return { ...base, held: null, leaving: [], cleared: shown?.complete ? [trickKey(shown)] : [], entrances: {} };
    }

    let { deal, calls, held, handDelta } = stage;
    let cleared = [...stage.cleared];
    const leaving = [...stage.leaving];
    const entrances: Record<string, Entrance> = {};
    const recovered = new Set(step.events.flatMap((e) => (e.type === 'CardPlayed' && e.recovered ? [e.id] : [])));

    for (const event of step.events) {
        switch (event.type) {
            case 'ChallengeUpheld': {
                const partial = prev?.trick;
                if (partial && !partial.complete && partial.plays.length > 0 && !cleared.includes(trickKey(partial))) {
                    leaving.push({ key: trickKey(partial), deal, trick: partial, team: null, at: 'fade', enter: null });
                    cleared.push(trickKey(partial));
                }
                break;
            }
            case 'CardPlayed':
                if (!event.mine && !event.recovered) entrances[event.id] = { from: event.playerId, delay: 0, flip: true, scale: 0.5 };
                break;
            case 'TrickCompleted': {
                if (!event.recovered) {
                    if (model.trick?.complete) held = { key: trickKey(model.trick), trick: model.trick };
                    break;
                }
                const last = model.lastTrick;
                if (!last) break;
                const enter = last.plays.find((play) => recovered.has(play.id) && play.playerId !== stage.me) ?? null;
                leaving.push({ key: trickKey(last), deal, trick: last, team: event.winnerTeam, at: 'table', enter: enter?.id ?? null });
                cleared.push(trickKey(last));
                if (enter) entrances[enter.id] = { from: enter.playerId, delay: 0, flip: true, scale: 0.5 };
                break;
            }
            case 'TrickCollected':
                // the next lead came, or a deal: the held trick leaves now, without waiting for its hold
                if (held && held.trick.plays.map((play) => play.id).join() === event.cards.join()) {
                    leaving.push({ key: held.key, deal, trick: held.trick, team: event.winnerTeam, at: 'pile', enter: null });
                    cleared.push(held.key);
                    held = null;
                }
                break;
            case 'Dealt': {
                deal += 1;
                cleared = [];
                held = null;
                handDelta = null;
                const from = event.dealerId ?? model.dealerId;
                if (from) Object.assign(entrances, fromDealer(model, event.order, from, (seat) => (seat.isMe ? model.hand.map((card) => card.id) : backs(seat))));
                break;
            }
            case 'TrumpCalled': {
                // +2 per seat from the dealer; my two new cards may sit anywhere in the sorted hand
                calls += 1;
                const from = event.dealerId ?? model.dealerId;
                if (!from || !prev) break;
                const before = new Set(prev.hand.map((card) => card.id));
                const had = (id: string) => prev.seats.find((one) => one.id === id)?.cardsLeft ?? 0;
                Object.assign(entrances, fromDealer(model, model.turnOrder, from, (seat) => (seat.isMe
                    ? model.hand.filter((card) => !before.has(card.id)).map((card) => card.id)
                    : backs(seat, had(seat.id)))));
                break;
            }
            case 'HandCompleted':
                handDelta = event.delta;
                break;
            default:
                break;
        }
    }
    return { ...base, deal, calls, held, cleared, leaving, entrances, handDelta };
}

/** The hold is over (hold.trick): the held trick flies to its winner's pile. */
export function sweepHeld(stage: Stage, key: string): Stage {
    const held = stage.held;
    if (!held || held.key !== key) return stage;
    return {
        ...stage,
        held: null,
        cleared: [...stage.cleared, key],
        leaving: [...stage.leaving, { key, deal: stage.deal, trick: held.trick, team: held.trick.winnerTeam, at: 'pile', enter: null }],
    };
}

/** A recovered trick's 4th card has landed: the trick sweeps. */
export function landTrick(stage: Stage, key: string): Stage {
    if (!stage.leaving.some((one) => one.key === key && one.at === 'table')) return stage;
    return { ...stage, leaving: stage.leaving.map((one) => (one.key === key && one.at === 'table' ? { ...one, at: 'pile' } : one)) };
}

/** A sweep or fade has finished: its cards leave the DOM. */
export function dropLeaving(stage: Stage, key: string): Stage {
    if (!stage.leaving.some((one) => one.key === key)) return stage;
    return { ...stage, leaving: stage.leaving.filter((one) => one.key !== key) };
}

/** New input state (a press, a lost send, a reconnect): the model is rebuilt so `enabled`/`pending` are current. */
export function withInput(stage: Stage, input: InputState): Stage {
    if (!stage.state || input === stage.local.input) return stage;
    const local = { ...stage.local, input };
    return { ...stage, local, model: boardModel(stage.state, stage.me, local) };
}

/** The 2-s lift is over (pendingUntil): the card drops back, the lock holds (O-2). */
export function settleStage(stage: Stage, now: number): Stage {
    if (!stage.model) return stage;
    return withInput(stage, settleInput(stage.local.input, stage.model, now));
}

/** The trick the trick region shows: the model's, unless it has already left the table. */
export function tableTrick(stage: Stage): TrickModel | null {
    const trick = stage.model?.trick ?? null;
    return trick && !stage.cleared.includes(trickKey(trick)) ? trick : null;
}

/** The piles as shown: a trick held on the table or still flying is not on its pile yet. */
export function shownPiles(stage: Stage): { a: number; b: number } | null {
    const piles = stage.model?.piles;
    if (!piles) return null;
    const away = [
        ...(stage.held ? [stage.held.trick.winnerTeam] : []),
        ...stage.leaving.filter((one) => one.at !== 'fade').map((one) => one.team),
    ];
    return {
        a: Math.max(0, piles.a - away.filter((team) => team === 'A').length),
        b: Math.max(0, piles.b - away.filter((team) => team === 'B').length),
    };
}
