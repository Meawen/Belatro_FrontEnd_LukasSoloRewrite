import type { BoardModel, SeatModel, SeatPosition } from './model/boardModel';
import { boundsOf, fanPlaces, trickSlots, type Layout, type Rect, type Targets } from './model/cardTargets';

/** A seat's place on the board: its plate's top-left corner (or, with `transform`, its top right). */
export interface SeatSpot {
    left: number;
    top: number;
    transform?: string;
    maxWidth?: number;
    /** A side seat's: px from the plate's top to its chips and declared cards, under its fan (board-fit spec §4). */
    under?: number;
}

/** The seat column (board.css `.board-seat`): the plate, its gap, and the turn timer bar under the plate. */
const PLATE = 26;
const GAP = 4;
const TIMER = 3;
/** A row of chips: Chip.tsx's Tag is 20 px tall (`h-5`). */
const CHIP_ROW = 20;
/**
 * A seat column at its common size (board-fit spec §3.2): 132 px wide; in my partner's landscape row, one common chip
 * ("Zvanja 20": caption type, 12 px uppercase, and 6 px each side) about 86 px.
 */
const COLUMN_W = 132;
const CHIP_W = 86;
/**
 * Kept clear (board-fit spec §4): 6 px between a side fan and its plate above it or its chips under it, 8 px between my
 * partner's fan and the plate beside it, 6 px before a trick slot or the board's middle.
 */
const FAN_GAP = 6;
const BESIDE = 8;
const CLEAR = 6;
/** Declared cards: 45 % under the next, closer in a narrow column down to a 12-px corner; a common column shows four. */
const OVERLAP = 0.45;
const CORNER = 12;
const COMMON_DECLARED = 4;

interface Box {
    x0: number;
    x1: number;
    y0: number;
    y1: number;
}

/** A seat's full fan of eight backs as drawn: from the layout alone, so its tag stays put as the backs go. */
function fanBox(layout: Layout, position: SeatPosition): Box {
    const backs = fanPlaces(layout, position, 8).map(boundsOf);
    return {
        x0: Math.min(...backs.map((b) => b.x0)), x1: Math.max(...backs.map((b) => b.x1)),
        y0: Math.min(...backs.map((b) => b.y0)), y1: Math.max(...backs.map((b) => b.y1)),
    };
}

/** The trick slots at the widest a stable tilt makes them (tilt(): −4.8…+4.8°). */
function slotBoxes(layout: Layout): Box[] {
    return Object.values(trickSlots(layout)).map((slot) => boundsOf({ ...slot, rotate: 4.8 }));
}

/**
 * How far a column at `edge` may run towards the middle (rightwards from a left edge, leftwards from a right one) in
 * the rows `y0…y1` before it comes within 6 px of a trick slot; Infinity where no slot is in those rows.
 */
function slotRoom(layout: Layout, edge: number, side: 'left' | 'right', y0: number, y1: number): number {
    let room = Infinity;
    for (const slot of slotBoxes(layout)) {
        if (slot.y0 >= y1 || slot.y1 <= y0) continue;
        if (side === 'left' && slot.x1 > edge) room = Math.min(room, slot.x0 - CLEAR - edge);
        if (side === 'right' && slot.x0 < edge) room = Math.min(room, edge - slot.x1 - CLEAR);
    }
    return room;
}

/**
 * The step from one declared card's left edge to the next's (board-fit spec §3.2 give-way 1): 45 % of each under the
 * next; closer where `n` of them would run past `room` px, until only a 12-px corner of each shows.
 */
export function declaredStep(width: number, n: number, room: number | undefined): number {
    if (n <= 1) return 0;
    return Math.max(CORNER, Math.min(width * (1 - OVERLAP), ((room ?? Infinity) - width) / (n - 1)));
}

/** A common column's four declared cards in a row, 45 % under the next. */
const declaredRow = (layout: Layout) => layout.declared.w * (1 + (COMMON_DECLARED - 1) * (1 - OVERLAP));

/** A common column's width: 132 px, or its four declared cards' row where that is wider; never past `maxWidth`. */
function columnWidth(layout: Layout, maxWidth: number | undefined, declared: boolean): number {
    return Math.min(maxWidth ?? Infinity, Math.max(COLUMN_W, declared ? declaredRow(layout) : 0));
}

