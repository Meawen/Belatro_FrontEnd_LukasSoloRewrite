import { ART_W } from '../../ui/cardWidth';
import { seatBoxes } from '../seatSpot';
import {
    bandBottom, boundsOf, cardSize, fanPlaces, hudBoxes, layoutAt, tableTargets, type Layout, type LayoutKind, type Rect, type Target, type Viewport,
} from './cardTargets';
import { desktopCandidates, floorPair, phoneCandidates } from './sizes';

/** A box by its edges, in board coordinates. */
export type Box = ReturnType<typeof boundsOf>;

const POSITIONS = ['me', 'right', 'partner', 'left'] as const;
const OPPONENTS = ['right', 'partner', 'left'] as const;
const TEAMS = ['mine', 'theirs'] as const;
/** A trick card's widest stable tilt (cardTargets' tilt(): −4.8…+4.8°). */
const TILT = 4.8;
/**
 * The least of each hand card the next one leaves uncovered (redesign spec §5.6.3, board-fit spec §3.5): on phones
 * 0.36 of the card's width but never under 32 px; on tablets and desktops 40 % (Ruling H).
 */
const STRIP = { phone: 0.36, phoneMin: 32, wide: 0.4 };
/** "Your turn" over my hand (Board.tsx `YourTurn`, board.css `.board-your-turn`): about 120 × 26, its top 40 px over my hand's. */
const YOUR_TURN = { w: 120, h: 26, above: 40 };
/**
 * A fine pointer's hover lift on an enabled hand card (board.css `.board-card__lift`, §5.6.5): −24 px in the card's own
 * turn and ×1.08 about its centre. Fine pointers come with tablets' and desktops' windows (Ruling H).
 */
const HOVER = { lift: 24, scale: 1.08 };
const liftsOnHover = (layout: Layout) => layout.kind === 'desktop' || layout.kind === 'tablet';
/** Floating point: a box this far past an edge still counts as on it. */
const SLACK = 1e-9;

/** Spec §5.6: landscape with height ≤ 500 when wider than tall; else desktop from 1024; tablet 768–1023; portrait below. */
export function kindOf({ width, height }: Viewport): LayoutKind {
    if (width > height && height <= 500) return 'landscape';
    if (width >= 1024) return 'desktop';
    return width >= 768 ? 'tablet' : 'portrait';
}

/**
 * The layout for a viewport (board-fit spec §3): the biggest crisp cards that `fits` the window, from the window only,
 * so they change only when the window does (resize, rotation, zoom).
 * - Portrait phones: the first of `phoneCandidates` that fits, the trick and the hand alike; else the step nearest 71.
 * - Landscape phones: always the step nearest 71 (§3.4).
 * - Tablets (the portrait arrangement, no Blok column) and desktops: the first of `desktopCandidates` that fits; else
 *   `floorPair` (§3.3's floor: the felt goes tight rather than the art shrinking further).
 */
export function layoutFor(viewport: Viewport): Layout {
    const kind = kindOf(viewport);
    const { dpr } = viewport;
    if (kind === 'landscape') {
        const card = cardSize(ART_W, dpr);
        return layoutAt(viewport, kind, card, card);
    }
    if (kind === 'portrait') {
        for (const card of phoneCandidates(dpr)) {
            const layout = layoutAt(viewport, kind, card, card);
            if (fits(layout)) return layout;
        }
        const floor = cardSize(ART_W, dpr);
        return layoutAt(viewport, kind, floor, floor);
    }
    for (const { trick, hand } of desktopCandidates(dpr)) {
        const layout = layoutAt(viewport, kind, trick, hand);
        if (fits(layout)) return layout;
    }
    const floor = floorPair(dpr);
    return layoutAt(viewport, kind, floor.trick, floor.hand);
}

/**
 * Whether the table fits at this layout's sizes (board-fit spec §2 G1 and G2, §3.2, §4; Rulings E, H, J, P, S), with my 8
 * hand cards and 8 backs at every other seat:
 * - every hand card leaves its strip (`STRIP`) and the hand stays within the board's width;
 * - the four trick slots, each at its widest tilt, lie inside the board below the HUD and above `bandBottom`, and meet
 *   none of my hand, the fans, the piles, the HUD's boxes or the seats' columns;
 * - "Your turn" meets none of the partner's or side slots (my own it may: Ruling E);
 * - where a fine pointer lifts a hovered hand card (tablet, desktop), the lifted card meets none of the partner's or
 *   side slots (my own it may: Ruling P, as Ruling E: the lift shows only on enabled cards, on my turn);
 * - the piles meet no fan of 7 backs (a pile draws nothing until a trick is taken, and by then a seat holds 7 at most);
 * - the seats' columns (`seatBoxes`, whichever team's declared cards show) meet none of the HUD's boxes, my hand's
 *   exposed strips, nor each other.
 * Not checked, by design (spec §5): the bid panel, the declaration moment's panel, the challenge banner, the Bela
 * prompt, the sheets and cards in flight.
 */
