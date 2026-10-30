import { crispCardWidth } from '../../ui/cardWidth';
import type { BoardModel, SeatPosition, Team } from './boardModel';
import type { CardId } from './rules';

/** The space the game page gives the board, in CSS px, and the screen's device-pixel ratio. */
export interface Viewport {
    width: number;
    height: number;
    dpr: number;
}

export interface Size {
    w: number;
    h: number;
}

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** Spec §5.6: landscape with height ≤ 500 whatever the width; else desktop from 1024; else portrait (768–1023: tablet). */
export type LayoutKind = 'portrait' | 'tablet' | 'landscape' | 'desktop';

export interface Layout {
    kind: LayoutKind;
    viewport: Viewport;
    /** The felt, in viewport coordinates; every target is relative to its top-left corner. */
    board: Rect;
    /** The desktop's 320-px Bela Blok column; null where Bela Blok is a sheet. */
    blok: Rect | null;
    /** Card sizes in CSS px (spec §3.6): whole device pixels per art pixel, so the art stays crisp. */
    hand: Size;
    trick: Size;
    /** An opponent's back before its scale: the phone's (a 71-wide card at this density), the trick card on wide windows (board-fit spec §3.3). */
    back: Size;
    /** The opponents' backs are drawn at this scale. */
    backScale: number;
    /** Reserved at the top of the felt for the HUD. */
    hud: number;
    /** The share of a hand card's height above the board's bottom edge: 0.8, half in landscape (board-fit spec §3.4). */
    handShow: number;
    /** A seat's declared cards (board-fit spec §3.5): crisp, the step nearest half the trick card, never narrower than the backs as drawn. */
    declared: Size;
}

/** A card element's place: `left`/`top` of its box (board coordinates), rotated and scaled about its centre. */
export interface Target {
    left: number;
    top: number;
    width: number;
    height: number;
    rotate: number;
    scale: number;
    /** Stacking order within its region (later cards on top). */
    z: number;
}

export interface Targets {
    /** My hand cards and the trick's cards by card id; the opponents' backs by `back:{playerId}:{i}`. */
    cards: Record<CardId, Target>;
    /** Where a swept trick card lands on each team's pile (trick size, scale .5, ±8°). */
    piles: Record<Team, Target>;
    /** Each seat's hand centre: where its cards come from (plays) and where the dealer deals from. */
    anchors: Record<string, { x: number; y: number; rotate: number }>;
}

const ART = { w: 71, h: 95 };
const BLOK_W = 320;
/** The desktop board's width limit at a 142-wide hand; a bigger hand widens it in proportion (board-fit spec §3.3). */
const BOARD_MAX_W = 1100;
const BOARD_HAND_W = 142;
const HAND_ROTATE = 2.2;
const HAND_ARC = 1.4;
const SEAT_ROTATE: Record<SeatPosition, number> = { me: 0, right: -90, partner: 180, left: 90 };
/** Kept clear at the board's sides: the hand, the piles. */
const MARGIN = 16;
/**
 * The most a hand card steps from the next, scaling with the hand card (board-fit spec §3.5): 36 px per 71 px of card
 * upright (spec §5.6.1), 52 sideways (§5.6.2); 0.59 of it on desktops (§5.6.3: 84 at 142).
 */
const HAND_STEP = { portrait: 36, tablet: 36, landscape: 52 };
const DESKTOP_HAND_STEP = 0.59;
/** A fan's step per 47.5 px of the back as drawn (a 71-wide back at half scale): 10 px, 16 on desktops (spec §5.6). */
const FAN_STEP = { drawn: 47.5, phone: 10, desktop: 16 };
/** At a 71-wide back: the side fans' inset from the edge (§5.6.1: 30), the partner's fan centre under the HUD (46). */
const SIDE_INSET = { phone: 30, desktop: 70 };
const PARTNER_DROP: Record<LayoutKind, number> = { portrait: 46, tablet: 46, landscape: 23, desktop: 56 };
/** The trick's cross: each slot's offset from its centre, in card widths (x) and heights (y) (spec §5.6.1, §5.6.2). */
const SLOT = { x: 0.84, y: 0.58 };
const LANDSCAPE_SLOT = { x: 0.7, y: 0.45 };
/** Kept clear between the trick's band and my hand's top; on desktop the hover lift too (§5.6.5: −24 px, ×1.08 about the centre). */
const BAND_GAP = 8;
const HOVER = { lift: 24, grow: 0.04 };

/** A card `intended` CSS px wide, sized to a whole number of device pixels per art pixel (spec §3.6). */
export function cardSize(intended: number, dpr: number): Size {
    const s = Math.max(1, Math.round((intended * dpr) / ART.w));
    return { w: (ART.w * s) / dpr, h: (ART.h * s) / dpr };
}

