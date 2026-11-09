import { describe, test, expect } from 'vitest'
import { coachSpot } from './coachSpot'
import { layoutFor } from './model/fit'
import { boundsOf, fanPlaces, handPlaces, hudBoxes, tableTargets, trickSlots, yourTurnBox, type Layout } from './model/cardTargets'
import { seatBoxes } from './seatSpot'
import { busyBoxes } from '../../test/fixtures/busy'
import { boxOf, hull, overlap, type Box } from '../../test/fixtures/layouts'

// board-fit's checked windows (spec §7, the testing session's T3 list), as layoutFor lays them out
const SIZES: [number, number, number][] = [
    [375, 553, 2], [390, 664, 3], [375, 812, 2], [430, 739, 3],
    [667, 323, 2], [844, 340, 3], [812, 375, 2], [915, 332, 2.625], [851, 329, 2.75],
    [960, 980, 1], [1280, 720, 1], [1366, 641, 1], [1440, 900, 1], [1440, 900, 2], [1440, 789, 2], [1536, 730, 1.25],
    [1280, 600, 1.5], [1920, 1080, 1], [2560, 1300, 1], [1280, 480, 1.5], [1366, 500, 1.75],
]
const layouts = SIZES.map(([width, height, dpr]) => layoutFor({ width, height, dpr }))
const name = (layout: Layout) => `${layout.viewport.width}x${layout.viewport.height}@${layout.viewport.dpr}`

/** The panel's box at its tallest. */
const panelBox = (layout: Layout, bidding: boolean): Box => {
    const spot = coachSpot(layout, bidding)
    return { x0: spot.left, x1: spot.left + spot.width, y0: spot.top, y1: spot.top + spot.maxHeight }
}

/** What the panel must leave alone (board-fit spec G1, G2), named, with the seat each belongs to. */
function things(layout: Layout, bidding: boolean): { what: string; of: string | null; box: Box }[] {
    const targets = tableTargets(layout)
    const out: { what: string; of: string | null; box: Box }[] = []
    hudBoxes(layout).forEach((r, i) => out.push({ what: `hud ${i}`, of: null, box: boxOf(r) }))
    // while bidding no seat has declared cards yet ('theirs' shows only the side seats', who are never in the way)
    for (const team of bidding ? (['theirs'] as const) : (['mine', 'theirs'] as const)) {
        for (const { id, box } of seatBoxes(layout, targets, team)) out.push({ what: `${id}'s column (${team})`, of: id, box: boxOf(box) })
        for (const { id, part, box } of busyBoxes(layout, team)) out.push({ what: `${id}'s busy ${part} (${team})`, of: id, box })
    }
    for (const position of ['partner', 'left', 'right'] as const) out.push({ what: `${position}'s backs`, of: position, box: hull(fanPlaces(layout, position, 8).map(boundsOf)) })
    out.push({ what: 'my hand', of: null, box: hull(handPlaces(layout, 8).map(boundsOf)) })
    if (!bidding) for (const [position, slot] of Object.entries(trickSlots(layout))) out.push({ what: `the ${position} trick slot`, of: null, box: boundsOf({ ...slot, rotate: 4.8 }) })
    if (layout.kind !== 'portrait') out.push({ what: '"Your turn"', of: null, box: boxOf(yourTurnBox(layout)) })
    return out
}