/**
 * A side seat (board-fit spec §4.1–§4.3, every layout): the plate above its fan, 6 px clear; the chips and declared
 * cards under the fan (`under`), on the seat's own edge. The left column starts at the left edge, the right one ends at
 * the right edge (`translateX(-100%)`). Each may grow up to the board's middle; a long name also stops short of the trick
 * slots its plate's row meets, though never under the common 132 px.
 */
function sideSpot(layout: Layout, position: 'left' | 'right'): SeatSpot & { maxWidth: number; under: number } {
    const W = layout.board.w;
    const fan = fanBox(layout, position);
    const centre = (fan.x0 + fan.x1) / 2;
    const top = fan.y0 - FAN_GAP - PLATE;
    const under = fan.y1 + FAN_GAP - top;
    const plateBottom = top + PLATE + GAP + TIMER;
    if (position === 'left') {
        const left = Math.max(8, centre - 24);
        return { left, top, under, maxWidth: Math.min(W / 2 - CLEAR - left, Math.max(COLUMN_W, slotRoom(layout, left, 'left', top, plateBottom))) };
    }
    const right = Math.min(W - 8, centre + 24);
    return { left: right, top, under, transform: 'translateX(-100%)', maxWidth: Math.min(right - W / 2 - CLEAR, Math.max(COLUMN_W, slotRoom(layout, right, 'right', top, plateBottom))) };
}

/**
 * Where a seat's tag and chips sit (spec §5.6, board-fit spec §4), from the layout's full fans so they never move
 * during play:
 * - my partner: the plate beside the fan's right edge, its top at the fan's top, its chips and declared cards under the
 *   plate in that column; in landscape the plate on the fan's middle line, its chips and cards on the plate's row;
 * - the side seats: see sideSpot;
 * - me: over my pile; in landscape, where my pile is beside my hand, also right of the left seat's column, so that
 *   column never reaches my plate, my chips and declared cards over the plate (Seats) up to the trick slot beside them.
 */
export function seatSpot(seat: SeatModel, targets: Targets, layout: Layout): SeatSpot {
    const W = layout.board.w;
    if (seat.isMe) {
        const pile = targets.piles[seat.team ?? 'A'];
        const pileTop = pile.top + (pile.height * (1 - pile.scale)) / 2;
        const pileLeft = pile.left + (pile.width * (1 - pile.scale)) / 2;
        const top = Math.max(layout.hud + 8, pileTop - 34);
        if (layout.kind !== 'landscape') return { left: Math.max(12, pileLeft - 4), top };
        const leftSeat = sideSpot(layout, 'left');
        const left = Math.max(pileLeft - 4, leftSeat.left + columnWidth(layout, leftSeat.maxWidth, true) + GAP);
        const above = CHIP_ROW + GAP + layout.declared.h + GAP;
        return { left, top, maxWidth: Math.min(W / 2 - CLEAR - left, slotRoom(layout, left, 'left', top - above, top + PLATE + GAP + TIMER)) };
    }
    if (seat.position === 'partner') {
        const fan = fanBox(layout, 'partner');
        const left = fan.x1 + BESIDE;
        if (layout.kind === 'landscape') return { left, top: (fan.y0 + fan.y1) / 2 - PLATE / 2, maxWidth: W - fan.x1 - 20 };
        return { left, top: fan.y0, maxWidth: W - 8 - left };
    }
    return sideSpot(layout, seat.position === 'left' ? 'left' : 'right');
}

/** tableTargets' seats: each seat's id is its position, my team A. */
function tableSeat(position: SeatPosition): SeatModel {
    return {
        id: position, position, team: position === 'me' || position === 'partner' ? 'A' : 'B', isMe: position === 'me',
        bot: false, cardsLeft: 8, current: false, dealer: false, bid: null, bela: false, challengeUsed: false,
    };
}

