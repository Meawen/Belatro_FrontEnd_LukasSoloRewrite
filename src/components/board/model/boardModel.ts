import { handOrder, type FrozenOrder } from './handOrder';
import { cardId, type CardId } from './rules';
import { completedTrick, displayedTrick, type SeatPosition, type Team, type TrickModel } from './trick';
import type { BoardState } from './accept';
import {
    PHASE_LABEL, SUIT_LABEL, cardLabel, declarationLines, endSentence, isBelaCard, rematchOffered, seatsFromMe, teamOf, trumpOf, zvanjaOf,
} from '../../game/gameView';
import type { Boja, GameBid, GameCard, GamePhase } from '../../../types/game';

export type { SeatPosition, Team, TrickModel, TrickPlayModel } from './trick';

/** The felt per trump (spec §5.7): the four aces are the seasons. */
export type Season = 'none' | 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASON: Record<Boja, Season> = { HERC: 'spring', KARA: 'summer', PIK: 'autumn', TREF: 'winter' };

const POSITIONS: readonly SeatPosition[] = ['me', 'right', 'partner', 'left'];

/**
 * A move sent and not yet confirmed (spec §5.3.5): it locks the hand (or the bid panel) until a state
 * newer than the one it was sent from is accepted, my turn passes, or the send is known lost.
 * `version`/`receivedAt` identify that state; a card stays `lifted` for 2 s, then drops back while
 * the lock holds.
 */
export type Pending =
    | { kind: 'card'; cardId: CardId; at: number; lifted: boolean; version: number | null; receivedAt: number }
    | { kind: 'bid'; at: number; version: number | null; receivedAt: number };

/** The board's input state: one move in flight, and the card the bela prompt asks about. */
export interface InputState {
    pending: Pending | null;
    belaCardId: CardId | null;
}

export const NO_INPUT: InputState = { pending: null, belaCardId: null };

/** What the board keeps between states besides the state itself. */
export interface BoardLocal {
    /** The hand's frozen suit-group order: the previous model's `order`. */
    order: FrozenOrder | null;
    /** Completed tricks counted this hand, the piles without tricksWonA/B; null when unknown (a snapshot). */
    counted: { a: number; b: number } | null;
    input: InputState;
}

export const EMPTY_LOCAL: BoardLocal = { order: null, counted: null, input: NO_INPUT };

export interface SeatModel {
    id: string;
    position: SeatPosition;
    team: Team | null;
    isMe: boolean;
    cardsLeft: number;
    /** The seat to act (`data-current`). */
    current: boolean;
    dealer: boolean;
    /** Its bid chip while bidding ('PASS' or the suit called); null once trump is called. */
    bid: 'PASS' | Boja | null;
    /** Bela declared this hand (a "Bela" chip). */
    bela: boolean;
    /** Its scored zvanja chips, e.g. "sequence 50 (Herc)". */
    zvanja: string[];
    /** Its challenge is spent this hand (challengeUsedByPlayer). */
    challengeUsed: boolean;
}

export interface HandCardModel {
    /** `data-card`, e.g. "HERC-AS". */
    id: CardId;
    card: GameCard;
    /** The accessible name, e.g. "As Herc" (cardLabel). */
    label: string;
    /** Spec §5.3.5: PLAYING, my turn, no move in flight. Illegal cards stay enabled (fouls, R-19). */
    enabled: boolean;
    /** Sent and waiting for the server: lifted with a gold ring for up to 2 s. */
    pending: boolean;
    /** The trump K or Q with the other in hand: a click opens the bela prompt (R-32). */
    bela: boolean;
}

export interface EndModel {
    /** "Match cancelled" for CANCELLED unless forfeited, else "Game over". */
    title: 'Game over' | 'Match cancelled';
    /** "Team A wins" (COMPLETED only). */
    winnerLine: string | null;
    /** endSentence: why it ended other than played out (`end-reason`). */
    reason: string | null;
    /** A declined ranked match: the page goes to /play with the notice. */
    declined: boolean;
    /** Play again is offered (R-45). */
    rematchOffered: boolean;
}

