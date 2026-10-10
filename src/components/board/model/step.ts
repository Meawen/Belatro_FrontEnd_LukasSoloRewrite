import { boardModel, type BoardLocal, type BoardModel } from './boardModel';
import { diffBoard, type BoardEvent } from './diffBoard';
import { settleInput } from './input';
import type { BoardState } from './accept';

export interface BoardStep {
    /** What to render. */
    model: BoardModel;
    /** What to animate; null: snap every element to its target (a snapshot, or an unexplainable change). */
    events: BoardEvent[] | null;
    /** Keep for the next state. */
    local: BoardLocal;
}

/**
 * The piles without tricksWonA/B (spec §5.3.3): completions counted this hand, reset at the deal. After a
 * snap they are unknown (hidden) until the next deal, unless no trick can have been taken yet.
 */
function countTricks(counted: BoardLocal['counted'], model: BoardModel, events: BoardEvent[] | null): BoardLocal['counted'] {
    if (events === null) return model.bidding || model.seats.every((seat) => seat.cardsLeft === 8) ? { a: 0, b: 0 } : null;
    let next = counted;
    for (const event of events) {
        if (event.type === 'Dealt') next = { a: 0, b: 0 };
        if (event.type === 'TrickCompleted' && next && event.winnerTeam === 'A') next = { ...next, a: next.a + 1 };
        if (event.type === 'TrickCompleted' && next && event.winnerTeam === 'B') next = { ...next, b: next.b + 1 };
    }
    return next;
}

/**
 * One newly accepted state → the model, its events and the next local state: the board's whole update.
 * A snapshot-tagged state always snaps (spec §5.5). The input rules settle against the new model, and
 * the model is rebuilt when they or the counted piles change, so `enabled`/`pending` are current.
 */
export function stepBoard(prev: BoardModel | null, state: BoardState, me: string, local: BoardLocal, now: number): BoardStep {
    const draft = boardModel(state, me, local);
    const events = state.source === 'snapshot' ? null : diffBoard(prev, draft);
    const counted = countTricks(local.counted, draft, events);
    const input = settleInput(local.input, draft, now);
    const next: BoardLocal = { order: draft.order, counted, input };
    const model = counted === local.counted && input === local.input ? draft : boardModel(state, me, next);
    return { model, events, local: next };
}
