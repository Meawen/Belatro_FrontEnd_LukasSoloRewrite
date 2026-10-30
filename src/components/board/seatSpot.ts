import type { BoardModel, SeatModel, SeatPosition } from './model/boardModel';
import { boundsOf, fanPlaces, fanStepOf, handPlaces, hudBoxes, trickSlots, type Layout, type Rect, type Targets } from './model/cardTargets';

/** A seat's place on the board: its plate's top-left corner (or, with `transform`, its top right). */
export interface SeatSpot {
    left: number;
    top: number;
    transform?: string;
    maxWidth?: number;
    /** A side seat's: px from the plate's top to its chips and declared cards (board-fit spec §4). */
    under?: number;
    /**
     * My partner's in landscape where the row beside the fan has no room for them: the declared cards on the fan's left
     * side, ending `offset` px left of the plate's left edge, `room` px wide at most.
     */
    aside?: { offset: number; room: number };
    /** Mine, upright and on wide windows: how wide my declared cards over my plate may run (give-way 1 within it). */
    above?: number;
    /**
     * Mine, upright: my chips beside my plate start after it, but no nearer than `from` px from its left edge (past my
     * declared cards' room, so a line they wrap upwards never lands on those cards), and run `room` px at most.
     */
    beside?: { from: number; room: number };
}

/** The seat column (board.css `.board-seat`): the plate, its gap, and the turn timer bar under the plate. */
const PLATE = 26;
const GAP = 4;
const TIMER = 3;
const PLATE_ROW = PLATE + GAP + TIMER;
/** A row of chips: Chip.tsx's Tag is 20 px tall (`h-5`). */
const CHIP_ROW = 20;
/**
 * A seat column at its common size (board-fit spec §3.2): 132 px wide; in my partner's landscape row, one common chip
 * ("Zvanja 20": caption type, 12 px uppercase, and 6 px each side) about 86 px.
 */
const COLUMN_W = 132;
const CHIP_W = 86;
/**
 * Kept clear (board-fit spec §4): 6 px between a side fan and its column above, under or beside it, 8 px between my
 * partner's fan and what sits beside it, 6 px before a trick slot, a hand card, the HUD or the board's middle; my plate
 * 12 px in from the left edge and, in landscape, 8 px up from the bottom.
 */
const FAN_GAP = 6;
const BESIDE = 8;
const CLEAR = 6;
const MY_EDGE = 12;
/**
 * My plate at its widest: "You", the dealer's D, the caller's badge, the no-challenge badge and the countdown, whose
 * width it keeps when it isn't my turn (Seats, board.css): about 156 px.
 */
const MY_PLATE = 160;
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

const boxOf = (r: Rect): Box => ({ x0: r.x, x1: r.x + r.w, y0: r.y, y1: r.y + r.h });

/**
 * A seat's full fan of eight backs as drawn: from the layout alone, so its tag stays put as the backs go. Spaced at the
 * partner's step: on desktops the side fans step closer (cardTargets FAN_STEP), but their columns stay where a fan at
 * the partner's step would start them, as before.
 */
