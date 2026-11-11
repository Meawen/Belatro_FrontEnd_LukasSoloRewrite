import type { SeatModel, SeatPosition } from './model/boardModel';
import { boundsOf, fanPlaces, handPlaces, hudBoxes, tableTargets, trickSlots, yourTurnBox, type Layout, type Rect } from './model/cardTargets';
import { seatBoxes, seatSpot } from './seatSpot';

/**
 * Where Škola bele's panel sits on the board (open beta §7.2, §7.3), in board coordinates: its top-left corner, its
 * width, and the most it grows down (its lesson scrolls past that).
 */
export interface CoachSpot {
    left: number;
    top: number;
    width: number;
    maxHeight: number;
    /** The seat whose tag column and backs it covers where the board has no free room for a lesson; else null. */
    covers: 'partner' | 'right' | null;
}

interface Box {
    x0: number;
    x1: number;
    y0: number;
    y1: number;
    /** The seat it belongs to, if any. */
    of?: SeatPosition;
}

/** The board's edge margin and the gap kept to everything (board-fit's 8 and 6: seatSpot EDGE/CLEAR). */
const EDGE = 8;
const CLEAR = 6;
/**
 * The panel at most 420 wide (as before board-fit); a room narrower than 220 holds too few words a line, and one under 72
 * tall not even the title row with Exit and the do line (LessonPanel). A room taller than 240 scores no better (the panel
 * only grows with its lesson), so of two tall rooms the higher wins and the panel stays put when bidding ends. Where no
 * room is that big, the biggest of at least 140 × 48 (the title row) will do.
 */
const MAX_W = 420;
const MIN_W = 220;
const MIN_H = 72;
const MAX_H = 240;
const RELAXED = { w: 140, h: 48 };
/** A room that holds a lesson's title, its do line and a few lines of it: what the panel keeps through the bidding. */
const ROOMY_H = 120;
/**
 * Where the board is (Board.tsx): in play (the trick's slots taken), bidding while someone else bids (no trick and no
 * bid panel: the felt's middle is free), or bidding on my turn with my bid panel up (BidPanel shows only then,
 * `model.canBid`). The panel moves when my bid panel comes and goes and when play opens, as the pre-fit CSS did.
 */
export type CoachAt = 'play' | 'bidding' | 'myBid';

/**
 * My bid panel (board.css `.board-bid`, BidPanel): centred at 44 % (46 % sideways, 36 % upright, where Pass has a row
 * of its own), 98 px tall (150 upright), 326–328 px wide with Pass beside the four 52-px suits (252 upright).
 */
export const BID = { portrait: { at: 0.36, w: 252, h: 152 }, landscape: { at: 0.46, w: 330, h: 100 }, wide: { at: 0.44, w: 330, h: 100 } };
/** My partner's row sideways wraps a busy column (a long name) onto a second line: the plate's 26 px and a 4-px gap. */
const SECOND_LINE = 30;

const boxOf = (r: Rect, of?: SeatPosition): Box => ({ x0: r.x, x1: r.x + r.w, y0: r.y, y1: r.y + r.h, of });

const hull = (boxes: Box[], of?: SeatPosition): Box => ({
    x0: Math.min(...boxes.map((b) => b.x0)), x1: Math.max(...boxes.map((b) => b.x1)),
    y0: Math.min(...boxes.map((b) => b.y0)), y1: Math.max(...boxes.map((b) => b.y1)), of,
});

/** A seat as tableTargets lays it out (seatSpot reads its position and whether it is mine). */
const seatAt = (position: SeatPosition): SeatModel => ({
    id: position, position, team: position === 'me' || position === 'partner' ? 'A' : 'B', isMe: position === 'me',
    bot: false, cardsLeft: 8, current: false, dealer: false, bid: null, bela: false, challengeUsed: false,
});

