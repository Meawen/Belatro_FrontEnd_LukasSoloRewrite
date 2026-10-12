import type { BoardModel, Team, TrickModel, TrickPlayModel } from './boardModel';
import type { CardId } from './rules';
import type { Boja, GameCard } from '../../../types/game';

/**
 * What changed between two rendered states (spec §5.3.4). The board maps each to motion; positions
 * always come from cardTargets, so events only choose origins, holds and announcements.
 */
export type BoardEvent =
    /** A new deal: cards fly from the dealer's seat to every seat in `order` (from the first bidder). */
    | { type: 'Dealt'; dealerId: string | null; order: string[] }
    | { type: 'Bid'; playerId: string; call: 'PASS' | Boja }
    /** Trump called: the season changes, the badge flies from the caller, +2 cards per seat from the dealer. */
    | { type: 'TrumpCalled'; suit: Boja; playerId: string | null; dealerId: string | null }
    /** Zvanja appeared at these seats. */
    | { type: 'Declared'; playerIds: string[] }
    /** A card reached the trick: an opponent's flies in from their seat, mine from my hand. `recovered`:
     *  a 4th card the board never saw on the table, rebuilt from lastTrick. */
    | { type: 'CardPlayed'; playerId: string; card: GameCard; id: CardId; mine: boolean; recovered: boolean }
    /** The trick's 4th card is down: crown the winner, hold, then sweep (at once when `recovered`). */
    | { type: 'TrickCompleted'; winnerId: string | null; winnerTeam: Team | null; cards: CardId[]; recovered: boolean }
    /** The completed trick leaves the table now (the next lead came, or a deal): sweep it without waiting. */
    | { type: 'TrickCollected'; winnerTeam: Team | null; cards: CardId[] }
    /** The hand ended; `delta` is the score change from the last PLAYING state, when the board saw it. */
    | { type: 'HandCompleted'; delta: { a: number; b: number } | null }
    | { type: 'Bela'; playerId: string }
    | { type: 'Scored'; from: { a: number; b: number }; to: { a: number; b: number } }
    | { type: 'Turn'; playerId: string | null }
    /** A successful challenge: the hand ended early, or HAND_COMPLETE scores changed. `team` takes the hand. */
    | { type: 'ChallengeUpheld'; team: Team | null }
    /** A seat's challenge flag flipped and nothing else changed: "No foul found" (mine), "{name} challenged: no foul found". */
    | { type: 'ChallengeFailed'; playerId: string; mine: boolean }
    | { type: 'Ended'; phase: 'COMPLETED' | 'CANCELLED' };

const ids = (plays: readonly TrickPlayModel[]) => plays.map((play) => play.id);
const has = (plays: readonly TrickPlayModel[], play: TrickPlayModel) =>
    plays.some((other) => other.id === play.id && other.playerId === play.playerId);

function cardPlayed(play: TrickPlayModel, me: string, recovered: boolean): BoardEvent {
    return { type: 'CardPlayed', playerId: play.playerId, card: play.card, id: play.id, mine: play.playerId === me, recovered };
}

function completed(trick: TrickModel, recovered: boolean): BoardEvent {
    return { type: 'TrickCompleted', winnerId: trick.winnerId, winnerTeam: trick.winnerTeam, cards: ids(trick.plays), recovered };
}

const collected = (trick: TrickModel): BoardEvent => ({ type: 'TrickCollected', winnerTeam: trick.winnerTeam, cards: ids(trick.plays) });

const dealt = (next: BoardModel): BoardEvent => ({ type: 'Dealt', dealerId: next.dealerId, order: next.turnOrder });

const sameSeats = (prev: BoardModel, next: BoardModel) =>
    prev.seats.length === next.seats.length && prev.seats.every((seat, i) => seat.id === next.seats[i].id);

/** The trick's events, or false when cards left the table without a completion the board can explain. */
function trickEvents(prev: BoardModel, next: BoardModel, events: BoardEvent[]): boolean {
    const before = prev.trick?.plays ?? [];
    const after = next.trick?.plays ?? [];
    if (prev.trick && next.trick && prev.trick.leadPlayerId === next.trick.leadPlayerId && before.every((play) => has(after, play))) {
        after.filter((play) => !has(before, play)).forEach((play) => events.push(cardPlayed(play, next.me, false)));
        if (!prev.trick.complete && next.trick.complete) events.push(completed(next.trick, false));
        return true;
    }
    if (prev.trick?.complete) {
        events.push(collected(prev.trick));
    } else if (prev.trick && before.length > 0) {
        // The 4-card view was missed: lastTrick still holds the trick that left the table.
        const last = next.lastTrick;
        if (!last || last.leadPlayerId !== prev.trick.leadPlayerId || !before.every((play) => has(last.plays, play))) return false;
        last.plays.filter((play) => !has(before, play)).forEach((play) => events.push(cardPlayed(play, next.me, true)));
        events.push(completed(last, true), collected(last));
    }
    after.forEach((play) => events.push(cardPlayed(play, next.me, false)));
    if (next.trick?.complete) events.push(completed(next.trick, false));
    return true;
}