/** Everything the board shows, from one accepted state (spec §5.3.3). */
export interface BoardModel {
    gameId: string;
    me: string;
    /** The state's stateVersion (null from an older backend) and when it was accepted: what a pending move waits past. */
    version: number | null;
    receivedAt: number;
    /** I hold a seat; otherwise the page shows "This game isn't yours or has ended". */
    seated: boolean;
    myTeam: Team | null;
    phase: GamePhase;
    /** The phase in words (R-31), `game-phase`. */
    phaseLabel: string;
    bidding: boolean;
    playing: boolean;
    handComplete: boolean;
    finished: boolean;
    /** seatingOrder rotated to me: me (bottom), right, partner (top), left. Fixed per player id. */
    seats: SeatModel[];
    /** The server's seatingOrder ids (turn order, rotated after every trick and deal). */
    turnOrder: string[];
    /** My hand in handOrder, without any card shown in the trick or in lastTrick. */
    hand: HandCardModel[];
    /** handOrder's frozen order: keep it as `local.order` for the next state. */
    order: FrozenOrder | null;
    /** The trick on the table; null while bidding. */
    trick: TrickModel | null;
    /** The hand's last completed trick (§6.1), or null. */
    lastTrick: TrickModel | null;
    bids: GameBid[];
    trump: { suit: Boja; label: string; callerId: string | null } | null;
    season: Season;
    scores: { a: number; b: number };
    /** Tricks won this hand per team (`pile-a`/`pile-b`), counting a completed trick still on the table; null hides the piles. */
    piles: { a: number; b: number } | null;
    dealerId: string | null;
    /** Whose turn it is and when the server's timer fires; null when nobody's. */
    turn: { playerId: string; expiresAt: number | null } | null;
    /** The server's clock is Date.now() + skew (the acceptance rule's estimate; 0 without serverNow). */
    skew: number;
    /** `your-turn`: canBid or canPlay; never in HAND_COMPLETE. */
    yourTurn: boolean;
    canBid: boolean;
    canPlay: boolean;
    canChallenge: boolean;
    /** Three passes on record and my bid: the dealer must call (R-23). */
    dealerMustCall: boolean;
    /** The bid buttons: canBid and no bid in flight. */
    bidsEnabled: boolean;
    /** Pass: bidsEnabled and not dealerMustCall. */
    passEnabled: boolean;
    /** My challenge is spent this hand. */
    challengeUsed: boolean;
    /** The card the bela prompt asks about ("Play" / "Play + Bela"), while I can play it. */
    belaPrompt: HandCardModel | null;
    /** The post-hand challenge window, only in HAND_COMPLETE (stale otherwise); null until the server sets it. */
    window: { expiresAt: number } | null;
    /** The visually hidden "This hand" summary: `bid` lines, `declaration` lines, `your-team`. */
    summary: { bids: string[]; declarations: string[]; yourTeam: string | null };
    end: EndModel | null;
}

/** Seconds left on a server deadline, as the countdown shows them ("{n} s"); never below 0. */
export function secondsLeft(expiresAt: number, skew: number, now: number): number {
    return Math.max(0, Math.ceil((expiresAt - (now + skew)) / 1000));
}