/**
 * What the panel leaves alone (board-fit spec G1, G2), from the layout alone, so it never moves during play:
 * - the HUD at its worst case (hudBoxes);
 * - every seat's column at its common size, each other seat's as wide as its maxWidth lets a long name run it (my
 *   partner's sideways a second line taller); its declared cards only once play opens;
 * - the three fans of eight backs, my full hand, "Your turn" over my hand where it shows;
 * - the trick's slots once play opens; while bidding none, and my bid panel while it is up.
 */
function obstacles(layout: Layout, at: CoachAt): Box[] {
    const bidding = at !== 'play';
    const targets = tableTargets(layout);
    const out: Box[] = hudBoxes(layout).map((r) => boxOf(r));
    // seatBoxes shows one team's declared cards: both in play; while bidding none (the side seats' are never in the way)
    for (const team of bidding ? (['theirs'] as const) : (['mine', 'theirs'] as const)) {
        for (const { id, box } of seatBoxes(layout, targets, team)) {
            const position = id as SeatPosition;
            let b = boxOf(box, position);
            if (position !== 'me') {
                const { left, maxWidth, transform } = seatSpot(seatAt(position), targets, layout);
                if (maxWidth !== undefined) b = transform ? { ...b, x0: Math.min(b.x0, left - maxWidth) } : { ...b, x1: Math.max(b.x1, left + maxWidth) };
                if (position === 'partner' && layout.kind === 'landscape') b = { ...b, y1: b.y1 + SECOND_LINE };
            }
            out.push(b);
        }
    }
    for (const position of ['partner', 'left', 'right'] as const) out.push(hull(fanPlaces(layout, position, 8).map((back) => boundsOf(back)), position));
    out.push(hull(handPlaces(layout, 8).map((card) => boundsOf(card))));
    if (layout.kind !== 'portrait') out.push(boxOf(yourTurnBox(layout)));
    if (at === 'myBid') {
        const bid = layout.kind === 'portrait' ? BID.portrait : layout.kind === 'landscape' ? BID.landscape : BID.wide;
        const { w: W, h: H } = layout.board;
        out.push({ x0: (W - bid.w) / 2, x1: (W + bid.w) / 2, y0: bid.at * H - bid.h / 2, y1: bid.at * H + bid.h / 2 });
    }
    if (!bidding) for (const slot of Object.values(trickSlots(layout))) out.push(boundsOf({ ...slot, rotate: 4.8 }));
    return out;
}

/**
 * The biggest room in `bounds` that keeps 6 px from every box, at least `minW` × `minH` (its width counted up to 420,
 * its height up to 240); the higher, then the further left, of equals. Null where there is none.
 */
function largest(bounds: Box, boxes: Box[], minW: number, minH: number): Box | null {
    const lefts = [bounds.x0, ...boxes.map((b) => b.x1 + CLEAR)].filter((x) => x >= bounds.x0 && x < bounds.x1);
    const rights = [bounds.x1, ...boxes.map((b) => b.x0 - CLEAR)].filter((x) => x > bounds.x0 && x <= bounds.x1);
    let best: Box | null = null;
    let score = 0;
    const consider = (room: Box) => {
        const w = room.x1 - room.x0;
        const h = room.y1 - room.y0;
        if (w < minW || h < minH || h <= 0) return;
        const s = Math.min(w, MAX_W) * Math.min(h, MAX_H);
        if (best === null || s > score || (s === score && (room.y0 < best.y0 || (room.y0 === best.y0 && room.x0 < best.x0)))) {
            best = room;
            score = s;
        }
    };
    for (const x0 of lefts) {
        for (const x1 of rights) {
            if (x1 - x0 < Math.max(minW, 1)) continue;
            // the boxes in these columns, by their top: the free runs between them
            const blocked = boxes
                .filter((b) => b.x0 - CLEAR < x1 && b.x1 + CLEAR > x0)
                .map((b) => [b.y0 - CLEAR, b.y1 + CLEAR] as const)
                .sort((a, b) => a[0] - b[0]);
            let y = bounds.y0;
            for (const [from, to] of [...blocked, [bounds.y1, Infinity] as const]) {
                if (from > y) consider({ x0, x1, y0: y, y1: Math.min(from, bounds.y1) });
                y = Math.max(y, to);
                if (y >= bounds.y1) break;
            }
        }
    }
    return best;
}

