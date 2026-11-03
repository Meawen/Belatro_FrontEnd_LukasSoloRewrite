import type { BoardModel, SeatModel, SeatPosition } from './model/boardModel';
import { boundsOf, fanPlaces, fanStepOf, fullHandPile, handPlaces, hudBoxes, hudRightGroup, trickSlots, type Layout, type Rect, type Targets } from './model/cardTargets';

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
     * side, ending `offset` px left of the plate's left edge, `room` px wide at most; `rise` px above the plate's top where
     * the plate dropped under the HUD's right group (they stay on the fan's middle line, Ruling AB).
     */
    aside?: { offset: number; room: number; rise?: number };
    /** Mine, upright and on wide windows: how wide my declared cards over my plate may run (give-way 1 within it). */
    above?: number;
    /**
     * Mine, upright: my chips beside my plate start after it, but no nearer than `from` px from its left edge (past my
     * declared cards' room, so a line they wrap upwards never lands on those cards), and run `room` px at most.
     */
    beside?: { from: number; room: number };
    /**
     * Mine, on wide windows and in landscape: px from my plate's left edge to my declared cards', where the left seat's fan
     * reaches down beside them (Ruling X: no seat column on a card back); they then run `above` px from there.
     */
    cardsFrom?: number;
    /**
     * Mine in landscape: px my chips and declared cards over my plate rise above the usual 4-px gap where my Zvanja chip
     * comes first (Seats), so that a chip wider than my plate's room, overhanging on the line nearest the plate, stays off
     * my hand's cards (G1). After another chip it wraps up a line instead (board.css).
     */
    lift?: number;
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
 * My plate at its widest: "You", the dealer's D, the caller's badge, the Bela badge, the no-challenge badge and the
 * countdown, whose width it keeps when it isn't my turn (Seats, board.css): 158.94 px measured without the Bela badge,
 * about 179 with it (owner, 2026-11-03: Bela as a badge; was 160).
 */
const MY_PLATE = 180;
/**
 * On phones my plate's name reads "Your turn" on my turn (owner, 2026-11-03, option B): about 36 px wider than "You", so
 * at its widest about 215 px. My chips beside it start past that width, so they never shift as it widens.
 */
const MY_TURN_PLATE = 218;
/** The widest single chip a column holds: "Zvanja 100 + 20", 122.9 px in Chromium. */
const WIDE_CHIP = 124;
/**
 * The busy column at its biggest (Ruling AB; the dev board's busy=1, names=long): a long name's plate about 230 px (its
 * Bela and no-challenge badges on it), a "Zvanja 100 + 20" chip and six declared cards. Rare, so it never makes the cards
 * smaller (§3.2), but where it would wrap onto another seat it gives way.
 */
const BUSY = { plate: 230, declared: 6 };
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
    // on the fan's middle line, stopping 6 px before the HUD's right group in its rows; where that leaves no room for a
    // plate, the row drops to 6 px under the group (Ruling AB)
    const group = hudRightGroup(layout)!;
    const middle = (fan.y0 + fan.y1) / 2 - PLATE / 2;
    let top = middle;
    let maxWidth = W - fan.x1 - 20;
    if (top < group.y + group.h) {
        const before = group.x - CLEAR - left;
        if (before >= COLUMN_W) maxWidth = Math.min(maxWidth, before);
        else top = group.y + group.h + CLEAR;
    }
    // one row where the plate, a chip and the cards fit its width and stay 6 px off the trick slots, and where the busy
    // row, wrapping within it, keeps its cards 6 px off the slots and the right seat's column; else the cards aside (§3.2)
    const rowW = COLUMN_W + GAP + CHIP_W + GAP + declaredRow(layout);
    const rowH = Math.max(PLATE, layout.declared.h) + GAP + TIMER;
    if (rowW <= maxWidth && roomBefore(slotBoxes(layout), left, 'left', top, top + rowH + CLEAR) >= rowW && !busyRowMeets(layout, left, top, maxWidth)) return { left, top, maxWidth };
    // the cards aside stay on the fan's middle line, though the plate dropped: the HUD's right group is on the other side
    const side = aside(middle)!;
    return { left, top, maxWidth, aside: top > middle ? { ...side, rise: top - middle } : side };
}

