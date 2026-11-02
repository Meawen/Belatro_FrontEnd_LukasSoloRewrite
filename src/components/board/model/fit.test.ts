import { describe, test, expect } from 'vitest'
import { fits, handStrips, kindOf, layoutFor, misfits } from './fit'
import { LANDSCAPE_EXACT, bandBottom, cardSize, fanPlaces, handPlaces, layoutAt, tableTargets, trickSlots, type Layout, type Viewport } from './cardTargets'
import { desktopCandidates, floorPair, phoneCandidates } from './sizes'
import { at, box, hull, nameOf, overlap, seven } from '../../../test/fixtures/layouts'

/** The §7 windows, each once (seven() names 1280×720 @1 at two pairs). */
const WINDOWS: Viewport[] = seven()
    .map((layout) => layout.viewport)
    .filter((one, i, all) => all.findIndex((other) => other.width === one.width && other.height === one.height && other.dpr === one.dpr) === i)

const named = (v: Viewport) => `${v.width}x${v.height}@${v.dpr}`
const sizes = (layout: Layout) => `${layout.kind} ${layout.trick.w.toFixed(2)}/${layout.hand.w.toFixed(2)}`

/** What layoutFor must pick by the rule (board-fit spec §3.2–§3.4): the first candidate that fits, else the floor. */
function byTheRule(viewport: Viewport): Layout {
    const kind = kindOf(viewport)
    const floor = cardSize(71, viewport.dpr)
    if (kind === 'landscape') return layoutAt(viewport, kind, floor, floor)
    if (kind === 'portrait') {
        const card = phoneCandidates(viewport.dpr).find((one) => fits(layoutAt(viewport, kind, one, one))) ?? floor
        return layoutAt(viewport, kind, card, card)
    }
    const pair = desktopCandidates(viewport.dpr).find(({ trick, hand }) => fits(layoutAt(viewport, kind, trick, hand))) ?? floorPair(viewport.dpr)
    return layoutAt(viewport, kind, pair.trick, pair.hand)
}

