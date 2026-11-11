import { describe, test, expect } from 'vitest'
import { BID, coachSpot, type CoachAt } from './coachSpot'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { layoutFor } from './model/fit'
import { boundsOf, fanPlaces, handPlaces, hudBoxes, tableTargets, trickSlots, yourTurnBox, type Layout } from './model/cardTargets'
import { seatBoxes } from './seatSpot'
import { busyBoxes } from '../../test/fixtures/busy'
import { boxOf, hull, overlap, type Box } from '../../test/fixtures/layouts'

// board.css as written (Vitest doesn't load CSS)
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'board.css'), 'utf8')

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
const panelBox = (layout: Layout, at: CoachAt): Box => {
    const spot = coachSpot(layout, at)
    return { x0: spot.left, x1: spot.left + spot.width, y0: spot.top, y1: spot.top + spot.maxHeight }
}

/** What the panel must leave alone (board-fit spec G1, G2), named, with the seat each belongs to. */
function things(layout: Layout, at: CoachAt): { what: string; of: string | null; box: Box }[] {
    const bidding = at !== 'play'
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
    test.each(['play', 'bidding', 'myBid'] as const)('at every checked window (%s) it stays inside the board and meets nothing but the seat it is ruled to cover: no trick slot, not my hand, no HUD control, no plate, chip or declared card (common or busy), no backs', (at) => {
        const met: string[] = []
        for (const layout of layouts) {
            const spot = coachSpot(layout, at)
            const panel = panelBox(layout, at)
            expect(panel.x0, name(layout)).toBeGreaterThanOrEqual(8)
            expect(panel.x1, name(layout)).toBeLessThanOrEqual(layout.board.w - 8)
            expect(panel.y1, name(layout)).toBeLessThanOrEqual(layout.board.h - 8)
            for (const thing of things(layout, at)) {
                if (thing.of !== null && thing.of === spot.covers) continue
                if (overlap(panel, thing.box)) met.push(`${name(layout)}: ${thing.what}`)
            }
        }
        expect(met).toEqual([])
    })

    test('its bid panel is board.css\'s .board-bid: centred at its tops; upright four 52-px suits 8 apart with 10 px around (252), Pass on its own row (150 tall with the note); elsewhere 98 tall and at least as wide as measured in Chromium (Pass beside the suits: 325.5 EN, 327.3 HR)', () => {
        expect(css).toMatch(/\.board-bid \{\s*left: 50%;\s*top: 44%;/)
        expect(css).toMatch(/\.board\[data-layout="landscape"\] \.board-bid \{\s*top: 46%;/)
        expect(css).toMatch(/\.board\[data-layout="portrait"\] \.board-bid \{\s*top: 36%;/)
        expect([BID.wide.at, BID.landscape.at, BID.portrait.at]).toEqual([0.44, 0.46, 0.36])
        expect(css).toMatch(/\.board-bid,\s*\.board-bela \{[^}]*padding: 10px;/)
        expect(css).toMatch(/\.board-bid__buttons,\s*\.board-bela__buttons \{[^}]*gap: 8px;/)
        expect(css).toMatch(/\.board\[data-layout="portrait"\] \.board-bid__buttons \{\s*display: grid;\s*grid-template-columns: repeat\(4, 52px\);/)
        expect(BID.portrait.w).toBe(4 * 52 + 3 * 8 + 2 * 10)
        // measured (.board-bid's box in Chromium, Task M fix round 1): 252 × 150.2 upright; 325.5 / 327.3 × 98.2 elsewhere
        expect(BID.portrait.h).toBeGreaterThanOrEqual(150.2)
        for (const one of [BID.landscape, BID.wide]) {
            expect(one.w).toBeGreaterThanOrEqual(327.3)
            expect(one.h).toBeGreaterThanOrEqual(98.2)
        }
    })

    test('with my bid panel up it also stays off the bid panel (centred at 36 % upright, 46 % sideways, else 44 %)', () => {
        for (const layout of layouts) {
            const { w: W, h: H } = layout.board
            const [at, width, height] = layout.kind === 'portrait' ? [0.36, 252, 150.2] : [layout.kind === 'landscape' ? 0.46 : 0.44, 327.3, 98.2]
            const bid = { x0: W / 2 - width / 2, x1: W / 2 + width / 2, y0: at * H - height / 2, y1: at * H + height / 2 }
            expect(overlap(panelBox(layout, 'myBid'), bid), name(layout)).toBe(false)
        }
    })

    test('in play it covers a seat only where the board has no free room for a lesson (Ruling 87): upright phones shorter than 375×812 my partner\'s fan and tag column, sideways phones the right seat\'s; while bidding it never covers a seat', () => {
        const covered = (at: CoachAt) => Object.fromEntries(layouts.map((layout) => [name(layout), coachSpot(layout, at).covers]))
        const play = Object.fromEntries(layouts.map((layout) => [name(layout),
            layout.kind === 'landscape' && layout.viewport.width < 1024 ? 'right' : layout.kind === 'portrait' && name(layout) !== '375x812@2' ? 'partner' : null]))
        expect(covered('play')).toEqual(play)
        expect(covered('bidding')).toEqual(Object.fromEntries(layouts.map((layout) => [name(layout), null])))
        expect(covered('myBid')).toEqual(Object.fromEntries(layouts.map((layout) => [name(layout), null])))
    })

    // Where a room under 220 × 72 is all the board has while bidding (no seat may be covered then): Task M fix round 1's
    // Brief-writer call, measured here so a change shows
    const SHORT: Record<string, Partial<Record<CoachAt, [number, number]>>> = {
        '375x553@2': { myBid: [251.5, 57.2] },
        '667x323@2': { bidding: [178.1, 90.4], myBid: [96, 78.4] },
        '844x340@3': { bidding: [178.1, 107.4], myBid: [184.5, 71.1] },
        '812x375@2': { bidding: [178.1, 142.4], myBid: [168.5, 104.4] },
        '915x332@2.625': { bidding: [399.1, 62.6], myBid: [220, 82.9] },
        '851x329@2.75': { bidding: [178.1, 96.4], myBid: [188, 81.4] },
    }

    test.each(['play', 'bidding', 'myBid'] as const)('%s: at every checked window the panel has at least 220 × 72, but where the call lists the room the board has', (at) => {
        for (const layout of layouts) {
            const spot = coachSpot(layout, at)
            const short = SHORT[name(layout)]?.[at]
            if (short) {
                expect([spot.width, spot.maxHeight].map((n) => +n.toFixed(1)), `${name(layout)} ${at}`).toEqual(short)
                continue
            }
            expect(spot.width, `${name(layout)} ${at}`).toBeGreaterThanOrEqual(220)
            expect(spot.maxHeight, `${name(layout)} ${at}`).toBeGreaterThanOrEqual(72)
        }
    })

    test('on desktops and tablets the felt\'s top-left corner: 6 px under the HUD, left of my partner\'s backs, over the left seat\'s column; 420 px wide at most', () => {
        for (const layout of layouts.filter((one) => one.kind === 'desktop' || one.kind === 'tablet')) {
            const spot = coachSpot(layout, 'play')
            expect([spot.left, spot.top], name(layout)).toEqual([8, 58])
            expect(spot.width, name(layout)).toBeLessThanOrEqual(420)
            // it stays there through the bidding: while someone else bids it keeps my bid turn's roomy place
            expect(coachSpot(layout, 'bidding'), name(layout)).toEqual(spot)
            expect(coachSpot(layout, 'myBid'), name(layout)).toEqual(spot)
        }
        // 1280×720 @1: up to 6 px before my partner's backs (403.5) and 6 px over the left seat's plate (252); the same while bidding
        for (const at of ['play', 'bidding', 'myBid'] as const) {
            const spot = coachSpot(layoutFor({ width: 1280, height: 720, dpr: 1 }), at)
            expect([spot.left, spot.top, spot.covers]).toEqual([8, 58, null])
            expect(spot.width).toBeCloseTo(403.5 - 6 - 8, 1)
            expect(spot.maxHeight).toBeCloseTo(252 - 6 - 58, 1)
        }
    })

    test('upright at 375×812 @2: in play the band between my partner\'s column and the trick, the board\'s full width; while someone else bids the felt\'s middle from under the HUD\'s Challenge column; with my bid panel up the empty trick area under it', () => {
        const layout = layoutFor({ width: 375, height: 812, dpr: 2 })
        const play = coachSpot(layout, 'play')
        expect(play.covers).toBeNull()
        expect([play.left, play.width]).toEqual([8, 359])
        expect(play.top).toBeCloseTo(186.8, 1)
        expect(play.top + play.maxHeight).toBeCloseTo(306.1, 1)
        // no trick and no bid panel: from 6 px under the Challenge column's room (152) to 6 px over the side seats' plates (313)
        const others = coachSpot(layout, 'bidding')
        expect([others.left, others.width, others.covers]).toEqual([8, 359, null])
        expect(others.top).toBeCloseTo(158, 1)
        expect(others.top + others.maxHeight).toBeCloseTo(307, 1)
        const mine = coachSpot(layout, 'myBid')
        expect(mine.covers).toBeNull()
        // 6 px past the left fan (55.7), 6 px under the bid panel (centred at 36 %, 152 tall), 6 px over the side seats' chips
        expect(mine.left).toBeCloseTo(61.7, 1)
        expect(mine.top).toBeCloseTo(0.36 * 812 + 76 + 6, 1)
        expect(mine.top + mine.maxHeight).toBeCloseTo(467.8, 1)
    })

    test('sideways at 812×375 @2 in play the right seat\'s place (Ruling 87): from its fan\'s top to 6 px over my hand, 6 px right of the trick; while bidding no seat is covered', () => {
        const layout = layoutFor({ width: 812, height: 375, dpr: 2 })
        const play = coachSpot(layout, 'play')
        expect(play.covers).toBe('right')
        expect(play.left).toBeCloseTo(495.1 + 6, 1)
        expect(play.left + play.width).toBeCloseTo(804, 1)
        expect(play.top + play.maxHeight).toBeCloseTo(314.8 - 6, 1)
        for (const at of ['bidding', 'myBid'] as const) expect(coachSpot(layout, at).covers, at).toBeNull()
    })
})