export function fits(layout: Layout): boolean {
    return walk(layout, null);
}

/** Every reason `fits` would give for rejecting the layout (all of them, not only the first): empty where it fits. */
export function misfits(layout: Layout): string[] {
    const found: string[] = [];
    walk(layout, found);
    return found;
}

/**
 * My full hand's exposed strips (board-fit spec G1, Ruling J): each card's part above the board's bottom edge that the
 * next card leaves uncovered (its left part, as far as the next card's left edge, in its own turn); the last card's
 * whole visible part.
 */
export function handStrips(layout: Layout, hand: Target[] = handOf(tableTargets(layout).cards)): Box[] {
    return hand.map((card, i) => {
        const w = i < hand.length - 1 ? hand[i + 1].left - card.left : card.width;
        const cx = card.left + card.width / 2;
        const cy = card.top + card.height / 2;
        const r = (card.rotate * Math.PI) / 180;
        const cos = Math.cos(r);
        const sin = Math.sin(r);
        let x0 = Infinity;
        let x1 = -Infinity;
        let y0 = Infinity;
        let y1 = -Infinity;
        for (const [x, y] of [[card.left, card.top], [card.left + w, card.top], [card.left, card.top + card.height], [card.left + w, card.top + card.height]]) {
            const px = cx + (x - cx) * cos - (y - cy) * sin;
            const py = cy + (x - cx) * sin + (y - cy) * cos;
            x0 = Math.min(x0, px);
            x1 = Math.max(x1, px);
            y0 = Math.min(y0, py);
            y1 = Math.max(y1, py);
        }
        return { x0, x1, y0, y1: Math.min(y1, layout.board.h) };
    });
}

const handOf = (cards: Record<string, Target>): Target[] => Array.from({ length: 8 }, (_, i) => cards[`hand:${i}`]);
const boxOf = (r: Rect): Box => ({ x0: r.x, x1: r.x + r.w, y0: r.y, y1: r.y + r.h });
/** Two boxes share some area (touching edges don't count). */
const meets = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const show = (b: Box) => `[${[b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0].map((n) => n.toFixed(1)).join(', ')}]`;
const by = (a: Box, b: Box) => `${(Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)).toFixed(1)}×${(Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)).toFixed(1)}`;

/**
 * fits' checks, cheapest first. With `found` null it stops at the first miss (allocation-light: layoutFor runs it per
 * candidate on every resize); with a list it records every miss, worded for a person.
 */