describe('layoutFor picks the biggest that fits (board-fit spec §3)', () => {
    test('the §3.3 examples, exactly (Ruling R): 1366×641 @1 71/142; 1440×900 and 1920×1080 @1 142/213; 2560×1300 @1 213/284; 1536×730 @1.25 113.6/170.4; 1280×600 @1.5 94.67/94.67; 1440×789 @2 106.5/142', () => {
        const examples: [number, number, number, number, number][] = [
            [1366, 641, 1, 71, 142], [1440, 900, 1, 142, 213], [1920, 1080, 1, 142, 213], [2560, 1300, 1, 213, 284],
            [1536, 730, 1.25, 113.6, 170.4], [1280, 600, 1.5, 94.67, 94.67], [1440, 789, 2, 106.5, 142],
        ]
        for (const [width, height, dpr, trick, hand] of examples) {
            const layout = layoutFor({ width, height, dpr })
            const where = `${width}x${height}@${dpr} got ${sizes(layout)}`
            expect(layout.kind, where).toBe('desktop')
            expect(layout.trick.w, where).toBeCloseTo(trick, 1)
            expect(layout.hand.w, where).toBeCloseTo(hand, 1)
            expect({ trick: layout.trick, hand: layout.hand }, where).toEqual({ trick: cardSize(trick, dpr), hand: cardSize(hand, dpr) })
        }
    })

    test('1280×600 @1.5 falls to rule 2 and 1440×789 @2 to the 1.33 pair: the bigger in-band pair\'s cross is taller than its band, so it meets the partner\'s fan and passes the band\'s bottom (§3.3, Ruling R)', () => {
        for (const layout of [at(1280, 600, 1.5, 'desktop', 94.67, 142), at(1440, 789, 2, 'desktop', 142, 213)]) {
            const found = misfits(layout)
            expect(found.some((why) => why.startsWith('slot partner') && why.includes('back:partner')), nameOf(layout)).toBe(true)
            expect(found.some((why) => why.startsWith('slot me') && why.includes('outside the band')), nameOf(layout)).toBe(true)
        }
        // nothing in the band fits 1280×600 @1.5 (its in-band pairs are 94.67/142 and bigger), so rule 2: the biggest trick
        // that fits (no bigger trick does), the tie between 1× and 2× to the bigger hand first, which doesn't fit either
        expect(desktopCandidates(1.5).filter(({ trick, hand }) => hand.w / trick.w >= 1.33 && hand.w / trick.w <= 1.67 + 1e-6).some(({ trick, hand }) => fits(at(1280, 600, 1.5, 'desktop', trick.w, hand.w)))).toBe(false)
        expect(fits(at(1280, 600, 1.5, 'desktop', 94.67, 189.33))).toBe(false)
    })

    test('phones upright (§3.2): 390×664 @3 gets 94.67 for the trick and the hand; 375×553 @2 keeps 71', () => {
        const iphone14 = layoutFor({ width: 390, height: 664, dpr: 3 })
        expect(iphone14.kind).toBe('portrait')
        expect(iphone14.trick.w).toBeCloseTo(94.67, 2)
        expect(iphone14.hand).toEqual(iphone14.trick)
        const se = layoutFor({ width: 375, height: 553, dpr: 2 })
        expect(se.trick).toEqual({ w: 71, h: 95 })
        expect(se.hand).toEqual(se.trick)
        // 106.5 doesn't fit there, so 71 is the rule's answer, not a fallback
        expect(fits(at(375, 553, 2, 'portrait', 106.5))).toBe(false)
    })

    test('phones sideways (§3.4): 812×375 @2, 667×323 @2 and 844×340 @3 keep the step nearest 71, 45 % of the hand showing (owner 2026-11-01: was half)', () => {
        for (const viewport of [{ width: 812, height: 375, dpr: 2 }, { width: 667, height: 323, dpr: 2 }, { width: 844, height: 340, dpr: 3 }]) {
            const layout = layoutFor(viewport)
            expect(layout, named(viewport)).toMatchObject({ kind: 'landscape', trick: { w: 71, h: 95 }, hand: { w: 71, h: 95 }, handShow: 0.45, exact: false })
        }
    })

    test('375×812 @2 and 430×739 @3: the biggest phone step that fits, trick and hand alike (§3.2)', () => {
        for (const viewport of [{ width: 375, height: 812, dpr: 2 }, { width: 430, height: 739, dpr: 3 }]) {
            const layout = layoutFor(viewport)
            expect(layout, named(viewport)).toEqual(byTheRule(viewport))
            expect(layout.hand, named(viewport)).toEqual(layout.trick)
            expect(fits(layout), named(viewport)).toBe(true)
            // nothing bigger among the phone steps fits
            for (const card of phoneCandidates(viewport.dpr).filter((one) => one.w > layout.trick.w + 1e-9)) {
                expect(fits(layoutAt(viewport, 'portrait', card, card)), `${named(viewport)} ${card.w}`).toBe(false)
            }
        }
    })

    test('at every §7 window layoutFor follows the rule: the first candidate that fits, else the floor', () => {
        for (const viewport of WINDOWS) expect(layoutFor(viewport), named(viewport)).toEqual(byTheRule(viewport))
    })

    test('the fixture seven() is what layoutFor picks at each §7 window, and 1280×720 @1 also at 142/213 (Ruling M)', () => {
        for (const layout of seven()) {
            if (nameOf(layout) === '1280x720@1 142.00/213.00') continue
            expect(layoutFor(layout.viewport), nameOf(layout)).toEqual(layout)
        }
    })

    test('every §7 window\'s layout fits; none falls back to the floor', () => {
        for (const viewport of WINDOWS) {
            const layout = layoutFor(viewport)
            // landscape keeps its one size (§3.4): it still has to fit
            expect(misfits(layout), `${named(viewport)} ${sizes(layout)}`).toEqual([])
        }
    })

    test('never smaller on a bigger window (§7): within one kind and density, a window at least as wide and as tall never gets a smaller trick', () => {
        const chosen = WINDOWS.map((viewport) => ({ viewport, layout: layoutFor(viewport) }))
        for (const small of chosen) {
            for (const big of chosen) {
                if (small === big || small.layout.kind !== big.layout.kind || small.viewport.dpr !== big.viewport.dpr) continue
                if (big.viewport.width < small.viewport.width || big.viewport.height < small.viewport.height) continue
                expect(big.layout.trick.w, `${named(small.viewport)} ${sizes(small.layout)} → ${named(big.viewport)} ${sizes(big.layout)}`).toBeGreaterThanOrEqual(small.layout.trick.w)
            }
        }
        // the table grows from 1440×900 to 2560×1300 (§7)
        expect(layoutFor({ width: 2560, height: 1300, dpr: 1 }).trick.w).toBeGreaterThan(layoutFor({ width: 1440, height: 900, dpr: 1 }).trick.w)
    })

    test('960×980 @1 is a tablet: no phone cards any more, no Blok column (§3.3)', () => {
        const layout = layoutFor({ width: 960, height: 980, dpr: 1 })
        expect(layout.kind).toBe('tablet')
        expect(layout.trick.w).toBeGreaterThan(71)
        expect(layout.blok).toBeNull()
        expect(layout.hand.w / layout.trick.w).toBeGreaterThanOrEqual(1)
        expect(layout.hand.w / layout.trick.w).toBeLessThanOrEqual(2)
    })

    test('wide windows: the hand 1–2× the trick, 1.33–1.67× wherever an in-band pair fits (§3.3 rule 1)', () => {
        for (const viewport of WINDOWS.filter((one) => kindOf(one) === 'desktop' || kindOf(one) === 'tablet')) {
            const layout = layoutFor(viewport)
            const ratio = layout.hand.w / layout.trick.w
            expect(ratio, named(viewport)).toBeGreaterThanOrEqual(1 - 1e-9)
            expect(ratio, named(viewport)).toBeLessThanOrEqual(2 + 1e-9)
            const inBand = desktopCandidates(viewport.dpr).some(({ trick, hand }) => hand.w / trick.w >= 1.33 && hand.w / trick.w <= 1.67 + 1e-6 && fits(layoutAt(viewport, layout.kind, trick, hand)))
            if (inBand) expect(ratio, named(viewport)).toBeGreaterThanOrEqual(1.33)
            if (inBand) expect(ratio, named(viewport)).toBeLessThanOrEqual(1.67 + 1e-6)
        }
    })

    test('1280×720 @1 never gets 142/213 (Ruling M): fits rejects that pair, its partner slot meets the partner\'s fan', () => {
        const layout = layoutFor({ width: 1280, height: 720, dpr: 1 })
        expect(sizes(layout)).not.toBe('desktop 142.00/213.00')
        const rejected = at(1280, 720, 1, 'desktop', 142, 213)
        expect(fits(rejected)).toBe(false)
        expect(overlap(box({ ...trickSlots(rejected).partner, rotate: 4.8 }), hull(fanPlaces(rejected, 'partner', 8).map(box)))).toBe(true)
        expect(misfits(rejected).some((why) => why.startsWith('slot partner') && why.includes('back:partner'))).toBe(true)
    })

    test('the notch (Review Focus 3): 844×340 inside 44-px insets each side, 756×340 @3, fits', () => {
        const layout = layoutFor({ width: 756, height: 340, dpr: 3 })
        expect(layout.kind).toBe('landscape')
        expect(misfits(layout)).toEqual([])
    })

    test('extreme zoom (Review Focus 5): finite sizes within the floor and the ceiling', () => {
        for (const viewport of [{ width: 3840, height: 2000, dpr: 0.5 }, { width: 640, height: 360, dpr: 3 }, { width: 1024, height: 520, dpr: 3 }]) {
            const layout = layoutFor(viewport)
            const floor = cardSize(71, viewport.dpr).w
            for (const n of [layout.trick.w, layout.trick.h, layout.hand.w, layout.hand.h, layout.board.w, layout.board.h, layout.declared.w]) expect(Number.isFinite(n), named(viewport)).toBe(true)
            expect(layout.trick.w, named(viewport)).toBeGreaterThanOrEqual(floor - 1e-9)
            expect(layout.trick.w, named(viewport)).toBeLessThanOrEqual(Math.max(floor, 213) + 1e-9)
            expect(layout.hand.w, named(viewport)).toBeGreaterThanOrEqual(layout.trick.w)
            expect(layout.hand.w, named(viewport)).toBeLessThanOrEqual(2 * layout.trick.w + 1e-9)
        }
    })
})