describe('coachSpot: Škola bele\'s panel on board-fit\'s layout (open beta §7.2, §7.3; board-fit spec G1, G2)', () => {
    test.each([false, true])('at every checked window (bidding %s) it stays inside the board and meets nothing but the seat it is ruled to cover: no trick slot, not my hand, no HUD control, no plate, chip or declared card (common or busy), no backs', (bidding) => {
        const met: string[] = []
        for (const layout of layouts) {
            const spot = coachSpot(layout, bidding)
            const panel = panelBox(layout, bidding)
            expect(panel.x0, name(layout)).toBeGreaterThanOrEqual(8)
            expect(panel.x1, name(layout)).toBeLessThanOrEqual(layout.board.w - 8)
            expect(panel.y1, name(layout)).toBeLessThanOrEqual(layout.board.h - 8)
            for (const thing of things(layout, bidding)) {
                if (thing.of !== null && thing.of === spot.covers) continue
                if (overlap(panel, thing.box)) met.push(`${name(layout)}: ${thing.what}`)
            }
        }
        expect(met).toEqual([])
    })

    test('while bidding it also stays off the bid panel (centred at 36 % upright, 46 % sideways, else 44 %)', () => {
        for (const layout of layouts) {
            const { w: W, h: H } = layout.board
            const [at, width, height] = layout.kind === 'portrait' ? [0.36, 252, 150.2] : [layout.kind === 'landscape' ? 0.46 : 0.44, 327.3, 98.2]
            const bid = { x0: W / 2 - width / 2, x1: W / 2 + width / 2, y0: at * H - height / 2, y1: at * H + height / 2 }
            expect(overlap(panelBox(layout, true), bid), name(layout)).toBe(false)
        }
    })

    test('it covers a seat only where the board has no free room for a lesson (at least 220 × 72): in play, upright phones shorter than 375×812 cover my partner\'s fan and tag column; sideways phones the right seat\'s, bidding too; desktops, tablets, short desktops at 150 %/175 %, 375×812 and upright bidding (in the empty trick area) cover nothing', () => {
        const covered = (bidding: boolean) => Object.fromEntries(layouts.map((layout) => [name(layout), coachSpot(layout, bidding).covers]))
        const expected = (bidding: boolean) => Object.fromEntries(layouts.map((layout) => [name(layout),
            layout.kind === 'landscape' && layout.viewport.width < 1024 ? 'right' : !bidding && layout.kind === 'portrait' && name(layout) !== '375x812@2' ? 'partner' : null]))
        expect(covered(false)).toEqual(expected(false))
        expect(covered(true)).toEqual(expected(true))
        for (const layout of layouts) {
            const spot = coachSpot(layout, false)
            if (spot.covers === null) {
                expect(spot.width, name(layout)).toBeGreaterThanOrEqual(220)
                expect(spot.maxHeight, name(layout)).toBeGreaterThanOrEqual(72)
            }
        }
    })

    test('on desktops and tablets the felt\'s top-left corner: 6 px under the HUD, left of my partner\'s backs, over the left seat\'s column; 420 px wide at most', () => {
        for (const layout of layouts.filter((one) => one.kind === 'desktop' || one.kind === 'tablet')) {
            const spot = coachSpot(layout, false)
            expect([spot.left, spot.top], name(layout)).toEqual([8, 58])
            expect(spot.width, name(layout)).toBeLessThanOrEqual(420)
        }
        // 1280×720 @1: up to 6 px before my partner's backs (403.5) and 6 px over the left seat's plate (252); the same while bidding
        for (const bidding of [false, true]) {
            const spot = coachSpot(layoutFor({ width: 1280, height: 720, dpr: 1 }), bidding)
            expect([spot.left, spot.top, spot.covers]).toEqual([8, 58, null])
            expect(spot.width).toBeCloseTo(403.5 - 6 - 8, 1)
            expect(spot.maxHeight).toBeCloseTo(252 - 6 - 58, 1)
        }
    })

    test('upright at 375×812 @2 the band between my partner\'s column and the trick, the board\'s full width; while bidding the empty trick area under the bid panel, between the side fans, over their bid chips', () => {
        const layout = layoutFor({ width: 375, height: 812, dpr: 2 })
        const play = coachSpot(layout, false)
        expect(play.covers).toBeNull()
        expect([play.left, play.width]).toEqual([8, 359])
        expect(play.top).toBeCloseTo(186.8, 1)
        expect(play.top + play.maxHeight).toBeCloseTo(306.1, 1)
        const bid = coachSpot(layout, true)
        expect(bid.covers).toBeNull()
        // 6 px past the left fan (55.7), 6 px under the bid panel (centred at 36 %, 152 tall), 6 px over the side seats' chips
        expect(bid.left).toBeCloseTo(61.7, 1)
        expect(bid.top).toBeCloseTo(0.36 * 812 + 76 + 6, 1)
        expect(bid.top + bid.maxHeight).toBeCloseTo(467.8, 1)
    })

    test('sideways at 812×375 @2 the right seat\'s place: from its fan\'s top to 6 px over my hand, 6 px right of the trick (of the bid panel while bidding)', () => {
        const layout = layoutFor({ width: 812, height: 375, dpr: 2 })
        const play = coachSpot(layout, false)
        expect(play.covers).toBe('right')
        expect(play.left).toBeCloseTo(495.1 + 6, 1)
        expect(play.left + play.width).toBeCloseTo(804, 1)
        expect(play.top + play.maxHeight).toBeCloseTo(314.8 - 6, 1)
        const bid = coachSpot(layout, true)
        expect(bid.left).toBeCloseTo(812 / 2 + 165 + 6, 1)
        expect(bid.top).toBeCloseTo(148.1, 1)
    })
})