function fanBox(layout: Layout, position: SeatPosition): Box {
    const backs = fanPlaces(layout, position, 8, fanStepOf(layout, 'partner')).map(boundsOf);
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
 * the rows `y0…y1` before it comes within 6 px of one of `boxes`; Infinity where none is in those rows.
 */
function roomBefore(boxes: Box[], edge: number, side: 'left' | 'right', y0: number, y1: number): number {
    let room = Infinity;
    for (const box of boxes) {
        if (box.y0 >= y1 || box.y1 <= y0) continue;
        if (side === 'left' && box.x1 > edge) room = Math.min(room, box.x0 - CLEAR - edge);
        if (side === 'right' && box.x0 < edge) room = Math.min(room, edge - box.x1 - CLEAR);
    }
    return room;
}
const slotRoom = (layout: Layout, edge: number, side: 'left' | 'right', y0: number, y1: number) => roomBefore(slotBoxes(layout), edge, side, y0, y1);

/**
 * The step from one declared card's left edge to the next's (board-fit spec §3.2 give-way 1): 45 % of each under the
 * next; closer where `n` of them would run past `room` px, until only a 12-px corner of each shows.
 */
export function declaredStep(width: number, n: number, room: number | undefined): number {
    if (n <= 1) return 0;
    return Math.max(CORNER, Math.min(width * (1 - OVERLAP), ((room ?? Infinity) - width) / (n - 1)));
}

/** A common column's four declared cards in a row: 45 % under the next, closer where `room` is narrower. */
const declaredRow = (layout: Layout, room?: number) => layout.declared.w + (COMMON_DECLARED - 1) * declaredStep(layout.declared.w, COMMON_DECLARED, room);

/**
 * A common column's width: 132 px, or its four declared cards' row where that is wider; never past `maxWidth`, nor
 * under what it holds (a common chip; four cards at their 12-px corners).
 */
function columnWidth(layout: Layout, maxWidth: number | undefined, declared: boolean): number {
    const w = Math.min(maxWidth ?? Infinity, Math.max(COLUMN_W, declared ? declaredRow(layout) : 0));
    return Math.max(w, CHIP_W, declared ? declaredRow(layout, 0) : 0);
}

/**
 * A side seat (board-fit spec §4.1–§4.3), on its own side of the felt; the left column starts at its left edge, the
 * right one ends at its right edge (`translateX(-100%)`).
 * - Portrait phones: the plate and its timer bar above the fan, 6 px clear; the chips and declared cards (`under`)
 *   6 px under the fan and under the side trick slot, whichever reaches lower, at the board's edge.
 * - Landscape, tablet, desktop: the whole column beside the fan's inner side, 6 px clear, from the fan's top: the plate,
 *   then (`under`) the chips and declared cards, clear of the side slot.
 * Each may grow up to the board's middle; a long name also stops 6 px short of the trick slots in the column's rows,
 * though never under the common 132 px.
 */
function sideSpot(layout: Layout, position: 'left' | 'right'): SeatSpot & { maxWidth: number; under: number } {
    const W = layout.board.w;
    const fan = fanBox(layout, position);
    let edge: number;
    let top: number;
    let under: number;
    let rows: [number, number];
    if (layout.kind === 'portrait') {
        const slot = boundsOf({ ...trickSlots(layout)[position], rotate: 4.8 });
        const centre = (fan.x0 + fan.x1) / 2;
        edge = position === 'left' ? Math.max(8, centre - 24) : Math.min(W - 8, centre + 24);
        top = fan.y0 - FAN_GAP - PLATE_ROW;
        under = Math.max(fan.y1, slot.y1) + FAN_GAP - top;
        rows = [top, top + PLATE_ROW];
    } else {
        edge = position === 'left' ? fan.x1 + FAN_GAP : fan.x0 - FAN_GAP;
        top = fan.y0;
        under = PLATE_ROW + GAP;
        rows = [top, top + under + CHIP_ROW + GAP + layout.declared.h];
    }
    const middle = position === 'left' ? W / 2 - CLEAR - edge : edge - W / 2 - CLEAR;
    const maxWidth = Math.min(middle, Math.max(COLUMN_W, slotRoom(layout, edge, position, ...rows)));
    return position === 'left' ? { left: edge, top, under, maxWidth } : { left: edge, top, under, transform: 'translateX(-100%)', maxWidth };
}

/** The common column's height with its declared cards: the plate row, a chip row, the cards. */
const fullColumn = (layout: Layout) => PLATE_ROW + GAP + CHIP_ROW + GAP + layout.declared.h;

/**
 * My partner (board-fit spec §4): the plate beside the fan's right edge, 8 px clear.
 * - Portrait: its top at the fan's top, its chips and declared cards under it in that column, as wide as the board
 *   leaves.
 * - Tablet, desktop: the column from 8 px under the HUD, stopping 6 px before the right seat's column where they share
 *   rows (its declared cards overlap more there); where not even their 12-px corners fit, the cards go aside as below.
 * - Landscape: the plate on the fan's middle line, its chips and declared cards on its row; where the row lacks room
 *   for the plate, a chip and four cards, the cards go on the fan's left side (`aside`), clear of the HUD.
 */
function partnerSpot(layout: Layout): SeatSpot {
    const W = layout.board.w;
    const fan = fanBox(layout, 'partner');
    const left = fan.x1 + BESIDE;
    if (layout.kind === 'portrait') return { left, top: fan.y0, maxWidth: W - 8 - left };
    // the cards on the fan's left side, ending 8 px before it, clear of the HUD, the trick and the left seat's column
    const aside = (top: number): SeatSpot['aside'] => {
        const end = fan.x0 - BESIDE;
        const room = roomBefore([...hudBoxes(layout).map(boxOf), ...slotBoxes(layout), ...sideBoxes(layout, 'left')], end, 'right', top, top + layout.declared.h);
        return { offset: left - end, room: Math.min(end - 8, room) };
    };
    if (layout.kind !== 'landscape') {
        const top = layout.hud + 8;
        const theirs = sideBoxes(layout, 'right');
        const room = (rows: number) => Math.min(W - 8 - left, roomBefore(theirs, left, 'left', top, top + rows));
        if (room(fullColumn(layout)) >= declaredRow(layout, 0)) return { left, top, maxWidth: room(fullColumn(layout)) };
        // not even at their 12-px corners: the cards go aside, as in landscape
        return { left, top, maxWidth: room(PLATE_ROW + GAP + CHIP_ROW), aside: aside(top) };
    }
    const top = (fan.y0 + fan.y1) / 2 - PLATE / 2;
    const maxWidth = W - fan.x1 - 20;
    if (COLUMN_W + GAP + CHIP_W + GAP + declaredRow(layout) <= maxWidth) return { left, top, maxWidth };
    return { left, top, maxWidth, aside: aside(top) };
}

/** A side seat's common column as boxes, at its widest (with its declared cards): the plate row, then the chips and cards. */
function sideBoxes(layout: Layout, position: 'left' | 'right'): Box[] {
    const spot = sideSpot(layout, position);
    const part = (w: number, y0: number, h: number): Box => (position === 'right' ? { x0: spot.left - w, x1: spot.left, y0, y1: y0 + h } : { x0: spot.left, x1: spot.left + w, y0, y1: y0 + h });
    return [
        part(columnWidth(layout, spot.maxWidth, false), spot.top, PLATE_ROW),
        part(columnWidth(layout, spot.maxWidth, true), spot.top + spot.under, CHIP_ROW + GAP + layout.declared.h),
    ];
}

/**
 * Where a seat's tag and chips sit (spec §5.6, board-fit spec §4), from the layout alone (its full fans and hand), so
 * they never move during play: my partner, see partnerSpot; the side seats, see sideSpot; me:
 * - portrait: over my pile, and under the side seats' columns at their common size, but never onto my hand; my chips
 *   beside my plate, after it and past my declared cards' room, wrapping upwards within `beside` (never down onto my
 *   hand, never onto my cards); my declared cards over it within `above`;
 * - tablet, desktop: over my pile, as today, my declared cards over it within `above`;
 * - landscape: at the bottom left, beside my hand, my chips and declared cards over the plate, up to my hand's first
 *   card and any trick slot beside them.
 */
export function seatSpot(seat: SeatModel, targets: Targets, layout: Layout): SeatSpot {
    if (seat.position === 'partner' && !seat.isMe) return partnerSpot(layout);
    if (!seat.isMe) return sideSpot(layout, seat.position === 'left' ? 'left' : 'right');
    const pile = targets.piles[seat.team ?? 'A'];
    const pileTop = pile.top + (pile.height * (1 - pile.scale)) / 2;
    const pileLeft = pile.left + (pile.width * (1 - pile.scale)) / 2;
    const overPile = { left: Math.max(MY_EDGE, pileLeft - 4), top: Math.max(layout.hud + 8, pileTop - 34) };
    // my declared cards over my plate: up to the board's middle and 6 px before any trick slot beside them
    const above = (left: number, top: number) =>
        Math.min(layout.board.w / 2 - CLEAR - left, slotRoom(layout, left, 'left', top - GAP - layout.declared.h, top));
    if (layout.kind === 'portrait') {
        // under the side seats' columns at their common size (a chip line and four cards, or a chip line and my four cards
        // over my plate), but never down onto my hand: G1 before G2
        const leftSeat = sideSpot(layout, 'left');
        const clear = leftSeat.top + leftSeat.under + CHIP_ROW + GAP + layout.declared.h + GAP;
        const hand = Math.min(...handPlaces(layout, 8).map((card) => boundsOf(card).y0)) - CLEAR - PLATE_ROW;
        const top = Math.max(overPile.top, Math.min(clear, hand));
        const room = above(overPile.left, top);
        return { ...overPile, top, above: room, beside: { from: room + GAP, room: layout.board.w - 8 - (overPile.left + Math.max(MY_PLATE, room) + GAP) } };
    }
    if (layout.kind !== 'landscape') return { ...overPile, above: above(overPile.left, overPile.top) };
    const top = layout.board.h - 8 - PLATE_ROW;
    const rows: [number, number] = [top - GAP - (CHIP_ROW + GAP + layout.declared.h), top + PLATE_ROW];
    const hand = handPlaces(layout, 8).map(boundsOf);
    const room = Math.min(layout.board.w / 2 - CLEAR - MY_EDGE, slotRoom(layout, MY_EDGE, 'left', ...rows), roomBefore(hand, MY_EDGE, 'left', ...rows));
    return { left: MY_EDGE, top, maxWidth: room };
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
 * the seat's maxWidth, never under a common chip), and up to four declared cards at 45 % overlap for the seats of
 * `declaredTeam` only (the winners: never both teams at once). A box holding only declared cards is as wide as their
 * row. A seat may have two boxes: a side seat's plate and its chips and cards; my plate and what sits over it; my
 * partner's row and its cards on the fan's other side.
 */
export function seatBoxes(layout: Layout, targets: Targets, declaredTeam: 'mine' | 'theirs'): { id: string; box: Rect }[] {
    const boxes: { id: string; box: Rect }[] = [];
    const dh = layout.declared.h;
    for (const position of ['me', 'right', 'partner', 'left'] as const) {
        const seat = tableSeat(position);
        const spot = seatSpot(seat, targets, layout);
        const declared = (declaredTeam === 'mine') === (position === 'me' || position === 'partner');
        const cards = declared ? GAP + dh : 0;
        // a box with chips and declared cards is as wide as the wider; one with the cards alone as their row
        const w = columnWidth(layout, spot.maxWidth, declared);
        const narrow = columnWidth(layout, spot.maxWidth, false);
        const add = (x: number, y: number, width: number, h: number) => boxes.push({ id: seat.id, box: { x, y, w: width, h } });
        if (position === 'me') {
            if (layout.kind === 'landscape') {
                add(spot.left, spot.top, narrow, PLATE_ROW);
                add(spot.left, spot.top - GAP - (CHIP_ROW + cards), w, CHIP_ROW + cards);
                continue;
            }
            // upright my plate and my chips beside it as far as they may run (one row, bottom-aligned), else my chips under it
            if (layout.kind === 'portrait') add(spot.left, spot.top, layout.board.w - 8 - spot.left, PLATE_ROW);
            else add(spot.left, spot.top, narrow, PLATE_ROW + GAP + CHIP_ROW);
            if (declared) add(spot.left, spot.top - GAP - dh, declaredRow(layout, spot.above), dh);
        } else if (position === 'partner') {
            const here = declared && !spot.aside;
            if (layout.kind === 'landscape') {
                // one row: the plate, a chip, the declared cards unless they sit aside, wrapping within the row; the timer bar under it
                const room = spot.maxWidth ?? Infinity;
                const items = [{ w: COLUMN_W, h: PLATE }, { w: CHIP_W, h: CHIP_ROW }];
                if (here) items.push({ w: declaredRow(layout), h: dh });
                const rows = wrap(items.map((item) => ({ ...item, w: Math.min(room, item.w) })), room);
                add(spot.left, spot.top, Math.max(...rows.map((one) => one.w)), rows.reduce((sum, one) => sum + one.h + GAP, 0) + TIMER);
            } else {
                add(spot.left, spot.top, here ? w : narrow, PLATE_ROW + GAP + CHIP_ROW + (here ? cards : 0));
            }
            if (declared && spot.aside) {
                const aside = declaredRow(layout, spot.aside.room);
                add(spot.left - spot.aside.offset - aside, spot.top, aside, dh);
            }
        } else {
            const x = (width: number) => (position === 'right' ? spot.left - width : spot.left);
            add(x(narrow), spot.top, narrow, PLATE_ROW);
            add(x(w), spot.top + (spot.under ?? 0), w, CHIP_ROW + cards);
        }
    }
    return boxes;
}

/**
 * Where a seat's bubble sits in the declaration moment (gameplay rules §6): by its plate, aligned as the plate
 * is. Where its chips go once play opens for the others: under my partner's plate (and its timer bar, on the seat to
 * act), in a side seat's column (`under`); over mine, which sits low by my pile.
 */
export function bubbleSpot(seat: SeatModel, model: BoardModel, targets: Targets, layout: Layout): SeatSpot {
    const { left, top, transform, maxWidth, under } = seatSpot(seat, targets, layout);
    const plate = { left, top, transform, maxWidth };
    if (seat.isMe) return { ...plate, top: top - GAP, transform: 'translateY(-100%)' };
    if (under !== undefined) return { ...plate, top: top + under };
    const timer = seat.current && model.turn?.playerId === seat.id && model.turn.expiresAt != null;
    return { ...plate, top: top + PLATE + GAP + (timer ? TIMER + GAP : 0) };
}
