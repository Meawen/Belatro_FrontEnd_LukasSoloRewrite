import { describe, test, expect } from 'vitest'
import { bubbleSpot, declaredStep, seatBoxes, seatSpot } from './seatSpot'
import { EMPTY_LOCAL, boardModel, type SeatModel, type SeatPosition } from './model/boardModel'
import { cardTargets, fanPlaces, layoutFor, tableTargets, trickSlots, type Layout } from './model/cardTargets'
import { indexOf, playTable } from '../../test/fixtures/views/table'
import { at, box, boxOf, hull, nameOf, overlap, seven } from '../../test/fixtures/layouts'

// carol's board at the TS frame of the call: alice, her partner, is to lead, so her plate has the turn timer
const table = playTable()
const ts = table[indexOf(table, 'call:') + 1]
const model = boardModel({ publicView: ts.private.carol.publicPart, privateView: ts.private.carol, receivedAt: ts.at, skew: 0, source: 'live' }, 'carol', EMPTY_LOCAL)

/** A seat of tableTargets' table: its id is its position, my team A. */
const seat = (position: SeatPosition): SeatModel => ({
    id: position, position, team: position === 'me' || position === 'partner' ? 'A' : 'B', isMe: position === 'me',
    bot: false, cardsLeft: 8, current: false, dealer: false, bid: null, bela: false, challengeUsed: false,
})
const spotAt = (layout: Layout, position: SeatPosition) => seatSpot(seat(position), tableTargets(layout), layout)
/** A seat's full fan of eight backs, as drawn (rotated, at its scale). */
const fanOf = (layout: Layout, position: SeatPosition) => hull(fanPlaces(layout, position, 8).map(box))
/** Each trick slot at the widest a stable tilt makes it (tilt(): −4.8…+4.8°). */
const slotBoxes = (layout: Layout) => Object.entries(trickSlots(layout)).map(([position, slot]) => ({ position, box: box({ ...slot, rotate: 4.8 }) }))
const TEAMS = ['mine', 'theirs'] as const

describe('bubbleSpot (gameplay rules §6): a bubble by each seat plate', () => {
    test('under my partner\'s plate (and the timer bar of the seat to act), aligned as the plate; a side seat\'s where its chips go, under its fan; over mine', () => {
        for (const viewport of [{ width: 1440, height: 900, dpr: 1 }, { width: 375, height: 812, dpr: 3 }, { width: 812, height: 375, dpr: 3 }]) {
            const layout = layoutFor(viewport)
            const targets = cardTargets(model, layout)
            const [me, right, partner, left] = model.seats
            expect([me.id, right.id, partner.id, left.id]).toEqual(['carol', 'dave', 'alice', 'bob'])
            expect(model.turn).toMatchObject({ playerId: 'alice' })
            const plate = (one: typeof me) => seatSpot(one, targets, layout)
            const { under: rightUnder, ...rightPlate } = plate(right)
            const { under: leftUnder, ...leftPlate } = plate(left)
            expect(bubbleSpot(me, model, targets, layout)).toEqual({ ...plate(me), top: plate(me).top - 4, transform: 'translateY(-100%)' })
            expect(bubbleSpot(right, model, targets, layout)).toEqual({ ...rightPlate, top: rightPlate.top + rightUnder! })
            expect(bubbleSpot(left, model, targets, layout)).toEqual({ ...leftPlate, top: leftPlate.top + leftUnder! })
            expect(bubbleSpot(partner, model, targets, layout)).toEqual({ ...plate(partner), top: plate(partner).top + 37 })
        }
    })
})