/**
 * Where the panel goes (board-fit spec G1, G2): the biggest free room on the board, from the layout and `at` alone, so it
 * moves only when the window does, when my bid panel comes and goes, and when play opens. On desktops and tablets that is
 * the felt's top-left corner, beside my partner's backs and over the left seat's column; upright at 375×812 in play the
 * band between my partner's column and the trick; while bidding upright the felt's middle, where the trick goes.
 *
 * Where no free room holds a lesson (at least 220 × 72), the panel takes one seat's place while a lesson shows, its tag
 * column and backs: in play upright my partner's, under the HUD and beside its Challenge column, down to 6 px over the
 * trick and the side seats' plates (Ruling 87); sideways the right seat's, from the top of its fan to over my hand, right
 * of the trick in play (Ruling 87) and, while bidding too (Ruling 89), right of my bid panel on my bid turn. Upright it
 * never covers a seat while bidding: 375×553 on my bid turn keeps its 252 × 57 and scrolls, as 667×323's 155 × 130 does
 * sideways (Ruling 89). Nothing covers the trick, my hand, the HUD or another seat.
 */
export function coachSpot(layout: Layout, at: CoachAt): CoachSpot {
    // while someone else bids, where my bid turn will put the panel if that place is roomy (desktops, tablets): so it doesn't
    // cross the felt when my bid panel comes; elsewhere the bigger room, and it moves when my bid panel comes
    if (at === 'bidding') {
        const mine = place(layout, 'myBid');
        if (mine.covers === null && mine.width >= MIN_W && mine.maxHeight >= ROOMY_H) return mine;
    }
    return place(layout, at);
}

function place(layout: Layout, at: CoachAt): CoachSpot {
    const { w: W, h: H } = layout.board;
    const all = obstacles(layout, at);
    const bounds = { x0: EDGE, x1: W - EDGE, y0: 0, y1: H - EDGE };
    const spot = (room: Box, covers: CoachSpot['covers']): CoachSpot =>
        ({ left: room.x0, top: room.y0, width: Math.min(room.x1 - room.x0, MAX_W), maxHeight: room.y1 - room.y0, covers });
    const seat = layout.kind === 'landscape' ? 'right' : 'partner';
    const rest = all.filter((b) => b.of !== seat);
    // sideways from the right seat's top (its fan's): under my partner's row, whatever it holds
    const area = seat === 'right' ? { ...bounds, y0: Math.min(...all.filter((b) => b.of === 'right').map((b) => b.y0)) } : bounds;
    // a seat may be covered in play (Ruling 87) and, sideways, while bidding too (Ruling 89)
    const mayCover = at === 'play' || layout.kind === 'landscape';
    const room = largest(bounds, all, MIN_W, MIN_H) ?? (mayCover ? largest(area, rest, MIN_W, MIN_H) : null)
        ?? largest(bounds, all, RELAXED.w, RELAXED.h) ?? (mayCover ? largest(area, rest, RELAXED.w, RELAXED.h) : null)
        // the biggest free room of any size before ever covering something (a window too small for the table: §7's known misses)
        ?? largest(bounds, all, 1, 1)
        ?? { x0: EDGE, x1: W - EDGE, y0: layout.hud + CLEAR, y1: layout.hud + CLEAR + RELAXED.h };
    const panel = { ...room, x1: room.x0 + Math.min(room.x1 - room.x0, MAX_W) };
    const covers = all.some((b) => b.of === seat && b.x0 < panel.x1 && panel.x0 < b.x1 && b.y0 < panel.y1 && panel.y0 < b.y1) ? seat : null;
    return spot(room, covers);
}
