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
    /** An opponent's back before its scale (a 71-wide card at this density). */
    back: Size;
    /** The opponents' backs are drawn at this scale. */
    backScale: number;
    /** Reserved at the top of the felt for the HUD. */
    hud: number;
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
const BOARD_MAX_W = 1100;
const HAND_ROTATE = 2.2;
const HAND_ARC = 1.4;
const SEAT_ROTATE: Record<SeatPosition, number> = { me: 0, right: -90, partner: 180, left: 90 };

/** A card `intended` CSS px wide, sized to a whole number of device pixels per art pixel (spec §3.6). */
export function cardSize(intended: number, dpr: number): Size {
    const s = Math.max(1, Math.round((intended * dpr) / ART.w));
    return { w: (ART.w * s) / dpr, h: (ART.h * s) / dpr };
}

/** The layout of spec §5.6 for a viewport. */
export function layoutFor(viewport: Viewport): Layout {
    const { width, height, dpr } = viewport;
    const phone = cardSize(ART.w, dpr);
    if (width > height && height <= 500) {
        return { kind: 'landscape', viewport, board: { x: 0, y: 0, w: width, h: height }, blok: null, hand: phone, trick: phone, back: phone, backScale: 0.4, hud: 44 };
    }
    if (width >= 1024) {
        const w = Math.min(BOARD_MAX_W, width - BLOK_W);
        const x = (width - BLOK_W - w) / 2;
        const retina = dpr >= 2;
        return {
            kind: 'desktop', viewport, board: { x, y: 0, w, h: height }, blok: { x: x + w, y: 0, w: BLOK_W, h: height },
            hand: cardSize(retina ? 106.5 : 142, dpr), trick: cardSize(retina ? 106.5 : 71, dpr), back: phone, backScale: 0.5, hud: 52,
        };
    }
    return {
        kind: width >= 768 ? 'tablet' : 'portrait', viewport, board: { x: 0, y: 0, w: width, h: height }, blok: null,
        hand: phone, trick: phone, back: phone, backScale: 0.5, hud: 52,
    };
}

/** A stable tilt of −4.8…+4.8° from the card id (spec §5.6.1), never random per render. */
export function tilt(id: string): number {
    let sum = 0;
    for (const ch of id) sum += ch.charCodeAt(0);
    return ((sum % 9) - 4) * 1.2;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Where every card goes for this model and layout (spec §5.6). Pure: the board animates elements here. */
export function cardTargets(model: BoardModel, layout: Layout): Targets {
    const { w: W, h: H } = layout.board;
    const { hand: hs, trick: ts, back: bs, backScale, hud } = layout;
    const landscape = layout.kind === 'landscape';
    const desktop = layout.kind === 'desktop';
    const margin = 16;
    const below = landscape ? 0.25 : 0.2;
    const maxStep = landscape ? 52 : desktop ? (hs.w < 120 ? 64 : 84) : 36;
    const sideInset = desktop ? 70 : 30;
    const fanStep = desktop ? 16 : 10;
    const trickY = landscape ? H / 2 : H * 0.44;
    const slot = landscape ? { x: 0.7, y: 0.45 } : { x: 0.84, y: 0.58 };
    const cards: Record<CardId, Target> = {};
    const anchors: Targets['anchors'] = {};

    // my hand: an arc fan at the bottom edge; the outermost cards show (1 − below) of their height
    const n = model.hand.length;
    const mid = (n - 1) / 2;
    const half = (hs.w / 2) * Math.cos(rad(mid * HAND_ROTATE)) + (hs.h / 2) * Math.sin(rad(mid * HAND_ROTATE));
    const step = n > 1 ? Math.min(maxStep, (W - 2 * margin - 2 * half) / (n - 1)) : 0;
    const lowestTop = H - (1 - below) * hs.h;
    model.hand.forEach((card, i) => {
        const o = i - mid;
        const x = W / 2 + o * step;
        const top = lowestTop - HAND_ARC * (mid * mid - o * o);
        cards[card.id] = { left: x - hs.w / 2, top, width: hs.w, height: hs.h, rotate: o * HAND_ROTATE, scale: 1, z: i };
    });
    const handTop = lowestTop - HAND_ARC * mid * mid;
    const handLeft = W / 2 - mid * step - hs.w / 2;

    // the opponents' backs, fanned at their seats
    const center: Record<SeatPosition, { x: number; y: number }> = {
        me: { x: W / 2, y: lowestTop + hs.h / 2 },
        partner: { x: W / 2, y: hud + (landscape ? 23 : desktop ? 56 : 46) },
        left: { x: sideInset, y: trickY - (landscape ? 0 : 10) },
        right: { x: W - sideInset, y: trickY - (landscape ? 0 : 10) },
    };
    for (const seat of model.seats) {
        const c = center[seat.position];
        anchors[seat.id] = { x: c.x, y: c.y, rotate: SEAT_ROTATE[seat.position] };
        if (seat.position === 'me') continue;
        for (let i = 0; i < seat.cardsLeft; i++) {
            const o = i - (seat.cardsLeft - 1) / 2;
            const x = seat.position === 'partner' ? c.x + o * fanStep : c.x;
            const y = seat.position === 'partner' ? c.y : c.y + o * fanStep;
            cards[`back:${seat.id}:${i}`] = {
                left: x - bs.w / 2, top: y - bs.h / 2, width: bs.w, height: bs.h, rotate: SEAT_ROTATE[seat.position] + o * 2, scale: backScale, z: i,
            };
        }
    }

    // the trick: a cross, each card in its player's slot with a stable tilt
    const slots: Record<SeatPosition, { x: number; y: number }> = {
        me: { x: 0, y: slot.y }, right: { x: slot.x, y: 0 }, partner: { x: 0, y: -slot.y }, left: { x: -slot.x, y: 0 },
    };
    for (const play of model.trick?.plays ?? []) {
        const s = slots[play.position ?? 'me'];
        cards[play.id] = {
            left: W / 2 + s.x * ts.w - ts.w / 2, top: trickY + s.y * ts.h - ts.h / 2, width: ts.w, height: ts.h, rotate: tilt(play.id), scale: 1, z: play.order,
        };
    }

    // the piles: mine bottom-left (above the hand, or beside it in landscape), the opponents' top-right
    const pile = { w: ts.w / 2, h: ts.h / 2 };
    const mine = landscape
        ? { x: Math.max(sideInset + (bs.h * backScale) / 2 + margin + pile.w / 2, handLeft - margin - pile.w / 2), y: H - margin - pile.h / 2 }
        : { x: margin + pile.w / 2, y: handTop - margin - pile.h / 2 };
    const theirs = landscape
        ? { x: W - mine.x, y: hud + 8 + pile.h / 2 }
        : { x: W - margin - pile.w / 2, y: hud + 8 + pile.h / 2 };
    const myTeam: Team = model.myTeam ?? 'A';
    const pileTarget = (p: { x: number; y: number }, rotate: number): Target =>
        ({ left: p.x - ts.w / 2, top: p.y - ts.h / 2, width: ts.w, height: ts.h, rotate, scale: 0.5, z: 0 });
    const piles = myTeam === 'A'
        ? { A: pileTarget(mine, -8), B: pileTarget(theirs, 8) }
        : { A: pileTarget(theirs, 8), B: pileTarget(mine, -8) };
    return { cards, piles, anchors };
}