/**
 * The whole layout (spec §5.6, board-fit spec §3) for a viewport at the given card sizes: the board (on desktop centred
 * left of the 320-px Bela Blok column, up to 1100 px wide at a 142-wide hand and wider in proportion to a bigger one),
 * the opponents' backs (the phone back on phones; the trick card, drawn at half, on wide windows), the HUD's band and
 * how much of the hand shows.
 */
export function layoutAt(viewport: Viewport, kind: LayoutKind, trick: Size, hand: Size): Layout {
    const { width, height, dpr } = viewport;
    const back = kind === 'tablet' || kind === 'desktop' ? trick : cardSize(ART.w, dpr);
    const backScale = kind === 'landscape' ? 0.4 : 0.5;
    const hud = kind === 'landscape' ? 44 : 52;
    const handShow = kind === 'landscape' ? 0.5 : 0.8;
    const declared = declaredSize(trick, back.w * backScale, dpr);
    if (kind === 'desktop') {
        const w = Math.min(BOARD_MAX_W * Math.max(1, hand.w / BOARD_HAND_W), width - BLOK_W);
        const x = (width - BLOK_W - w) / 2;
        return { kind, viewport, board: { x, y: 0, w, h: height }, blok: { x: x + w, y: 0, w: BLOK_W, h: height }, hand, trick, back, backScale, hud, handShow, declared };
    }
    return { kind, viewport, board: { x: 0, y: 0, w: width, h: height }, blok: null, hand, trick, back, backScale, hud, handShow, declared };
}

/** The crisp step nearest half the trick card; where that is narrower than the backs as drawn, the next one up. */
function declaredSize(trick: Size, backs: number, dpr: number): Size {
    const nearest = cardSize(trick.w / 2, dpr);
    if (nearest.w >= backs) return nearest;
    const s = Math.ceil((backs * dpr) / ART.w);
    return { w: (ART.w * s) / dpr, h: (ART.h * s) / dpr };
}

/** The layout of spec §5.6 for a viewport, at today's card sizes (§3.6). */
export function layoutFor(viewport: Viewport): Layout {
    const { width, height, dpr } = viewport;
    const phone = cardSize(ART.w, dpr);
    if (width > height && height <= 500) return layoutAt(viewport, 'landscape', phone, phone);
    if (width >= 1024) {
        const retina = dpr >= 2;
        return layoutAt(viewport, 'desktop', cardSize(retina ? 106.5 : 71, dpr), cardSize(retina ? 106.5 : 142, dpr));
    }
    return layoutAt(viewport, width >= 768 ? 'tablet' : 'portrait', phone, phone);
}