/** Lays items out in rows `room` wide, `GAP` apart: each row's width and height. */
function wrap(items: { w: number; h: number }[], room: number): { w: number; h: number }[] {
    const rows: { w: number; h: number }[] = [];
    for (const item of items) {
        const row = rows[rows.length - 1];
        if (row && row.w + GAP + item.w <= room) {
            row.w += GAP + item.w;
            row.h = Math.max(row.h, item.h);
        } else {
            rows.push({ ...item });
        }
    }
    return rows;
}

/**
 * The estimated boxes of each seat's common column (board-fit spec §3.2), for `tableTargets` (seat ids are the
 * positions): the plate 26 tall with its timer bar (4 + 3), one row of chips 20 tall, 4-px gaps, 132 wide (capped by
 * the seat's maxWidth), and up to four declared cards at 45 % overlap for the seats of `declaredTeam` only (the
 * winners: never both teams at once). A seat may have two boxes: a side seat's plate above its fan and its chips under
 * it; my plate and what sits over it.
 */
export function seatBoxes(layout: Layout, targets: Targets, declaredTeam: 'mine' | 'theirs'): { id: string; box: Rect }[] {
    const boxes: { id: string; box: Rect }[] = [];
    const landscape = layout.kind === 'landscape';
    const plate = PLATE + GAP + TIMER;
    for (const position of ['me', 'right', 'partner', 'left'] as const) {
        const seat = tableSeat(position);
        const spot = seatSpot(seat, targets, layout);
        const declared = (declaredTeam === 'mine') === (position === 'me' || position === 'partner');
        const cards = declared ? GAP + layout.declared.h : 0;
        // a box with the declared cards in it is as wide as their row, the others as the plate and the chips
        const w = columnWidth(layout, spot.maxWidth, declared);
        const narrow = columnWidth(layout, spot.maxWidth, false);
        const add = (x: number, y: number, width: number, h: number) => boxes.push({ id: seat.id, box: { x, y, w: width, h } });
        if (position === 'me') {
            if (landscape) {
                const above = CHIP_ROW + cards;
                add(spot.left, spot.top, narrow, plate);
                add(spot.left, spot.top - GAP - above, w, above);
            } else {
                add(spot.left, spot.top, narrow, plate + GAP + CHIP_ROW);
                if (declared) add(spot.left, spot.top - cards, w, cards - GAP);
            }
        } else if (position === 'partner' && landscape) {
            // one row: the plate, a chip, the declared cards, wrapping within the row's width; the timer bar under it
            const room = spot.maxWidth ?? Infinity;
            const items = [{ w: COLUMN_W, h: PLATE }, { w: CHIP_W, h: CHIP_ROW }];
            if (declared) items.push({ w: declaredRow(layout), h: layout.declared.h });
            const rows = wrap(items.map((item) => ({ ...item, w: Math.min(room, item.w) })), room);
            add(spot.left, spot.top, Math.max(...rows.map((row) => row.w)), rows.reduce((sum, row) => sum + row.h + GAP, 0) + TIMER);
        } else if (position === 'partner') {
            add(spot.left, spot.top, w, plate + GAP + CHIP_ROW + cards);
        } else {
            const x = (width: number) => (position === 'right' ? spot.left - width : spot.left);
            add(x(narrow), spot.top, narrow, plate);
            add(x(w), spot.top + (spot.under ?? 0), w, CHIP_ROW + cards);
        }
    }
    return boxes;
}

/**
 * Where a seat's bubble sits in the declaration moment (gameplay rules §6): by its plate, aligned as the plate
 * is. Where its chips go once play opens for the others: under my partner's plate (and its timer bar, on the seat to
 * act), under a side seat's fan; over mine, which sits low by my pile.
 */
export function bubbleSpot(seat: SeatModel, model: BoardModel, targets: Targets, layout: Layout): SeatSpot {
    const { under, ...spot } = seatSpot(seat, targets, layout);
    if (seat.isMe) return { ...spot, top: spot.top - GAP, transform: 'translateY(-100%)' };
    if (under !== undefined) return { ...spot, top: spot.top + under };
    const timer = seat.current && model.turn?.playerId === seat.id && model.turn.expiresAt != null;
    return { ...spot, top: spot.top + PLATE + GAP + (timer ? TIMER + GAP : 0) };
}
