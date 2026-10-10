// Test helpers for the board's component tests (not shipped: only *.test.tsx files import this).
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from '../ui/Toast';
import { Board, type BoardProps } from './Board';
import type { BoardState } from './model/accept';
import type { GameActions } from '../../hooks/useGameViews';
import type { GameCard, PrivateGameView, PublicGameView } from '../../types/game';
import type { FanOut } from '../../test/fixtures/views/table';

export const seating = ['alice', 'bob', 'carol', 'dave'].map((id) => ({ id, cardsLeft: 6 }));

/** A public view as today's GameTable tests built it: carol's game, bidding, nothing played. */
export function view(overrides: Partial<PublicGameView> = {}): PublicGameView {
    return {
        gameId: 'g1',
        gameState: 'BIDDING',
        bids: [],
        currentTrick: { leadPlayerId: '_NO_LEAD_', trump: null, plays: {} },
        teamAScore: 0,
        teamBScore: 0,
        teamA: [seating[0], seating[2]],
        teamB: [seating[1], seating[3]],
        challengeUsedByPlayer: {},
        winnerTeamId: null,
        tieBreaker: false,
        seatingOrder: seating,
        declarations: {},
        belaDeclaredByPlayer: {},
        challengeWindowExpiresAt: null,
        currentPlayerId: null,
        turnExpiresAt: null,
        endReason: null,
        forfeitTeamId: null,
        ...overrides,
    };
}

export const myCards: GameCard[] = [
    { boja: 'HERC', rank: 'AS' },
    { boja: 'HERC', rank: 'SEDMICA' },
    { boja: 'KARA', rank: 'DESETKA' },
    { boja: 'PIK', rank: 'KRALJ' },
    { boja: 'TREF', rank: 'BABA' },
    { boja: 'TREF', rank: 'DECKO' },
];

export function privateFor(publicPart: PublicGameView, yourTurn: boolean, hand: GameCard[] = myCards, challengeUsed = false): PrivateGameView {
    return { publicPart, hand, yourTurn, challengeUsed };
}

let clock = 1;
/** An accepted state; each call is later than the last unless `receivedAt` says otherwise. */
export function stateOf(privateView: PrivateGameView, source: BoardState['source'] = 'live', receivedAt = clock++): BoardState {
    return { publicView: privateView.publicPart, privateView, receivedAt, skew: 0, source };
}

/** A fan-out of Phase 3's table as `me` accepts it. */
export function tableState(fanOut: FanOut, me = 'carol', source: BoardState['source'] = 'live'): BoardState {
    return { publicView: fanOut.private[me].publicPart, privateView: fanOut.private[me], receivedAt: fanOut.at, skew: 0, source };
}

/** The game's actions, each answering that the move went out. */
export function actions(): { [K in keyof GameActions]: ReturnType<typeof vi.fn> } & GameActions {
    return { bidTrump: vi.fn(() => true), passBid: vi.fn(() => true), play: vi.fn(() => true), challenge: vi.fn(() => true) };
}

/** Renders the board (in a router, with the toast layer) for `me`; rerender with a newer state. */
export function renderBoard(props: Partial<BoardProps> & { state: BoardState }) {
    const all: BoardProps = { me: 'carol', actions: actions(), error: null, isConnected: true, onLeave: vi.fn(), ...props };
    const ui = (p: BoardProps) => (
        <MemoryRouter>
            <Board {...p} />
            <Toaster />
        </MemoryRouter>
    );
    const result = render(ui(all));
    return {
        ...result,
        props: all,
        rerenderWith: (next: Partial<BoardProps>) => {
            Object.assign(all, next);
            result.rerender(ui({ ...all }));
        },
    };
}
