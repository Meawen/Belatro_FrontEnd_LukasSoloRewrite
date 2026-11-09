import { cardSize, layoutAt, type Layout, type LayoutKind, type Rect, type Target } from '../../components/board/model/cardTargets'

/** A layout for a window at given card sizes (the step nearest each width at that density). */
export function at(width: number, height: number, dpr: number, kind: LayoutKind, trick: number, hand = trick): Layout {
    return layoutAt({ width, height, dpr }, kind, cardSize(trick, dpr), cardSize(hand, dpr))
}

/**
 * The §7 windows at the sizes layoutFor picks for them (board-fit spec §3; Ruling R: §3.3's examples are these; fit.test
 * pins each): phones upright 94.67 at 390×664 @3 and 430×739 @3, 71 at 375×553 @2 and 375×812 @2; sideways 71; wide
 * windows as §3.3 says. 1280×720 @1 also at 142/213, a pair fits rejects there (Ruling M), so the G2 test keeps it in
 * view.
 */
export const seven = (): Layout[] => [
    at(375, 553, 2, 'portrait', 71), at(390, 664, 3, 'portrait', 94.67), at(375, 812, 2, 'portrait', 71), at(430, 739, 3, 'portrait', 94.67),
    at(667, 323, 2, 'landscape', 71), at(844, 340, 3, 'landscape', 71), at(812, 375, 2, 'landscape', 71),
    at(960, 980, 1, 'tablet', 142, 213),
    at(1280, 720, 1, 'desktop', 71, 142), at(1280, 720, 1, 'desktop', 142, 213), at(1366, 641, 1, 'desktop', 71, 142),
    at(1440, 900, 1, 'desktop', 142, 213), at(1440, 900, 2, 'desktop', 142, 213), at(1440, 789, 2, 'desktop', 106.5, 142),
    at(1536, 730, 1.25, 'desktop', 113.6, 170.4), at(1280, 600, 1.5, 'desktop', 94.67, 94.67),
    at(1920, 1080, 1, 'desktop', 142, 213), at(2560, 1300, 1, 'desktop', 213, 284),
]

export const nameOf = (layout: Layout) => `${layout.viewport.width}x${layout.viewport.height}@${layout.viewport.dpr} ${layout.trick.w.toFixed(2)}/${layout.hand.w.toFixed(2)}`

const rad = (deg: number) => (deg * Math.PI) / 180

/** The on-screen bounding box of a rotated, scaled card. */
export function box(t: Target) {
    const cx = t.left + t.width / 2
    const cy = t.top + t.height / 2
    const w = t.width * t.scale
    const h = t.height * t.scale
    const r = rad(t.rotate)
    const hw = (Math.abs(Math.cos(r)) * w + Math.abs(Math.sin(r)) * h) / 2
    const hh = (Math.abs(Math.sin(r)) * w + Math.abs(Math.cos(r)) * h) / 2
    return { x0: cx - hw, x1: cx + hw, y0: cy - hh, y1: cy + hh }
}
export type Box = ReturnType<typeof box>

/** A Rect as a Box. */
export const boxOf = (r: Rect): Box => ({ x0: r.x, x1: r.x + r.w, y0: r.y, y1: r.y + r.h })

/** Two boxes share some area (touching edges don't count). */
export const overlap = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

/** The smallest box around some boxes. */
export const hull = (boxes: Box[]): Box => ({
    x0: Math.min(...boxes.map((b) => b.x0)), x1: Math.max(...boxes.map((b) => b.x1)),
    y0: Math.min(...boxes.map((b) => b.y0)), y1: Math.max(...boxes.map((b) => b.y1)),
})