describe('seatSpot: the seat columns make room for the trick (board-fit spec §4)', () => {
    test('my partner beside the fan\'s right edge (+8 px), the plate\'s top at the fan\'s top, as wide as the board leaves less 8 (portrait, tablet, desktop: §4.1, §4.3)', () => {
        const upright = at(390, 664, 3, 'portrait', 94.67)
        const fan = fanOf(upright, 'partner')
        const spot = spotAt(upright, 'partner')
        // 390×664 @3, 94.67-px cards: the fan's outer backs (±35 px, turned 180 ± 7°) end at 250.51
        expect(fan.x1).toBeCloseTo(250.512, 3)
        expect(spot.left).toBeGreaterThanOrEqual(fan.x1 + 8)
        expect(spot).toEqual({ left: expect.closeTo(258.512, 3), top: expect.closeTo(72.264, 3), maxWidth: expect.closeTo(123.488, 3) })
        for (const layout of seven().filter((one) => one.kind !== 'landscape')) {
            const partner = fanOf(layout, 'partner')
            const left = partner.x1 + 8
            expect(spotAt(layout, 'partner'), nameOf(layout)).toEqual({ left: expect.closeTo(left, 9), top: expect.closeTo(partner.y0, 9), maxWidth: expect.closeTo(layout.board.w - 8 - left, 9) })
        }
    })

    test('landscape: my partner\'s plate beside the fan on its middle line, its chips and declared cards on that row (§4.2; board.css)', () => {
        for (const layout of seven().filter((one) => one.kind === 'landscape')) {
            const fan = fanOf(layout, 'partner')
            expect(spotAt(layout, 'partner'), nameOf(layout)).toEqual({
                left: expect.closeTo(fan.x1 + 8, 9), top: expect.closeTo((fan.y0 + fan.y1) / 2 - 13, 9), maxWidth: expect.closeTo(layout.board.w - fan.x1 - 20, 9),
            })
        }
        // 812×375 @2: the fan (eight backs at .4, 8 px apart) ends at 450.41; the plate's top 67 − 13
        expect(spotAt(at(812, 375, 2, 'landscape', 71), 'partner')).toEqual({ left: expect.closeTo(458.410, 3), top: 54, maxWidth: expect.closeTo(341.590, 3) })
    })

    test('the side seats, every kind: the plate above the fan (its bottom 6 px over the fan\'s top), the chips and declared cards under it (6 px under the fan\'s bottom), on the seat\'s own edge (§4.1–§4.3)', () => {
        for (const layout of seven()) {
            const W = layout.board.w
            for (const position of ['left', 'right'] as const) {
                const fan = fanOf(layout, position)
                const spot = spotAt(layout, position)
                const where = `${nameOf(layout)} ${position}`
                expect(spot.top + 26, where).toBeLessThanOrEqual(fan.y0 - 6 + 1e-9)
                expect(spot.top, where).toBeCloseTo(fan.y0 - 6 - 26, 9)
                expect(spot.top + spot.under!, where).toBeGreaterThan(fan.y1)
                expect(spot.top + spot.under!, where).toBeCloseTo(fan.y1 + 6, 9)
                // the left column starts at the left edge, the right one ends at the right edge (translateX(-100%), right-aligned)
                const centre = (fan.x0 + fan.x1) / 2
                if (position === 'left') {
                    expect(spot.left, where).toBeCloseTo(Math.max(8, centre - 24), 9)
                    expect(spot.transform, where).toBeUndefined()
                    expect(spot.left + spot.maxWidth!, where).toBeLessThanOrEqual(W / 2 - 6 + 1e-9)
                } else {
                    expect(spot.left, where).toBeCloseTo(Math.min(W - 8, centre + 24), 9)
                    expect(spot.transform, where).toBe('translateX(-100%)')
                    expect(spot.left - spot.maxWidth!, where).toBeGreaterThanOrEqual(W / 2 + 6 - 1e-9)
                }
                // a long name stops short of the trick slots its plate's row meets, but never under the common column's 132 px
                expect(spot.maxWidth, where).toBeGreaterThanOrEqual(Math.min(132, position === 'left' ? W / 2 - 6 - spot.left : spot.left - W / 2 - 6) - 1e-9)
            }
        }
        // 375×812 @2: the left fan (backs turned 90 ± 7°, 10 px apart) spans 351.96–462.98; the plate's row meets my
        // partner's slot, whose tilted box starts at 148.15, so a long name stops 6 px before it
        expect(spotAt(at(375, 812, 2, 'portrait', 71), 'left')).toEqual({ left: 8, top: expect.closeTo(319.956, 3), under: expect.closeTo(149.024, 3), maxWidth: expect.closeTo(134.150, 3) })
    })

    test('me: over my pile upright and on desktops, as today; in landscape beside my hand, right of the left seat\'s column, my chips and declared cards over my plate (§4.1, §4.2)', () => {
        for (const layout of seven()) {
            const targets = tableTargets(layout)
            const spot = seatSpot(seat('me'), targets, layout)
            const pile = targets.piles.A
            const pileTop = pile.top + (pile.height * (1 - pile.scale)) / 2
            const pileLeft = pile.left + (pile.width * (1 - pile.scale)) / 2
            const where = nameOf(layout)
            expect(spot.top, where).toBe(Math.max(layout.hud + 8, pileTop - 34))
            if (layout.kind !== 'landscape') {
                expect(spot, where).toEqual({ left: Math.max(12, pileLeft - 4), top: spot.top })
                continue
            }
            const left = spotAt(layout, 'left')
            const column = left.left + Math.min(left.maxWidth!, 132)
            expect(spot.left, where).toBe(Math.max(pileLeft - 4, column + 4))
            // my chips and declared cards over my plate stop 6 px before the board's middle and any trick slot beside them
            const rows = { y0: spot.top - 4 - (20 + 4 + layout.declared.h), y1: spot.top + 33 }
            const beside = slotBoxes(layout).filter(({ box: slot }) => slot.y0 < rows.y1 && rows.y0 < slot.y1 && slot.x1 > spot.left)
            expect(spot.maxWidth, where).toBeCloseTo(Math.min(layout.board.w / 2 - 6 - spot.left, ...beside.map(({ box: slot }) => slot.x0 - 6 - spot.left)), 9)
        }
        // 812×375 @2: the left seat's column ends at 140, my pile's left edge less 4 would be 133
        expect(spotAt(at(812, 375, 2, 'landscape', 71), 'me')).toMatchObject({ left: 144, top: 277.5 })
    })

    test('at 667×323 @2 my plate and its chips and declared cards meet none of the left seat\'s boxes (seatBoxes), whichever team\'s cards show (§4.2)', () => {
        const layout = at(667, 323, 2, 'landscape', 71)
        for (const team of TEAMS) {
            const boxes = seatBoxes(layout, tableTargets(layout), team)
            const mine = boxes.filter((one) => one.id === 'me').map((one) => boxOf(one.box))
            const left = boxes.filter((one) => one.id === 'left').map((one) => boxOf(one.box))
            expect(mine.length, team).toBeGreaterThan(0)
            expect(left.length, team).toBe(2)
            for (const a of mine) for (const b of left) expect(overlap(a, b), `${team}: ${JSON.stringify(a)} ${JSON.stringify(b)}`).toBe(false)
        }
    })
})

