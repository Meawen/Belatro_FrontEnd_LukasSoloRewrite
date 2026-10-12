import type { BoardModel, SeatModel } from './model/boardModel';
import type { Layout, Target, Targets } from './model/cardTargets';

/** A seat's place on the board: its plate's top-left corner (or, with `transform`, its top centre or top right). */
export interface SeatSpot {
    left: number;
    top: number;
    transform?: string;
    maxWidth?: number;
}

/**
 * Where a seat's chips sit (spec §5.6): under the partner's fan, under the side fans, mine above my pile; how wide
 * they may grow: the side seats each up to the board's middle, so a 20-character name never runs into the other.
 */
export function seatSpot(seat: SeatModel, targets: Targets, layout: Layout): SeatSpot {
    const anchor = targets.anchors[seat.id] ?? { x: 0, y: 0, rotate: 0 };
    if (seat.isMe) {
        const pile = targets.piles[seat.team ?? 'A'];
        const pileTop = pile.top + (pile.height * (1 - pile.scale)) / 2;
        const pileLeft = pile.left + (pile.width * (1 - pile.scale)) / 2;
        // over my pile: bottom-left on phones and desktops, beside the hand in landscape
        return { left: Math.max(12, pileLeft - 4), top: Math.max(layout.hud + 8, pileTop - 34) };
    }
    const backs = Object.entries(targets.cards).filter(([key]) => key.startsWith(`back:${seat.id}:`)).map(([, target]) => target);
    const across = (target: Target) => (seat.position === 'partner' ? target.height : target.width) * target.scale;
    if (seat.position === 'partner' && layout.kind === 'landscape') {
        // beside the fan: under it would cover the partner's trick card
        const right = backs.length ? Math.max(...backs.map((t) => t.left + t.width / 2 + (t.width * t.scale) / 2)) : anchor.x + 20;
        return { left: right + 8, top: anchor.y - 13, maxWidth: layout.board.w - right - 20 };
    }
    const bottom = backs.length ? Math.max(...backs.map((t) => t.top + t.height / 2 + across(t) / 2)) : anchor.y + 24;
    const middle = layout.board.w / 2;
    if (seat.position === 'partner') return { left: anchor.x, top: bottom + 6, transform: 'translateX(-50%)', maxWidth: layout.board.w - 32 };
    if (seat.position === 'left') {
        const left = Math.max(8, anchor.x - 24);
        return { left, top: bottom + 6, maxWidth: middle - left - 6 };
    }
    const right = Math.min(layout.board.w - 8, anchor.x + 24);
    return { left: right, top: bottom + 6, transform: 'translateX(-100%)', maxWidth: right - middle - 6 };
}

/** The seat column's plate height, its gap and the turn timer bar under the plate (board.css `.board-seat`). */
const PLATE = 26;
const GAP = 4;
const TIMER = 3;

/**
 * Where a seat's bubble sits in the declaration moment (gameplay rules §6): by its plate, aligned as the plate
 * is. Under the plate (and its timer bar, on the seat to act) for the others, where their chips go once play
 * opens; over mine, which sits low by my pile.
 */
export function bubbleSpot(seat: SeatModel, model: BoardModel, targets: Targets, layout: Layout): SeatSpot {
    const spot = seatSpot(seat, targets, layout);
    if (seat.isMe) return { ...spot, top: spot.top - GAP, transform: 'translateY(-100%)' };
    const timer = seat.current && model.turn?.playerId === seat.id && model.turn.expiresAt != null;
    return { ...spot, top: spot.top + PLATE + GAP + (timer ? TIMER + GAP : 0) };
}