/** A stable tilt of −4.8…+4.8° from the card id (spec §5.6.1), never random per render. */
export function tilt(id: string): number {
    let sum = 0;
    for (const ch of id) sum += ch.charCodeAt(0);
    return ((sum % 9) - 4) * 1.2;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** How far apart an opponent's backs are fanned (spec §5.6): in proportion to the back as drawn (board-fit spec §3.5). */
export function fanStepOf(layout: Layout): number {
    const drawn = layout.back.h * layout.backScale;
    return (drawn * (layout.kind === 'desktop' ? FAN_STEP.desktop : FAN_STEP.phone)) / FAN_STEP.drawn;
}

/** A target's on-screen bounding box, rotated and scaled about its centre. */
export function boundsOf(t: Target): { x0: number; x1: number; y0: number; y1: number } {
    const cx = t.left + t.width / 2;
    const cy = t.top + t.height / 2;
    const w = t.width * t.scale;
    const h = t.height * t.scale;
    const r = rad(t.rotate);
    const hw = (Math.abs(Math.cos(r)) * w + Math.abs(Math.sin(r)) * h) / 2;
    const hh = (Math.abs(Math.sin(r)) * w + Math.abs(Math.cos(r)) * h) / 2;
    return { x0: cx - hw, x1: cx + hw, y0: cy - hh, y1: cy + hh };
}

/** The outermost hand cards' top: `handShow` of each card above the bottom edge. */
const lowestTopOf = (layout: Layout) => layout.board.h - layout.handShow * layout.hand.h;
/** A distance tuned at a 71-wide back, in proportion to this layout's back (board-fit spec §3.5). */
const per71 = (layout: Layout, px: number) => (px * layout.back.w) / ART.w;
/** The side fans' inset from the board's edge. */
const sideInsetOf = (layout: Layout) => per71(layout, layout.kind === 'desktop' ? SIDE_INSET.desktop : SIDE_INSET.phone);

/** My hand's arc for `n` cards: the step between cards, the middle's offset, and the outermost cards' top. */
function handArc(layout: Layout, n: number): { step: number; mid: number; lowestTop: number } {
    const { w: W } = layout.board;
    const hs = layout.hand;
    const mid = (n - 1) / 2;
    const half = (hs.w / 2) * Math.cos(rad(mid * HAND_ROTATE)) + (hs.h / 2) * Math.sin(rad(mid * HAND_ROTATE));
    const maxStep = layout.kind === 'desktop' ? hs.w * DESKTOP_HAND_STEP : (hs.w * HAND_STEP[layout.kind]) / ART.w;
    const step = n > 1 ? Math.min(maxStep, (W - 2 * MARGIN - 2 * half) / (n - 1)) : 0;
    return { step, mid, lowestTop: lowestTopOf(layout) };
}

/** My `n` hand cards (spec §5.6): an arc fan centred at the bottom edge, the outermost showing `handShow` of their height. */
export function handPlaces(layout: Layout, n: number): Target[] {
    const { w: W } = layout.board;
    const hs = layout.hand;
    const { step, mid, lowestTop } = handArc(layout, n);
    return Array.from({ length: n }, (_, i) => {
        const o = i - mid;
        const x = W / 2 + o * step;
        const top = lowestTop - HAND_ARC * (mid * mid - o * o);
        return { left: x - hs.w / 2, top, width: hs.w, height: hs.h, rotate: o * HAND_ROTATE, scale: 1, z: i };
    });
}

/** The middle of a seat's hand: my hand's, or an opponent's fan, its distances in proportion to the back (board-fit spec §3.5). */
function seatCentre(layout: Layout, position: SeatPosition): { x: number; y: number } {
    const { w: W } = layout.board;
    if (position === 'me') return { x: W / 2, y: lowestTopOf(layout) + layout.hand.h / 2 };
    if (position === 'partner') return { x: W / 2, y: layout.hud + per71(layout, PARTNER_DROP[layout.kind]) };
    const y = trickCentre(layout).y - (layout.kind === 'landscape' ? 0 : 10);
    return { x: position === 'left' ? sideInsetOf(layout) : W - sideInsetOf(layout), y };
}

/** An opponent's `n` backs fanned at their seat (spec §5.6): across for the partner, down the side for the others. None for me. */
export function fanPlaces(layout: Layout, position: SeatPosition, n: number): Target[] {
    if (position === 'me') return [];
    const { back: bs, backScale } = layout;
    const c = seatCentre(layout, position);
    const fanStep = fanStepOf(layout);
    return Array.from({ length: n }, (_, i) => {
        const o = i - (n - 1) / 2;
        const x = position === 'partner' ? c.x + o * fanStep : c.x;
        const y = position === 'partner' ? c.y : c.y + o * fanStep;
        return { left: x - bs.w / 2, top: y - bs.h / 2, width: bs.w, height: bs.h, rotate: SEAT_ROTATE[position] + o * 2, scale: backScale, z: i };
    });
}

/**
 * The bottom of the trick's band (board-fit spec §4): 8 px over the top of my full hand of 8; on desktop also over the
 * hover lift, which raises a card 24 px and grows it ×1.08 about its centre (4 % of its height).
 */
export function bandBottom(layout: Layout): number {
    const handTop = Math.min(...handPlaces(layout, 8).map((card) => card.top));
    const lift = layout.kind === 'desktop' ? HOVER.lift + HOVER.grow * layout.hand.h : 0;
    return handTop - BAND_GAP - lift;
}

/**
 * The middle of the trick's cross (board-fit spec §4), in board coordinates: where the declaration moment is said too.
 * Centred in the band from the partner's full fan's lowest edge to `bandBottom`, from the layout alone, so it never
 * moves as the hands shrink.
 */
export function trickCentre(layout: Layout): { x: number; y: number } {
    const fanBottom = Math.max(...fanPlaces(layout, 'partner', 8).map((back) => boundsOf(back).y1));
    return { x: layout.board.w / 2, y: (fanBottom + bandBottom(layout)) / 2 };
}

/** The trick's cross (spec §5.6): each player's slot, unturned (callers add the card's tilt). */
export function trickSlots(layout: Layout): Record<SeatPosition, Target> {
    const { w: W } = layout.board;
    const ts = layout.trick;
    const trickY = trickCentre(layout).y;
    const slot = layout.kind === 'landscape' ? LANDSCAPE_SLOT : SLOT;
    const at = (x: number, y: number): Target =>
        ({ left: W / 2 + x * ts.w - ts.w / 2, top: trickY + y * ts.h - ts.h / 2, width: ts.w, height: ts.h, rotate: 0, scale: 1, z: 0 });
    return { me: at(0, slot.y), right: at(slot.x, 0), partner: at(0, -slot.y), left: at(-slot.x, 0) };
}

/**
 * Where the challenge banner goes (gameplay rules §6): centred where the trick goes. On a short landscape screen
 * the docked hand result covers the middle of the felt, so while it is open (a right challenge in the window) the
 * banner's top edge sits under the HUD instead (`top`), above the sheet and still above the trick.
 */
export function bannerSpot(layout: Layout, sheetOpen: boolean): { x: number; y: number; top: boolean } {
    const centre = trickCentre(layout);
    return sheetOpen && layout.kind === 'landscape' ? { x: centre.x, y: layout.hud + 8, top: true } : { ...centre, top: false };
}

/** The declaration panel's content box at its widest (board.css `.board-moment__panel`: max-width min(320px, 100% − 128px), 14 px each side). */
const PANEL = { max: 320, margin: 128, padding: 14 };
/** A belot's cards are two-thirds of a trick card, each 45 % under the next where the panel has the room. */
const BELOT_SCALE = 0.66;
const BELOT_OVERLAP = 0.45;

/**
 * A belot's `count` cards in a row in the declaration panel (gameplay rules §6): each `width` wide, crisp as
 * PlayingCard draws it, and `step` from one card's left edge to the next's: 45 % under the next, or closer where
 * the row would overflow the panel (a retina desktop, whose crisp card rounds up to a whole 71 px).
 */
export function belotRow(layout: Layout, count = 8): { width: number; step: number } {
    const width = crispCardWidth(layout.trick.w * BELOT_SCALE, layout.viewport.dpr);
    const room = Math.min(PANEL.max, layout.board.w - PANEL.margin) - 2 * PANEL.padding;
    const step = count > 1 ? Math.max(0, Math.min(width * (1 - BELOT_OVERLAP), (room - width) / (count - 1))) : 0;
    return { width, step };
}

/**
 * The piles (spec §5.6) with `n` cards in my hand: mine bottom-left (above the hand, or beside it in landscape), the
 * opponents' top-right.
 */
function pilePlaces(layout: Layout, n: number, myTeam: Team): Record<Team, Target> {
    const { w: W } = layout.board;
    const { hand: hs, trick: ts, back: bs, backScale, hud } = layout;
    const landscape = layout.kind === 'landscape';
    const sideInset = sideInsetOf(layout);
    const { step, mid, lowestTop } = handArc(layout, n);
    const handTop = lowestTop - HAND_ARC * mid * mid;
    const handLeft = W / 2 - mid * step - hs.w / 2;
    const pile = { w: ts.w / 2, h: ts.h / 2 };
    const mine = landscape
        ? { x: Math.max(sideInset + (bs.h * backScale) / 2 + MARGIN + pile.w / 2, handLeft - MARGIN - pile.w / 2), y: layout.board.h - MARGIN - pile.h / 2 }
        : { x: MARGIN + pile.w / 2, y: handTop - MARGIN - pile.h / 2 };
    const theirs = landscape
        ? { x: W - mine.x, y: hud + 8 + pile.h / 2 }
        : { x: W - MARGIN - pile.w / 2, y: hud + 8 + pile.h / 2 };
    const pileTarget = (p: { x: number; y: number }, rotate: number): Target =>
        ({ left: p.x - ts.w / 2, top: p.y - ts.h / 2, width: ts.w, height: ts.h, rotate, scale: 0.5, z: 0 });
    return myTeam === 'A'
        ? { A: pileTarget(mine, -8), B: pileTarget(theirs, 8) }
        : { A: pileTarget(theirs, 8), B: pileTarget(mine, -8) };
}

/** Where every card goes for this model and layout (spec §5.6). Pure: the board animates elements here. */
export function cardTargets(model: BoardModel, layout: Layout): Targets {
    const cards: Record<CardId, Target> = {};
    const anchors: Targets['anchors'] = {};

    // my hand: an arc fan at the bottom edge
    const hand = handPlaces(layout, model.hand.length);
    model.hand.forEach((card, i) => { cards[card.id] = hand[i]; });

    // each seat's hand centre, and the opponents' backs fanned at their seats
    for (const seat of model.seats) {
        const c = seatCentre(layout, seat.position);
        anchors[seat.id] = { x: c.x, y: c.y, rotate: SEAT_ROTATE[seat.position] };
        fanPlaces(layout, seat.position, seat.cardsLeft).forEach((back, i) => { cards[`back:${seat.id}:${i}`] = back; });
    }

    // the trick: a cross, each card in its player's slot with a stable tilt
    const slots = trickSlots(layout);
    for (const play of model.trick?.plays ?? []) {
        cards[play.id] = { ...slots[play.position ?? 'me'], rotate: tilt(play.id), z: play.order };
    }

    return { cards, piles: pilePlaces(layout, model.hand.length, model.myTeam ?? 'A'), anchors };
}

const POSITIONS: readonly SeatPosition[] = ['me', 'right', 'partner', 'left'];

/**
 * A full table from the layout alone, without a model (board-fit spec §3.2: what seatBoxes and fits measure): my 8
 * hand cards (`hand:{i}`), 8 backs at every other seat (`back:{position}:{i}`), the four trick slots unturned
 * (`trick:{position}`), and the anchors and piles as cardTargets makes them for that table. The seat ids are the
 * positions; my team is A.
 */
export function tableTargets(layout: Layout): Targets {
    const cards: Record<CardId, Target> = {};
    const anchors: Targets['anchors'] = {};
    handPlaces(layout, 8).forEach((card, i) => { cards[`hand:${i}`] = card; });
    const slots = trickSlots(layout);
    for (const position of POSITIONS) {
        const c = seatCentre(layout, position);
        anchors[position] = { x: c.x, y: c.y, rotate: SEAT_ROTATE[position] };
        fanPlaces(layout, position, 8).forEach((back, i) => { cards[`back:${position}:${i}`] = back; });
        cards[`trick:${position}`] = slots[position];
    }
    return { cards, piles: pilePlaces(layout, 8, 'A'), anchors };
}

/**
 * The HUD at its widest (board.css `.board-hud*`, `.board-challenge*`; Hud.tsx, Challenge.tsx), in CSS px measured on the
 * 375×553 shot: lines 44 tall (the hit areas) from 8 px down, 6 apart, items 6 apart.
 * - The score chip with four-digit scores: 96 with one digit each, and 9 px a further `t-score` digit (6 of them).
 * - Blok: 48. The menu: 44.
 * - The phase chip: with a trump called, its longest ("Hand finished", the trump) about 170; under 400 px in portrait
 *   only the trump (board.css hides the word), about 74; without a trump (bidding, starting) about 76.
 * - Challenge at its widest label, "Challenge used": 13-px semibold text and 12 px each side, about 120, 44 tall; its
 *   info button 44; side by side 2 apart with 2 to spare (landscape), stacked 6 apart (portrait).
 */
const HUD = { top: 8, line: 44, gap: 6, score: 96 + 6 * 9, blok: 48, menu: 44, called: 170, calledNarrow: 74, uncalled: 76, challenge: 120, info: 44 };

/**
 * What the HUD keeps on the felt (board-fit spec G2), at its worst case: its band, and
 * - portrait: Blok on a second line wherever the first line can't hold the scores, Blok and the phase chip with the menu
 *   (with or without a trump called); the Challenge column (Challenge over its info button, only while a trump is
 *   called) on a line of its own under the first line, or under Blok where the first line wraps then;
 * - landscape: when the left group (capped at half the board less 58 px) can't hold Challenge too, Challenge's line.
 * Its hint is a popover, not counted.
 */
export function hudBoxes(layout: Layout): Rect[] {
    const W = layout.board.w;
    const band: Rect = { x: 0, y: 0, w: W, h: layout.hud };
    const line = (n: number) => HUD.top + n * (HUD.line + HUD.gap);
    if (layout.kind === 'portrait') {
        const wraps = (phase: number) => HUD.top + HUD.score + HUD.gap + HUD.blok + HUD.gap + phase + HUD.gap + HUD.menu + HUD.top > W;
        const inPlay = wraps(W < 400 ? HUD.calledNarrow : HUD.called);
        const challenge: Rect = { x: HUD.top, y: line(inPlay ? 2 : 1), w: HUD.challenge, h: HUD.line + HUD.gap + HUD.line };
        const blok: Rect = { x: HUD.top, y: line(1), w: HUD.blok, h: HUD.line };
        return inPlay || wraps(HUD.uncalled) ? [band, blok, challenge] : [band, challenge];
    }
    if (layout.kind === 'landscape') {
        const challenge = HUD.challenge + 2 + HUD.info + 2;
        const wraps = HUD.score + HUD.gap + HUD.blok + HUD.gap + challenge > W / 2 - 58;
        return wraps ? [band, { x: HUD.top, y: line(1), w: challenge, h: HUD.line }] : [band];
    }
    return [band];
}