describe('seatBoxes: each seat\'s common column (board-fit spec §3.2): the plate, one row of chips, up to four declared cards', () => {
    test('375×812 @2: the plate 26 tall with its timer bar (4 + 3), a 20-px chip row (Chip.tsx Tag: h-5), 4-px gaps, 132 wide; four 35.5-px declared cards at 45 % overlap for one team only', () => {
        const layout = at(375, 812, 2, 'portrait', 71)
        const targets = tableTargets(layout)
        const rect = (one: { box: { x: number; y: number; w: number; h: number } }) => [one.box.x, one.box.y, one.box.w, one.box.h].map((n) => Number(n.toFixed(3)))
        const mine = seatBoxes(layout, targets, 'mine')
        const theirs = seatBoxes(layout, targets, 'theirs')
        const partner = spotAt(layout, 'partner')
        const left = spotAt(layout, 'left')
        const right = spotAt(layout, 'right')
        const me = spotAt(layout, 'me')
        const row = 35.5 + 3 * 35.5 * 0.55
        expect(mine.map((one) => one.id)).toEqual(['me', 'me', 'right', 'right', 'partner', 'left', 'left'])
        expect(mine.map(rect)).toEqual([
            // my plate, its timer and my chips under it; my declared cards over it
            [12, me.top, 132, 26 + 7 + 24],
            [12, me.top - 4 - 47.5, 132, 47.5],
            // the right seat's plate and timer above its fan, its chips under it, right-aligned at its edge
            [right.left - 132, right.top, 132, 33],
            [right.left - 132, right.top + right.under!, 132, 20],
            // my partner's column beside the fan: plate, timer, chips, declared cards; as wide as the board leaves
            [partner.left, partner.top, partner.maxWidth!, 33 + 24 + 4 + 47.5],
            [8, left.top, 132, 33],
            [8, left.top + left.under!, 132, 20],
        ].map((r) => r.map((n) => Number(n.toFixed(3)))))
        expect(partner.maxWidth).toBeLessThan(132)
        expect(row).toBeLessThan(132)
        expect(theirs.map((one) => one.id)).toEqual(['me', 'right', 'right', 'partner', 'left', 'left'])
        expect(theirs.map(rect)).toEqual([
            [12, me.top, 132, 57],
            [right.left - 132, right.top, 132, 33],
            [right.left - 132, right.top + right.under!, 132, 20 + 4 + 47.5],
            [partner.left, partner.top, partner.maxWidth!, 57],
            [8, left.top, 132, 33],
            [8, left.top + left.under!, 132, 71.5],
        ].map((r) => r.map((n) => Number(n.toFixed(3)))))
    })

    test('the declared cards\' row widens their box where four of them need more than 132 px (2560×1300: 142-px cards, 376.3 px)', () => {
        const layout = at(2560, 1300, 1, 'desktop', 213, 284)
        expect(layout.declared.w).toBe(142)
        const right = seatBoxes(layout, tableTargets(layout), 'theirs').filter((one) => one.id === 'right')
        const spot = spotAt(layout, 'right')
        // the plate's box stays 132; the chips and cards under the fan run 376.3 leftwards from the seat's edge
        expect(right.map((one) => [one.box.x, one.box.w])).toEqual([[spot.left - 132, 132], [expect.closeTo(spot.left - 142 * 2.65, 9), expect.closeTo(142 * 2.65, 9)]])
        expect(right[1].box.h).toBeCloseTo(20 + 4 + 190, 9)
    })

    test('landscape: my partner\'s row (plate, a chip, declared cards) on one line where it fits, else the chips and cards on a second; my chips and declared cards over my plate', () => {
        const wide = at(812, 375, 2, 'landscape', 71)
        const partner = spotAt(wide, 'partner')
        const one = seatBoxes(wide, tableTargets(wide), 'mine').filter((b) => b.id === 'partner')
        // 132 + 4 + 86 + 4 + 94.08 = 320.08 ≤ 341.59: one line as tall as the cards, the timer bar under it
        expect(one).toEqual([{ id: 'partner', box: { x: partner.left, y: partner.top, w: expect.closeTo(132 + 4 + 86 + 4 + 35.5 * 2.65, 9), h: 47.5 + 7 } }])
        const narrow = at(667, 323, 2, 'landscape', 71)
        const two = seatBoxes(narrow, tableTargets(narrow), 'mine').filter((b) => b.id === 'partner')
        // 269.1 px leave the cards for a second line
        expect(two.map((b) => b.box.h)).toEqual([26 + 4 + 47.5 + 7])
        const me = spotAt(narrow, 'me')
        expect(seatBoxes(narrow, tableTargets(narrow), 'mine').filter((b) => b.id === 'me').map((b) => [b.box.y, b.box.h])).toEqual([
            [me.top, 33],
            [me.top - 4 - (20 + 4 + 47.5), 20 + 4 + 47.5],
        ])
    })
})

describe('declaredStep (board-fit spec §3.2 give-way 1): a seat\'s declared cards 45 % under the next, closer where the column is narrow, down to a 12-px corner', () => {
    test('45 % overlap where they fit; closer to fill the column; never under 12 px', () => {
        expect(declaredStep(35.5, 4, 132)).toBeCloseTo(35.5 * 0.55, 9)
        expect(declaredStep(35.5, 6, undefined)).toBeCloseTo(35.5 * 0.55, 9)
        // six 47.33-px cards in a 123.49-px column: (123.49 − 47.33) / 5
        expect(declaredStep(142 / 3, 6, 123.488)).toBeCloseTo((123.488 - 142 / 3) / 5, 9)
        expect(declaredStep(71, 8, 100)).toBe(12)
        expect(declaredStep(71, 1, 50)).toBe(0)
    })
})
