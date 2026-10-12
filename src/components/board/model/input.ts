import type { BoardModel, InputState, Pending } from './boardModel';
import type { CardId } from './rules';
import type { Boja, GameCard } from '../../../types/game';

/** A sent card stays lifted this long; the lock itself holds until the server answers (spec §5.3.5 #3). */
export const PENDING_MS = 2000;

/** What to send: `/app/games/{id}/play` or `/bid` (useGameViews' actions). `trump: null` is a pass. */
export type Move =
    | { kind: 'play'; card: GameCard; declareBela: boolean }
    | { kind: 'bid'; trump: Boja | null };

export interface InputResult {
    input: InputState;
    /** The move to send now, or null when the press changes nothing or only opens the bela prompt. */
    move: Move | null;
}

/** The state a move was sent from, which a newer state answers. */
type SentFrom = { version: number | null; receivedAt: number };

const sentFrom = (model: BoardModel): SentFrom => ({ version: model.version, receivedAt: model.receivedAt });

/** A state newer than the one a move was sent from: a higher stateVersion; without versions, any later state. */
const answered = (sent: SentFrom, model: BoardModel) => (sent.version !== null && model.version !== null
    ? model.version > sent.version
    : model.receivedAt > sent.receivedAt);

/**
 * The declarations are being said (gameplay rules spec §4): no card may be played before
 * `playOpensAt`, on the server's clock (Date.now() + skew, as secondsLeft counts).
 */
export function waitingForDeclarations(model: BoardModel, now: number): boolean {
    return model.playOpensAt !== null && now + model.skew < model.playOpensAt;
}

const cardPending = (model: BoardModel, cardId: CardId, now: number): Pending =>
    ({ kind: 'card', cardId, at: now, lifted: true, ...sentFrom(model) });

/**
 * A click on a hand card (spec §5.3.5 #2, #5). It acts only on a card the newest model shows as mine
 * and enabled (my turn, nothing in flight), once the declarations are said: a bela card opens the
 * prompt; any other card is sent and becomes pending, which locks the rest of the hand.
 */
export function pressCard(model: BoardModel, input: InputState, cardId: CardId, now: number): InputResult {
    const card = model.hand.find((held) => held.id === cardId);
    if (!card || !card.enabled || waitingForDeclarations(model, now)) return { input, move: null };
    if (card.bela) return { input: { ...input, belaCardId: card.id }, move: null };
    return { input: { pending: cardPending(model, cardId, now), belaCardId: null }, move: { kind: 'play', card: card.card, declareBela: false } };
}

/** "Play" (false) or "Play + Bela" (true) in the bela prompt (R-32); nothing while the declarations are said. */
export function answerBela(model: BoardModel, input: InputState, declareBela: boolean, now: number): InputResult {
    const card = model.belaPrompt;
    if (!card || !card.enabled || waitingForDeclarations(model, now)) return { input, move: null };
    return { input: { pending: cardPending(model, card.id, now), belaCardId: null }, move: { kind: 'play', card: card.card, declareBela } };
}

/** "Pass" or "Call {suit}": one bid in flight; no Pass when the dealer must call (R-23). */
export function pressBid(model: BoardModel, input: InputState, call: Boja | 'PASS', now: number): InputResult {
    if (!model.bidsEnabled || (call === 'PASS' && !model.passEnabled)) return { input, move: null };
    return {
        input: { ...input, pending: { kind: 'bid', at: now, ...sentFrom(model) } },
        move: { kind: 'bid', trump: call === 'PASS' ? null : call },
    };
}

/**
 * Nothing is in flight any more: `publish` returned false ("Not sent — reconnecting" shows), or the
 * socket reconnected (a move sent before the drop may be lost).
 */
export function unlock(input: InputState): InputState {
    return input.pending ? { ...input, pending: null } : input;
}

/**
 * What the newest model settles (spec §5.3.5 #3-4). Call it with every new model, and when
 * pendingUntil() passes. A move in flight is released once a state newer than the one it was sent from
 * is accepted (a higher stateVersion; without versions, any later state), or when my turn passes. After
 * 2 s a card only drops back (`lifted` false): the lock holds. The bela prompt closes when I can't play
 * its card any more. Returns `input` itself when nothing changes.
 */
export function settleInput(input: InputState, model: BoardModel, now: number): InputState {
    let { pending, belaCardId } = input;
    if (pending) {
        const newer = answered(pending, model);
        const stillMyTurn = pending.kind === 'card' ? model.canPlay : model.canBid;
        if (newer || !stillMyTurn) pending = null;
        else if (pending.kind === 'card' && pending.lifted && now - pending.at >= PENDING_MS) pending = { ...pending, lifted: false };
    }
    if (belaCardId && (!model.canPlay || !model.hand.some((card) => card.id === belaCardId))) belaCardId = null;
    return pending === input.pending && belaCardId === input.belaCardId ? input : { pending, belaCardId };
}

/** When a lifted card drops back (epoch ms), for the board's timer; null when nothing is lifted. */
export function pendingUntil(input: InputState): number | null {
    return input.pending?.kind === 'card' && input.pending.lifted ? input.pending.at + PENDING_MS : null;
}

/** A challenge sent and not yet answered (gameplay rules §6): the state it was sent from. */
export type ChallengeSent = SentFrom;

/**
 * The challenge in flight is still waiting for the server: no state newer than the one it was sent from yet. A refused
 * press changes no state, so the error that answers it clears `sent` (the Board), as a reconnect or a lost send does.
 */
export function challengePending(sent: ChallengeSent | null, model: BoardModel): boolean {
    return sent !== null && !answered(sent, model);
}

/**
 * A press on Challenge: one tap, no confirm (D-4). It goes out only while Challenge is available and no challenge is in
 * flight, so a double tap sends once. Returns what to keep while it waits, or null when nothing is sent.
 */
export function pressChallenge(model: BoardModel, sent: ChallengeSent | null): ChallengeSent | null {
    return model.challenge === 'available' && !challengePending(sent, model) ? sentFrom(model) : null;
}