describe('fits: the trick, my hand and the seat columns at a candidate size (board-fit spec G1, G2, §3.2; Rulings E, H, J)', () => {
    test('fits is exactly "misfits finds nothing", at every §7 layout and at sizes too big for their window', () => {
        const big = [at(375, 553, 2, 'portrait', 106.5), at(960, 980, 1, 'tablet', 213, 284), at(1366, 641, 1, 'desktop', 142, 213), at(1280, 720, 1, 'desktop', 142, 213)]
        for (const layout of [...seven(), ...big]) expect(fits(layout), nameOf(layout)).toBe(misfits(layout).length === 0)
        for (const layout of big) expect(fits(layout), nameOf(layout)).toBe(false)
    })

    test('every §7 layout at the spec\'s sizes fits, but for 1280×720 @1 at 142/213', () => {
        for (const layout of seven()) expect(misfits(layout), nameOf(layout)).toEqual(nameOf(layout) === '1280x720@1 142.00/213.00' ? expect.arrayContaining([expect.stringMatching(/^slot partner .* meets back:partner/)]) : [])
    })

    test('my hand\'s strips: phones max(32, .36 of the card), tablets and desktops 40 % (Ruling H); a hand too big for the width is rejected for its strip', () => {
        // 960 px can't step 284-px cards 113.6 apart: (960 − 32 − 2 · 166.2) / 7 ≈ 85
        const tablet = at(960, 980, 1, 'tablet', 213, 284)
        expect(misfits(tablet).some((why) => why.startsWith('hand step'))).toBe(true)
        // the strips run between one card's left edge and the next one's, the last card whole, cut at the board's bottom
        const layout = at(390, 664, 3, 'portrait', 94.67)
        const strips = handStrips(layout)
        const hand = handPlaces(layout, 8)
        expect(strips).toHaveLength(8)
        strips.forEach((strip) => expect(strip.y1).toBeLessThanOrEqual(664))
        expect(strips[7].x1 - strips[7].x0).toBeGreaterThan(strips[0].x1 - strips[0].x0)
        expect(strips[0].x0).toBeCloseTo(box(hand[0]).x0, 0)
    })

    test('the piles meet no fan of 7 backs (a pile draws nothing until a trick is taken, by then 7 cards a seat; a full fan of 8 over an empty pile is no case)', () => {
        // 1024×520 @1 at 142/213: my pile under the left seat's top back of 7, among its other misses
        const tight = at(1024, 520, 1, 'desktop', 142, 213)
        expect(misfits(tight)).toEqual(expect.arrayContaining([expect.stringMatching(/^pile A .* meets left's back 0 of 7 .* by 4\.2×40\.2$/)]))
        expect(fits(tight)).toBe(false)
        // 1440×900 @1 at 142/213: the left fan of 8 would reach my pile's place by 4.7×7.0, but the pile is empty then
        const wide = at(1440, 900, 1, 'desktop', 142, 213)
        const pile = box(tableTargets(wide).piles.A)
        expect(fanPlaces(wide, 'left', 8).some((back) => overlap(pile, box(back)))).toBe(true)
        expect(fanPlaces(wide, 'left', 7).some((back) => overlap(pile, box(back)))).toBe(false)
        expect(fits(wide)).toBe(true)
    })

    test('the seat columns (G2, Ruling J): 768×600 @1, a tablet, at 71/142 misses only on my column meeting the left seat\'s, so layoutFor picks 71/71 there', () => {
        expect(misfits(at(768, 600, 1, 'tablet', 71, 142))).toEqual([
            // my declared cards start past the left fan's backs (Ruling X), into the left seat's column beside the fan
            'mine: me#1 [61.7, 234.4, 188.2, 95.0] meets left [61.7, 208.0, 132.0, 33.0] by 132.0×6.6',
            'mine: me#1 [61.7, 234.4, 188.2, 95.0] meets left [61.7, 245.0, 132.0, 20.0] by 132.0×20.0',
            'theirs: me#0 [12.0, 333.4, 132.0, 57.0] meets left [61.7, 245.0, 188.2, 119.0] by 82.3×30.6',
        ])
        // 71/142 is the pair right before 71/71 in the order, and nothing before it fits either: the columns alone decide
        const order = desktopCandidates(1).map(({ trick, hand }) => `${trick.w}/${hand.w}`)
        expect(order.indexOf('71/71')).toBe(order.indexOf('71/142') + 1)
        const picked = layoutFor({ width: 768, height: 600, dpr: 1 })
        expect([picked.kind, picked.trick.w, picked.hand.w]).toEqual(['tablet', 71, 71])
    })

    test('the card backs (Ruling X): 1280×720 @1 at 142/213 names a side seat\'s plate on the partner fan\'s end back, with 8 backs; no seat\'s column meets a back at any §7 pick', () => {
        expect(misfits(at(1280, 720, 1, 'desktop', 142, 213))).toContain("mine: right#0 [630.5, 178.3, 132.0, 33.0] meets partner's back 7 of 8 [551.0, 112.5, 82.0, 102.9] by 2.5×33.0")
        for (const layout of seven().filter((one) => nameOf(one) !== '1280x720@1 142.00/213.00')) {
            expect(misfits(layout).filter((why) => /^(mine|theirs): .* meets (left|right|partner)'s back/.test(why)), nameOf(layout)).toEqual([])
        }
    })

    test('the hover lift (Rulings H, P): 1440×900 @1 at 213/284 names a lifted hand card on the left slot, and never one on my own slot', () => {
        const found = misfits(at(1440, 900, 1, 'desktop', 213, 284))
        expect(found).toContain('hover: lifted hand:0 [-0.5, 538.3, 358.9, 447.8] meets slot left [263.0, 283.3, 236.1, 301.8] by 95.4×46.8')
        expect(found.filter((why) => why.startsWith('hover:') && why.includes('meets slot me'))).toEqual([])
    })

    test('"Your turn" (Ruling E): 1366×641 @1 at 142/213 names the label on the right slot, and never on my own slot', () => {
        const found = misfits(at(1366, 641, 1, 'desktop', 142, 213))
        expect(found).toContain('your turn [463.0, 356.2, 120.0, 26.0] meets slot right [563.6, 201.2, 157.4, 201.2] by 19.4×26.0')
        expect(found.filter((why) => why.startsWith('your turn') && why.includes('meets slot me'))).toEqual([])
    })

    test('"Your turn" ([W/2 − 60, my hand\'s top − 40, 120, 26]) may meet my own slot, never the partner\'s or a side one (Ruling E)', () => {
        for (const layout of seven().filter((one) => nameOf(one) !== '1280x720@1 142.00/213.00')) {
            const handTop = Math.min(...handPlaces(layout, 8).map((card) => card.top))
            const label = { x0: layout.board.w / 2 - 60, x1: layout.board.w / 2 + 60, y0: handTop - 40, y1: handTop - 14 }
            for (const position of ['partner', 'left', 'right'] as const) {
                expect(overlap(label, box({ ...trickSlots(layout)[position], rotate: 4.8 })), `${nameOf(layout)} ${position}`).toBe(false)
            }
        }
    })

    test('a fine pointer\'s hover lift (−24 px, ×1.08; tablets too, Ruling H) may meet my own slot but no other (Ruling P): the band stops 8 px over my hand, no lift reserved', () => {
        for (const layout of seven().filter((one) => one.kind === 'tablet' || one.kind === 'desktop')) {
            const hand = handPlaces(layout, 8)
            const handTop = Math.min(...hand.map((card) => card.top))
            expect(bandBottom(layout), nameOf(layout)).toBeCloseTo(handTop - 8, 9)
            if (nameOf(layout) === '1280x720@1 142.00/213.00') continue
            const slots = trickSlots(layout)
            for (const card of hand) {
                const r = (card.rotate * Math.PI) / 180
                const lifted = box({ ...card, left: card.left + 24 * Math.sin(r), top: card.top - 24 * Math.cos(r), scale: 1.08 })
                for (const position of ['partner', 'left', 'right'] as const) expect(overlap(lifted, box({ ...slots[position], rotate: 4.8 })), `${nameOf(layout)} ${position}`).toBe(false)
            }
        }
        // 1440×900 @1 at 142/213: the lifted middle cards reach into my own slot, which is empty whenever they can lift
        const layout = at(1440, 900, 1, 'desktop', 142, 213)
        const me = box({ ...trickSlots(layout).me, rotate: 4.8 })
        const lifted = handPlaces(layout, 8).map((card) => box({ ...card, top: card.top - 24, scale: 1.08 }))
        expect(lifted.some((card) => overlap(card, me))).toBe(true)
        expect(fits(layout)).toBe(true)
    })

    test('landscape\'s flatter cross (slots 0.32 of a card apart vertically, the partner\'s fan 13 px under the HUD per 71 of back; owner 2026-11-01, after Ruling Q\'s 0.35 and 17) fits 667×323 @2, 844×340 @3, the notch\'s 756×340 @3 and 812×375 @2, "Your turn" clear of the side slots', () => {
        for (const viewport of [{ width: 667, height: 323, dpr: 2 }, { width: 844, height: 340, dpr: 3 }, { width: 756, height: 340, dpr: 3 }, { width: 812, height: 375, dpr: 2 }]) {
            const layout = layoutFor(viewport)
            expect(layout.kind, named(viewport)).toBe('landscape')
            expect(misfits(layout), named(viewport)).toEqual([])
            const slots = trickSlots(layout)
            const fanBottom = Math.max(...fanPlaces(layout, 'partner', 8).map((back) => box(back).y1))
            expect(box({ ...slots.partner, rotate: 4.8 }).y0, named(viewport)).toBeGreaterThanOrEqual(fanBottom)
            expect(box({ ...slots.me, rotate: 4.8 }).y1, named(viewport)).toBeLessThanOrEqual(bandBottom(layout))
        }
        // 667×323 @2, the tightest iPhone: the band 77.6–255.4 (177.9 px) holds the 161.4-px cross
        const tight = layoutFor({ width: 667, height: 323, dpr: 2 })
        const slots = trickSlots(tight)
        expect(box({ ...slots.me, rotate: 4.8 }).y1 - box({ ...slots.partner, rotate: 4.8 }).y0).toBeCloseTo(161.41, 1)
        expect(bandBottom(tight) - Math.max(...fanPlaces(tight, 'partner', 8).map((back) => box(back).y1))).toBeCloseTo(177.86, 1)
    })
})

/**
 * Known, not fixed (owner, 2026-11-01: "Fix common sizes"; for after the beta): 300-px-tall sideways windows at dpr 3, with
 * exactly what they miss today, so a change shows.
 */
const LANDSCAPE_OPEN: Record<string, string[]> = {
    '800x300@3': [
        "slot me [360.6, 135.1, 78.7, 100.6] outside the band [0, 44, 800.0, 232.4]",
        "your turn [340.0, 200.4, 120.0, 26.0] meets slot right [410.3, 104.7, 78.7, 100.6] by 49.7×4.9",
        "your turn [340.0, 200.4, 120.0, 26.0] meets slot left [310.9, 104.7, 78.7, 100.6] by 49.7×4.9",
        "slot partner [360.6, 74.3, 78.7, 100.6] meets back:partner:0 [355.6, 36.4, 32.8, 41.2] by 27.8×3.3",
        "slot partner [360.6, 74.3, 78.7, 100.6] meets back:partner:1 [364.2, 36.8, 31.6, 40.3] by 31.6×2.8",
        "slot partner [360.6, 74.3, 78.7, 100.6] meets back:partner:2 [372.8, 37.3, 30.3, 39.4] by 30.3×2.4",
        "slot partner [360.6, 74.3, 78.7, 100.6] meets back:partner:3 [381.5, 37.8, 29.1, 38.5] by 29.1×1.9",
        "slot partner [360.6, 74.3, 78.7, 100.6] meets back:partner:4 [389.5, 37.8, 29.1, 38.5] by 29.1×1.9",
        "slot partner [360.6, 74.3, 78.7, 100.6] meets back:partner:5 [396.8, 37.3, 30.3, 39.4] by 30.3×2.4",
        "slot partner [360.6, 74.3, 78.7, 100.6] meets back:partner:6 [404.2, 36.8, 31.6, 40.3] by 31.6×2.8",
        "slot partner [360.6, 74.3, 78.7, 100.6] meets back:partner:7 [411.6, 36.4, 32.8, 41.2] by 27.8×3.3",
        "mine: partner#1 [264.3, 44.0, 83.3, 63.3] meets slot left [310.9, 104.7, 78.7, 100.6] by 36.6×2.6",
    ],
    '740x300@3': [
        "slot me [330.6, 135.1, 78.7, 100.6] outside the band [0, 44, 740.0, 232.4]",
        "your turn [310.0, 200.4, 120.0, 26.0] meets slot right [380.3, 104.7, 78.7, 100.6] by 49.7×4.9",
        "your turn [310.0, 200.4, 120.0, 26.0] meets slot left [280.9, 104.7, 78.7, 100.6] by 49.7×4.9",
        "slot partner [330.6, 74.3, 78.7, 100.6] meets back:partner:0 [325.6, 36.4, 32.8, 41.2] by 27.8×3.3",
        "slot partner [330.6, 74.3, 78.7, 100.6] meets back:partner:1 [334.2, 36.8, 31.6, 40.3] by 31.6×2.8",
        "slot partner [330.6, 74.3, 78.7, 100.6] meets back:partner:2 [342.8, 37.3, 30.3, 39.4] by 30.3×2.4",
        "slot partner [330.6, 74.3, 78.7, 100.6] meets back:partner:3 [351.5, 37.8, 29.1, 38.5] by 29.1×1.9",
        "slot partner [330.6, 74.3, 78.7, 100.6] meets back:partner:4 [359.5, 37.8, 29.1, 38.5] by 29.1×1.9",
        "slot partner [330.6, 74.3, 78.7, 100.6] meets back:partner:5 [366.8, 37.3, 30.3, 39.4] by 30.3×2.4",
        "slot partner [330.6, 74.3, 78.7, 100.6] meets back:partner:6 [374.2, 36.8, 31.6, 40.3] by 31.6×2.8",
        "slot partner [330.6, 74.3, 78.7, 100.6] meets back:partner:7 [381.6, 36.4, 32.8, 41.2] by 27.8×3.3",
        "mine: partner#1 [234.3, 44.0, 83.3, 63.3] meets slot left [280.9, 104.7, 78.7, 100.6] by 36.6×2.6",
    ],
}

describe('phones held sideways (board-fit spec §3.4, §4.2, §7; owner 2026-11-01, "Fix common sizes")', () => {
    test('common Android windows fit, their cards drawn at exactly 71 CSS px where the crisp step nearest 71 is over 72 px (LANDSCAPE_EXACT): 915×332 @2.625 and 851×329 @2.75', () => {
        for (const viewport of [{ width: 915, height: 332, dpr: 2.625 }, { width: 851, height: 329, dpr: 2.75 }]) {
            const layout = layoutFor(viewport)
            expect(cardSize(71, viewport.dpr).w, named(viewport)).toBeGreaterThan(72)
            expect(layout, named(viewport)).toMatchObject({ kind: 'landscape', exact: true, trick: LANDSCAPE_EXACT.card, hand: LANDSCAPE_EXACT.card, back: LANDSCAPE_EXACT.card, declared: LANDSCAPE_EXACT.declared, handShow: 0.45 })
            expect(misfits(layout), named(viewport)).toEqual([])
        }
    })

    test('the iPhone windows still fit, crisp, at the step nearest 71 (71 px): 667×323 @2, 844×340 @3, 812×375 @2 and the notch\'s 756×340 @3', () => {
        for (const viewport of [{ width: 667, height: 323, dpr: 2 }, { width: 844, height: 340, dpr: 3 }, { width: 812, height: 375, dpr: 2 }, { width: 756, height: 340, dpr: 3 }]) {
            const layout = layoutFor(viewport)
            expect(layout, named(viewport)).toMatchObject({ kind: 'landscape', exact: false, trick: cardSize(71, viewport.dpr), hand: cardSize(71, viewport.dpr) })
            expect(layout.trick.w, named(viewport)).toBe(71)
            expect(misfits(layout), named(viewport)).toEqual([])
        }
    })

    test('800×300 @3 and 740×300 @3 stay open (owner 2026-11-01: known, for after the beta) and miss exactly what LANDSCAPE_OPEN lists', () => {
        for (const [name, found] of Object.entries(LANDSCAPE_OPEN)) {
            const [width, height] = name.split('@')[0].split('x').map(Number)
            expect(misfits(layoutFor({ width, height, dpr: 3 })), name).toEqual(found)
        }
    })

    test('a coarse landscape grid: from 310 px tall (dpr 2, 2.625, 2.75) or 320 (dpr 3) up to 500, every window 700–932 wide fits; just under, some does not', () => {
        const floor: [number, number][] = [[2, 310], [2.625, 310], [2.75, 310], [3, 320]]
        for (const [dpr, from] of floor) {
            for (let width = 700; width <= 932; width += 29) {
                for (let height = from; height <= 500; height += 19) expect(misfits(layoutFor({ width, height, dpr })), `${width}x${height}@${dpr}`).toEqual([])
            }
            const under = [700, 740, 800, 851, 915, 932].some((width) => misfits(layoutFor({ width, height: from - 1, dpr })).length > 0)
            expect(under, `${from - 1} px @${dpr}`).toBe(true)
        }
    })
})