function walk(layout: Layout, found: string[] | null): boolean {
    let ok = true;
    /** Records a miss; true where the walk should stop now. */
    const miss = (why: () => string): boolean => {
        ok = false;
        if (!found) return true;
        found.push(why());
        return false;
    };
    const W = layout.board.w;
    const targets = tableTargets(layout);
    const hand = handOf(targets.cards);

    // my hand: each card's strip, and the hand within the board's width
    const strip = layout.kind === 'portrait' || layout.kind === 'landscape' ? Math.max(STRIP.phoneMin, STRIP.phone * layout.hand.w) : STRIP.wide * layout.hand.w;
    const handBoxes = hand.map(boundsOf);
    for (let i = 0; i < hand.length; i++) {
        const step = i < hand.length - 1 ? hand[i + 1].left - hand[i].left : Infinity;
        if (step < strip - SLACK && miss(() => `hand step ${i}: ${step.toFixed(1)} < ${strip.toFixed(1)}`)) return false;
        const card = handBoxes[i];
        if ((card.x0 < -SLACK || card.x1 > W + SLACK) && miss(() => `hand:${i} ${show(card)} off the board's width ${W.toFixed(1)}`)) return false;
    }

    // the trick slots: inside the band between the HUD and bandBottom
    const band = bandBottom(layout);
    const slots = POSITIONS.map((position) => ({ position, box: boundsOf({ ...targets.cards[`trick:${position}`], rotate: TILT }) }));
    for (const { position, box } of slots) {
        if ((box.x0 < -SLACK || box.x1 > W + SLACK || box.y0 < layout.hud - SLACK || box.y1 > band + SLACK)
            && miss(() => `slot ${position} ${show(box)} outside the band [0, ${layout.hud}, ${W.toFixed(1)}, ${band.toFixed(1)}]`)) return false;
    }

    // "Your turn" over my full hand: never on the partner's or a side slot (Ruling E)
    const handTop = Math.min(...hand.map((card) => card.top));
    const label: Box = { x0: W / 2 - YOUR_TURN.w / 2, x1: W / 2 + YOUR_TURN.w / 2, y0: handTop - YOUR_TURN.above, y1: handTop - YOUR_TURN.above + YOUR_TURN.h };
    for (const { position, box } of slots) {
        if (position !== 'me' && meets(label, box) && miss(() => `your turn ${show(label)} meets slot ${position} ${show(box)} by ${by(label, box)}`)) return false;
    }

    // a hovered hand card's lift: never on the partner's or a side slot (Rulings H, P: tablets too; my own slot it may meet)
    if (liftsOnHover(layout)) {
        for (let i = 0; i < hand.length; i++) {
            const card = hand[i];
            const r = (card.rotate * Math.PI) / 180;
            const lifted = boundsOf({ ...card, left: card.left + HOVER.lift * Math.sin(r), top: card.top - HOVER.lift * Math.cos(r), scale: HOVER.scale });
            for (const { position, box } of slots) {
                if (position !== 'me' && meets(lifted, box) && miss(() => `hover: lifted hand:${i} ${show(lifted)} meets slot ${position} ${show(box)} by ${by(lifted, box)}`)) return false;
            }
        }
    }

    // the slots against my hand, the fans, the piles and the HUD
    const huds = hudBoxes(layout).map(boxOf);
    const others: { name: string; box: Box }[] = [
        ...handBoxes.map((box, i) => ({ name: `hand:${i}`, box })),
        ...OPPONENTS.flatMap((position) => Array.from({ length: 8 }, (_, i) => ({ name: `back:${position}:${i}`, box: boundsOf(targets.cards[`back:${position}:${i}`]) }))),
        { name: 'pile A', box: boundsOf(targets.piles.A) }, { name: 'pile B', box: boundsOf(targets.piles.B) },
        ...huds.map((box, i) => ({ name: `hud#${i}`, box })),
    ];
    for (const { position, box } of slots) {
        for (const other of others) {
            if (meets(box, other.box) && miss(() => `slot ${position} ${show(box)} meets ${other.name} ${show(other.box)} by ${by(box, other.box)}`)) return false;
        }
    }

    // the piles off every fan of 7 backs. A pile draws nothing until it holds a trick (Piles.tsx: no cards and
    // no count at 0), and once a trick is taken every seat holds 7 cards at most: a full fan of 8 never meets a drawn pile
    for (const team of ['A', 'B'] as const) {
        const pile = boundsOf(targets.piles[team]);
        for (const position of OPPONENTS) {
            const backs = fanPlaces(layout, position, 7);
            for (let i = 0; i < backs.length; i++) {
                const back = boundsOf(backs[i]);
                if (meets(pile, back) && miss(() => `pile ${team} ${show(pile)} meets ${position}'s back ${i} of 7 ${show(back)} by ${by(pile, back)}`)) return false;
            }
        }
    }

    // the seats' columns, whichever team's declared cards show: off the slots, the HUD, my hand's strips and each other
    const strips = handStrips(layout, hand);
    for (const team of TEAMS) {
        const seats = seatBoxes(layout, targets, team).map(({ id, box }) => ({ id, box: boxOf(box) }));
        for (let i = 0; i < seats.length; i++) {
            const seat = seats[i];
            const name = () => `${team}: ${seat.id}#${seats.slice(0, i).filter((one) => one.id === seat.id).length} ${show(seat.box)}`;
            for (const { position, box } of slots) {
                if (meets(seat.box, box) && miss(() => `${name()} meets slot ${position} ${show(box)} by ${by(seat.box, box)}`)) return false;
            }
            for (let k = 0; k < huds.length; k++) {
                if (meets(seat.box, huds[k]) && miss(() => `${name()} meets hud#${k} ${show(huds[k])} by ${by(seat.box, huds[k])}`)) return false;
            }
            for (let k = 0; k < strips.length; k++) {
                if (meets(seat.box, strips[k]) && miss(() => `${name()} meets my hand card ${k}'s strip ${show(strips[k])} by ${by(seat.box, strips[k])}`)) return false;
            }
            for (let k = i + 1; k < seats.length; k++) {
                const other = seats[k];
                if (other.id !== seat.id && meets(seat.box, other.box) && miss(() => `${name()} meets ${other.id} ${show(other.box)} by ${by(seat.box, other.box)}`)) return false;
            }
        }
    }
    return ok;
}