/**
 * Whether my partner's busy row sideways (BUSY: a long name with its badges, the widest Zvanja chip, six cards), wrapping within
 * `maxWidth` from `left`, `top`, would bring its cards within 6 px of a trick slot or the right seat's column.
 */
function busyRowMeets(layout: Layout, left: number, top: number, maxWidth: number): boolean {
    const w = layout.declared.w;
    const items = [{ w: Math.min(BUSY.plate, maxWidth), h: PLATE }, { w: WIDE_CHIP, h: CHIP_ROW }, { w: w + (BUSY.declared - 1) * declaredStep(w, BUSY.declared, maxWidth), h: layout.declared.h }];
    let x = left;
    let y = top;
    let lineH = 0;
    let cards: Box | null = null;
    for (const item of items) {
        if (x > left && x + item.w > left + maxWidth) {
            x = left;
            y += lineH + GAP;
            lineH = 0;
        }
        cards = { x0: x - CLEAR, x1: x + item.w + CLEAR, y0: y - CLEAR, y1: y + item.h + CLEAR };
        x += item.w + GAP;
        lineH = Math.max(lineH, item.h);
    }
    const near = [...slotBoxes(layout), ...sideBoxes(layout, 'right')];
    return near.some((box) => cards!.x0 < box.x1 && box.x0 < cards!.x1 && cards!.y0 < box.y1 && box.y0 < cards!.y1);
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
 * - tablet, desktop: over my pile, or past the left seat's backs where its fan reaches down beside it (Rulings X, Y), my
 *   declared cards over it within `above`;
 * - landscape: at the bottom left, beside my hand, my chips and declared cards over the plate, up to my hand's first
 *   card and any trick slot beside them.
 * "My pile" is where it lies with my full hand (`fullHandPile`): the live pile in `_targets` drops as my hand shrinks,
 * and my plate must not follow it. `_targets` is not read; the callers keep passing it.
 */
export function seatSpot(seat: SeatModel, _targets: Targets, layout: Layout): SeatSpot {
    if (seat.position === 'partner' && !seat.isMe) return partnerSpot(layout);
    if (!seat.isMe) return sideSpot(layout, seat.position === 'left' ? 'left' : 'right');
    // over my pile as it lies with my full hand (not the live pile, which drops as my hand shrinks): my plate stays put
    const pile = fullHandPile(layout);
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
        // my chips from a fixed place: past my declared cards' room and past my plate at its widest on my turn
        const from = Math.max(room, MY_TURN_PLATE) + GAP;
        return { ...overPile, top, above: room, beside: { from, room: layout.board.w - 8 - (overPile.left + from) } };
    }
    const dh = layout.declared.h;
    if (layout.kind !== 'landscape') {
        // over my pile, unless the left seat's fan reaches down beside it: then my plate and its chips start 6 px past the
        // fan's backs, and so may my declared cards over the plate (Ruling X)
        const top = overPile.top;
        const rows: [number, number] = [top, top + PLATE_ROW + GAP + CHIP_ROW];
        const left = pastLeftFan(layout, overPile.left, MY_PLATE, ...rows);
        // moved past the fan, my plate and its chips stop 6 px before any trick slot in their rows and the board's middle,
        // as the side seats' plates do; the name ellipsizes first, the badges and the countdown stay whole (Ruling Y)
        const moved = left > overPile.left ? { maxWidth: Math.min(layout.board.w / 2 - CLEAR - left, slotRoom(layout, left, 'left', ...rows)) } : {};
        const from = pastLeftFan(layout, left, declaredRow(layout), top - GAP - dh, top - GAP);
        return { left, top, ...moved, above: above(from, top), ...(from > left ? { cardsFrom: from - left } : {}) };
    }
    const top = layout.board.h - 8 - PLATE_ROW;
    const rows: [number, number] = [top - GAP - (CHIP_ROW + GAP + dh), top + PLATE_ROW];
    const hand = handPlaces(layout, 8).map(boundsOf);
    const room = Math.min(layout.board.w / 2 - CLEAR - MY_EDGE, slotRoom(layout, MY_EDGE, 'left', ...rows), roomBefore(hand, MY_EDGE, 'left', ...rows));
    // the line of chips nearest my plate may hold a chip wider than `room`: it stays 6 px over my hand's cards it reaches
    const reach = MY_EDGE + Math.max(room, WIDE_CHIP);
    const handTop = Math.min(...hand.filter((card) => card.x0 < reach && card.x1 > MY_EDGE).map((card) => card.y0));
    const lift = Math.max(0, top - GAP - (handTop - CLEAR));
    const base = top - GAP - lift;
    // my declared cards over my chips: past the left seat's fan where it reaches down beside them (Ruling X; with a second
    // line of chips, as the busy column wraps, too), up to the board's middle, the trick slots and my hand in their rows
    const cards: [number, number] = [base - CHIP_ROW - GAP - dh, base - CHIP_ROW - GAP];
    const from = pastLeftFan(layout, MY_EDGE, declaredRow(layout), cards[0] - CHIP_ROW - GAP, cards[1]);
    const lifted = lift > 0 ? { lift } : {};
    if (from === MY_EDGE) return { left: MY_EDGE, top, maxWidth: room, ...lifted };
    const cardsRoom = Math.min(layout.board.w / 2 - CLEAR - from, slotRoom(layout, from, 'left', ...cards), roomBefore(hand, from, 'left', ...cards));
    return { left: MY_EDGE, top, maxWidth: room, cardsFrom: from - MY_EDGE, above: cardsRoom, ...lifted };
}