/** The board for one accepted state (spec §5.3.3). Pure: `local` carries what spans states. */
export function boardModel(state: BoardState, me: string, local: BoardLocal): BoardModel {
    const view = state.publicView;
    const priv = state.privateView;
    const phase = view.gameState;
    const turnOrder = (view.seatingOrder ?? []).map((seat) => seat.id);
    const rotated = seatsFromMe(view.seatingOrder ?? [], me);
    const positions: Record<string, SeatPosition> = Object.fromEntries(rotated.map((seat, i) => [seat.id, POSITIONS[i]]));
    const seated = turnOrder.includes(me);
    const myTeam = teamOf(view, me);
    const trumpSuit = trumpOf(view);
    const bidding = phase === 'BIDDING';
    const playing = phase === 'PLAYING';
    const handComplete = phase === 'HAND_COMPLETE';
    const finished = phase === 'COMPLETED' || phase === 'CANCELLED';
    const yourTurnFlag = priv?.yourTurn === true;
    const canBid = bidding && yourTurnFlag;
    const canPlay = playing && yourTurnFlag;
    const bids = view.bids ?? [];
    const dealerMustCall = canBid && bids.filter((bid) => bid.action === 'PASS').length >= 3;
    const dealerId = view.dealerId ?? (bidding ? turnOrder[3] ?? null : null);
    const pending = local.input.pending;

    const trick = displayedTrick(view, positions);
    const lastTrick = completedTrick(view, positions);
    const onTable = new Set([...(trick?.plays ?? []), ...(lastTrick?.plays ?? [])].map((play) => play.id));
    const held = (priv?.hand ?? []).filter((card) => !onTable.has(cardId(card)));
    const sorted = priv ? handOrder(held, trumpSuit, local.order) : null;
    const hand: HandCardModel[] = (sorted?.cards ?? []).map((card) => {
        const id = cardId(card);
        return {
            id,
            card,
            label: cardLabel(card),
            enabled: canPlay && pending === null,
            pending: pending?.kind === 'card' && pending.cardId === id && pending.lifted,
            bela: isBelaCard(card, held, trumpSuit),
        };
    });

    const seats: SeatModel[] = rotated.map((seat, i) => {
        const bid = bidding ? bids.find((b) => b.playerId === seat.id) : undefined;
        return {
            id: seat.id,
            position: POSITIONS[i],
            team: teamOf(view, seat.id),
            isMe: seat.id === me,
            cardsLeft: seat.cardsLeft,
            current: seat.id === view.currentPlayerId,
            dealer: seat.id === dealerId,
            bid: bid ? (bid.action === 'CALL_TRUMP' && bid.selectedTrump ? bid.selectedTrump : 'PASS') : null,
            bela: view.belaDeclaredByPlayer?.[seat.id] === true,
            zvanja: zvanjaOf(view.declarations?.[seat.id]),
            challengeUsed: view.challengeUsedByPlayer?.[seat.id] === true || (seat.id === me && priv?.challengeUsed === true),
        };
    });

    const caller = [...bids].reverse().find((bid) => bid.action === 'CALL_TRUMP');
    const belaCard = canPlay && local.input.belaCardId ? hand.find((card) => card.id === local.input.belaCardId) ?? null : null;
    const bidsEnabled = canBid && pending?.kind !== 'bid';

    return {
        gameId: view.gameId,
        me,
        version: typeof view.stateVersion === 'number' ? view.stateVersion : null,
        receivedAt: state.receivedAt,
        seated,
        myTeam,
        phase,
        phaseLabel: PHASE_LABEL[phase] ?? phase,
        bidding,
        playing,
        handComplete,
        finished,
        seats,
        turnOrder,
        hand,
        order: sorted?.frozen ?? local.order,
        trick,
        lastTrick,
        bids,
        trump: trumpSuit ? { suit: trumpSuit, label: SUIT_LABEL[trumpSuit], callerId: caller?.playerId ?? null } : null,
        season: trumpSuit ? SEASON[trumpSuit] : 'none',
        scores: { a: view.teamAScore, b: view.teamBScore },
        piles: typeof view.tricksWonA === 'number' && typeof view.tricksWonB === 'number'
            ? { a: view.tricksWonA, b: view.tricksWonB }
            : local.counted,
        dealerId,
        turn: view.currentPlayerId ? { playerId: view.currentPlayerId, expiresAt: view.turnExpiresAt ?? null } : null,
        skew: state.skew,
        yourTurn: canBid || canPlay,
        canBid,
        canPlay,
        canChallenge: (playing || handComplete) && priv !== null && !priv.challengeUsed,
        dealerMustCall,
        bidsEnabled,
        passEnabled: bidsEnabled && !dealerMustCall,
        challengeUsed: priv?.challengeUsed === true,
        belaPrompt: belaCard,
        window: handComplete && view.challengeWindowExpiresAt != null ? { expiresAt: view.challengeWindowExpiresAt } : null,
        summary: {
            bids: bids.map((bid) => `${bid.playerId}: ${bid.action === 'CALL_TRUMP' && bid.selectedTrump ? SUIT_LABEL[bid.selectedTrump] : 'Pass'}`),
            declarations: declarationLines(view),
            yourTeam: myTeam ? `Your team: ${myTeam}` : null,
        },
        end: finished
            ? {
                title: phase === 'CANCELLED' && view.endReason !== 'FORFEIT' ? 'Match cancelled' : 'Game over',
                winnerLine: phase === 'COMPLETED' && view.winnerTeamId ? `Team ${view.winnerTeamId} wins` : null,
                reason: endSentence(view),
                declined: view.endReason === 'DECLINED',
                rematchOffered: rematchOffered(view),
            }
            : null,
    };
}