/**
 * The events from `prev` to `next` (spec §5.3.4): [] for a duplicate, null when the change can't be
 * explained by content (cards vanished from the trick without a completion, my hand changed by more
 * than one card mid-hand, the seats changed): the board then snaps. Versions play no part here.
 */
export function diffBoard(prev: BoardModel | null, next: BoardModel): BoardEvent[] | null {
    if (!prev) return next.bidding && next.bids.length === 0 ? [dealt(next)] : null;
    if (!sameSeats(prev, next)) return null;
    if (prev.finished) return next.phase === prev.phase ? [] : null;

    const events: BoardEvent[] = [];
    const scoresChanged = prev.scores.a !== next.scores.a || prev.scores.b !== next.scores.b;
    const endedEarly = prev.playing && (next.bidding || next.phase === 'COMPLETED') && prev.seats.some((seat) => seat.cardsLeft > 0);
    if (endedEarly || (prev.handComplete && next.handComplete && scoresChanged)) {
        const gainA = next.scores.a - prev.scores.a;
        const gainB = next.scores.b - prev.scores.b;
        events.push({ type: 'ChallengeUpheld', team: gainA > gainB ? 'A' : gainB > gainA ? 'B' : null });
    }

    const handIds = (model: BoardModel) => model.hand.map((card) => card.id);
    const sameHand = handIds(prev).length === handIds(next).length && handIds(prev).every((id) => handIds(next).includes(id));
    const newDeal = next.bidding && next.bids.length === 0 && (!prev.bidding || prev.bids.length > 0 || !sameHand);
    if (newDeal) {
        if (prev.trick?.complete) events.push(collected(prev.trick));
        events.push(dealt(next));
    } else {
        if (next.bidding && !prev.bidding) return null;
        if (prev.bids.length > next.bids.length || prev.bids.some((bid, i) => bid.playerId !== next.bids[i].playerId)) return null;
        next.bids.slice(prev.bids.length).forEach((bid) => events.push({
            type: 'Bid', playerId: bid.playerId, call: bid.action === 'CALL_TRUMP' && bid.selectedTrump ? bid.selectedTrump : 'PASS',
        }));
        if (!prev.trump && next.trump) {
            events.push({ type: 'TrumpCalled', suit: next.trump.suit, playerId: next.trump.callerId, dealerId: next.dealerId });
        }
        const zvanja = (model: BoardModel) => model.seats.filter((seat) => seat.zvanja.length > 0).map((seat) => seat.id);
        if (zvanja(prev).length === 0 && zvanja(next).length > 0) events.push({ type: 'Declared', playerIds: zvanja(next) });
        if (!trickEvents(prev, next, events)) return null;
        if (!next.finished) {
            // my hand: only the +2 of the trump call arrive, and only a card I played (now on the table) leaves
            const before = new Set(handIds(prev));
            const after = new Set(handIds(next));
            const added = [...after].filter((id) => !before.has(id));
            const removed = [...before].filter((id) => !after.has(id));
            const played = new Set(events.flatMap((event) => (event.type === 'CardPlayed' && event.mine ? [event.id] : [])));
            if (added.length > (events.some((event) => event.type === 'TrumpCalled') ? 2 : 0)) return null;
            if (removed.length > 1 || removed.some((id) => !played.has(id))) return null;
        }
        if (!prev.handComplete && next.handComplete) {
            events.push({ type: 'HandCompleted', delta: prev.playing ? { a: next.scores.a - prev.scores.a, b: next.scores.b - prev.scores.b } : null });
        }
    }

    next.seats.forEach((seat, i) => {
        if (seat.bela && !prev.seats[i].bela) events.push({ type: 'Bela', playerId: seat.id });
    });
    if (events.length === 0 && !scoresChanged && prev.phase === next.phase) {
        next.seats.forEach((seat, i) => {
            if (seat.challengeUsed && !prev.seats[i].challengeUsed) events.push({ type: 'ChallengeFailed', playerId: seat.id, mine: seat.isMe });
        });
    }
    if (scoresChanged) events.push({ type: 'Scored', from: prev.scores, to: next.scores });
    if ((prev.turn?.playerId ?? null) !== (next.turn?.playerId ?? null)) events.push({ type: 'Turn', playerId: next.turn?.playerId ?? null });
    if (next.finished) events.push({ type: 'Ended', phase: next.phase === 'COMPLETED' ? 'COMPLETED' : 'CANCELLED' });
    return events;
}