/**
 * Where a box of mine `w` px wide at `left`, in the rows `y0…y1`, starts clear of the left seat's backs (Ruling X): 6 px
 * past its fan of eight where the fan meets the box, else at `left`.
 */
function pastLeftFan(layout: Layout, left: number, w: number, y0: number, y1: number): number {
    let x1 = -Infinity;
    for (const back of fanPlaces(layout, 'left', 8).map(boundsOf)) {
        if (back.y0 < y1 && back.y1 > y0 && back.x0 < left + w && back.x1 + CLEAR > left) x1 = Math.max(x1, back.x1);
    }
    return x1 === -Infinity ? left : Math.max(left, x1 + CLEAR);
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
            const from = spot.left + (spot.cardsFrom ?? 0);
            if (layout.kind === 'landscape') {
                const base = spot.top - GAP - (spot.lift ?? 0);
                add(spot.left, spot.top, narrow, PLATE_ROW);
                if (!spot.cardsFrom) {
                    add(spot.left, base - (CHIP_ROW + cards), w, CHIP_ROW + cards);
                    continue;
                }
                // my chips over my plate; my declared cards over them, past the left seat's fan (Ruling X)
                add(spot.left, base - CHIP_ROW, narrow, CHIP_ROW);
                if (declared) add(from, base - CHIP_ROW - GAP - dh, declaredRow(layout, spot.above), dh);
                continue;
            }
            // upright my plate and my chips beside it as far as they may run (one row, bottom-aligned), else my chips under it
            if (layout.kind === 'portrait') add(spot.left, spot.top, layout.board.w - 8 - spot.left, PLATE_ROW);
            // on wide windows my plate and the chips under it; moved past the left fan, as wide as it may grow (Ruling Y)
            else add(spot.left, spot.top, spot.maxWidth === undefined ? narrow : Math.min(spot.maxWidth, MY_PLATE), PLATE_ROW + GAP + CHIP_ROW);
            if (declared) add(from, spot.top - GAP - dh, declaredRow(layout, spot.above), dh);
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
                add(spot.left - spot.aside.offset - aside, spot.top - (spot.aside.rise ?? 0), aside, dh);
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
