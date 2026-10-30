import { describe, test, expect } from 'vitest'
import { bubbleSpot, declaredStep, seatBoxes, seatSpot, type SeatSpot } from './seatSpot'
import { EMPTY_LOCAL, boardModel, type SeatModel, type SeatPosition } from './model/boardModel'
import { cardTargets, fanPlaces, handPlaces, hudBoxes, layoutFor, tableTargets, trickSlots, type Layout } from './model/cardTargets'
import { indexOf, playTable } from '../../test/fixtures/views/table'
import { at, box, boxOf, hull, nameOf, overlap, seven, type Box } from '../../test/fixtures/layouts'

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
/** How far from `edge` towards the middle before 6 px short of one of `boxes` in the rows `y0…y1`. */
const roomBefore = (boxes: Box[], edge: number, side: 'left' | 'right', y0: number, y1: number) =>
    Math.min(Infinity, ...boxes.filter((b) => b.y0 < y1 && y0 < b.y1 && (side === 'left' ? b.x1 > edge : b.x0 < edge)).map((b) => (side === 'left' ? b.x0 - 6 - edge : edge - b.x1 - 6)))
/** The seat's plate as a style: what a bubble keeps of it. */
const plateOf = ({ left, top, transform, maxWidth }: SeatSpot) => ({ left, top, transform, maxWidth })
const TEAMS = ['mine', 'theirs'] as const
/** Four declared cards at 45 % overlap. */
const row4 = (layout: Layout) => layout.declared.w * (1 + 3 * 0.55)

describe('bubbleSpot (gameplay rules §6): a bubble by each seat plate', () => {
    test('under my partner\'s plate (and the timer bar of the seat to act), aligned as the plate; a side seat\'s where its chips go; over mine', () => {
        for (const viewport of [{ width: 1440, height: 900, dpr: 1 }, { width: 375, height: 812, dpr: 3 }, { width: 812, height: 375, dpr: 3 }]) {
            const layout = layoutFor(viewport)
            const targets = cardTargets(model, layout)
            const [me, right, partner, left] = model.seats
            expect([me.id, right.id, partner.id, left.id]).toEqual(['carol', 'dave', 'alice', 'bob'])
            expect(model.turn).toMatchObject({ playerId: 'alice' })
            const plate = (one: typeof me) => seatSpot(one, targets, layout)
            expect(bubbleSpot(me, model, targets, layout)).toEqual({ ...plateOf(plate(me)), top: plate(me).top - 4, transform: 'translateY(-100%)' })
            expect(bubbleSpot(right, model, targets, layout)).toEqual({ ...plateOf(plate(right)), top: plate(right).top + plate(right).under! })
            expect(bubbleSpot(left, model, targets, layout)).toEqual({ ...plateOf(plate(left)), top: plate(left).top + plate(left).under! })
            expect(bubbleSpot(partner, model, targets, layout)).toEqual({ ...plateOf(plate(partner)), top: plate(partner).top + 37 })
        }
    })
})

describe('seatSpot: the seat columns make room for the trick and my hand (board-fit spec §4; Ruling I)', () => {
    test('my partner upright: beside the fan\'s right edge (+8 px), the plate\'s top at the fan\'s top, as wide as the board leaves less 8 (§4.1)', () => {
        const upright = at(390, 664, 3, 'portrait', 94.67)
        const fan = fanOf(upright, 'partner')
        const spot = spotAt(upright, 'partner')
        // 390×664 @3, 94.67-px cards: the fan's outer backs (±35 px, turned 180 ± 7°) end at 250.51
        expect(fan.x1).toBeCloseTo(250.512, 3)
        expect(spot.left).toBeGreaterThanOrEqual(fan.x1 + 8)
        expect(spot).toEqual({ left: expect.closeTo(258.512, 3), top: expect.closeTo(72.264, 3), maxWidth: expect.closeTo(123.488, 3) })
        for (const layout of seven().filter((one) => one.kind === 'portrait')) {
            const partner = fanOf(layout, 'partner')
            const left = partner.x1 + 8
            expect(spotAt(layout, 'partner'), nameOf(layout)).toEqual({ left: expect.closeTo(left, 9), top: expect.closeTo(partner.y0, 9), maxWidth: expect.closeTo(layout.board.w - 8 - left, 9) })
        }
    })

    test('my partner on tablets and desktops: beside the fan from 8 px under the HUD, stopping 6 px before the right seat\'s column; its cards aside where not even their corners fit (§4.3)', () => {
        for (const layout of seven().filter((one) => one.kind === 'tablet' || one.kind === 'desktop')) {
            const where = nameOf(layout)
            const fan = fanOf(layout, 'partner')
            const spot = spotAt(layout, 'partner')
            expect(spot.left, where).toBeCloseTo(fan.x1 + 8, 9)
            expect(spot.top, where).toBe(layout.hud + 8)
            expect(spot.maxWidth!, where).toBeLessThanOrEqual(layout.board.w - 8 - spot.left + 1e-9)
            // my partner's column, at whichever team's cards show, meets none of the right seat's boxes
            for (const team of TEAMS) {
                const boxes = seatBoxes(layout, tableTargets(layout), team)
                for (const a of boxes.filter((b) => b.id === 'partner')) for (const b of boxes.filter((one) => one.id === 'right')) expect(overlap(boxOf(a.box), boxOf(b.box)), `${where} ${team}`).toBe(false)
            }
        }
        // 1440×900 @1, 142/213: the right seat's column starts at 250.6, under my partner's (60…216): the board's room
        expect(spotAt(at(1440, 900, 1, 'desktop', 142, 213), 'partner')).toEqual({ left: expect.closeTo(721.024, 3), top: 60, maxWidth: expect.closeTo(390.976, 3) })
        // 1440×789 @2: the right seat's plate at 195.1 leaves 63.5 px, under four 71-px cards' corners (107): they go aside,
        // ending 8 px before the fan's left edge (407.0), and the plate and chips keep the board's room
        const mac = at(1440, 789, 2, 'desktop', 142, 213)
        expect(spotAt(mac, 'partner')).toEqual({ left: expect.closeTo(721.024, 3), top: 60, maxWidth: expect.closeTo(390.976, 3), aside: { offset: expect.closeTo(721.024 - 399.0, 1), room: expect.closeTo(390.976, 3) } })
    })

    test('landscape: my partner\'s plate beside the fan on its middle line, its chips and cards on its row; the cards on the fan\'s left side where the row lacks room, clear of the HUD (§4.2; Ruling I b)', () => {
        for (const layout of seven().filter((one) => one.kind === 'landscape')) {
            const where = nameOf(layout)
            const fan = fanOf(layout, 'partner')
            const spot = spotAt(layout, 'partner')
            const maxWidth = layout.board.w - fan.x1 - 20
            expect(plateOf(spot), where).toEqual({ left: expect.closeTo(fan.x1 + 8, 9), top: expect.closeTo((fan.y0 + fan.y1) / 2 - 13, 9), transform: undefined, maxWidth: expect.closeTo(maxWidth, 9) })
            const fits = 132 + 4 + 86 + 4 + row4(layout) <= maxWidth
            expect(spot.aside === undefined, where).toBe(fits)
            if (!spot.aside) continue
            const end = fan.x0 - 8
            expect(spot.left - spot.aside.offset, where).toBeCloseTo(end, 9)
            const huds = hudBoxes(layout).map(boxOf)
            expect(spot.aside.room, where).toBeLessThanOrEqual(roomBefore(huds, end, 'right', spot.top, spot.top + layout.declared.h) + 1e-9)
        }
        // 812×375 @2: 132 + 4 + 86 + 4 + 94.08 = 320.08 fit the 341.59 beside the fan; 667×323 @2 has 269.09, so the cards go
        // left of the fan, ending at 281.09, 99.09 px of room up to 6 px past the HUD's wrapped Challenge line (ending at 176)
        expect(spotAt(at(812, 375, 2, 'landscape', 71), 'partner')).toEqual({ left: expect.closeTo(458.410, 3), top: 54, maxWidth: expect.closeTo(341.590, 3) })
        expect(spotAt(at(667, 323, 2, 'landscape', 71), 'partner')).toEqual({ left: expect.closeTo(385.910, 3), top: 54, maxWidth: expect.closeTo(269.090, 3), aside: { offset: expect.closeTo(104.819, 3), room: expect.closeTo(99.090, 3) } })
    })

    test('the side seats upright: the plate and its timer bar above the fan, 6 px clear; the chips and cards 6 px under the fan or the side slot, whichever is lower, at the board\'s edge (§4.1; Ruling I P1)', () => {
        for (const layout of seven().filter((one) => one.kind === 'portrait')) {
            const W = layout.board.w
            for (const position of ['left', 'right'] as const) {
                const fan = fanOf(layout, position)
                const slot = box({ ...trickSlots(layout)[position], rotate: 4.8 })
                const spot = spotAt(layout, position)
                const where = `${nameOf(layout)} ${position}`
                expect(spot.top + 26 + 4 + 3, where).toBeCloseTo(fan.y0 - 6, 9)
                expect(spot.top + spot.under!, where).toBeCloseTo(Math.max(fan.y1, slot.y1) + 6, 9)
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
            }
        }
        // 375×812 @2: the left fan spans 351.96–462.98, the left slot reaches 467.80; the plate's row meets my partner's slot
        // (from 148.15), so a long name stops 6 px before it
        expect(spotAt(at(375, 812, 2, 'portrait', 71), 'left')).toEqual({ left: 8, top: expect.closeTo(312.956, 3), under: expect.closeTo(160.816, 3), maxWidth: expect.closeTo(134.150, 3) })
    })

    test('the side seats in landscape and on wide windows: the whole column beside the fan\'s inner side, 6 px clear, from the fan\'s top, clear of the side slot (§4.2, §4.3; Ruling I)', () => {
        for (const layout of seven().filter((one) => one.kind !== 'portrait')) {
            const W = layout.board.w
            for (const position of ['left', 'right'] as const) {
                const fan = fanOf(layout, position)
                const spot = spotAt(layout, position)
                const where = `${nameOf(layout)} ${position}`
                expect(spot.top, where).toBeCloseTo(fan.y0, 9)
                expect(spot.under, where).toBe(26 + 4 + 3 + 4)
                if (position === 'left') {
                    expect(spot.left, where).toBeCloseTo(fan.x1 + 6, 9)
                    expect(spot.left + spot.maxWidth!, where).toBeLessThanOrEqual(W / 2 - 6 + 1e-9)
                } else {
                    expect(spot.left, where).toBeCloseTo(fan.x0 - 6, 9)
                    expect(spot.transform, where).toBe('translateX(-100%)')
                    expect(spot.left - spot.maxWidth!, where).toBeGreaterThanOrEqual(W / 2 + 6 - 1e-9)
                }
                // a long name stops short of the trick slots in the column's rows, but never under the common 132 px
                const rows: [number, number] = [spot.top, spot.top + 37 + 24 + layout.declared.h]
                const middle = position === 'left' ? W / 2 - 6 - spot.left : spot.left - W / 2 - 6
                expect(spot.maxWidth, where).toBeCloseTo(Math.min(middle, Math.max(132, roomBefore(slotBoxes(layout).map((one) => one.box), spot.left, position, ...rows))), 9)
            }
        }
        // 812×375 @2: the left fan ends at 50.59; its slot, from 316.94, leaves 254.36 px
        expect(spotAt(at(812, 375, 2, 'landscape', 71), 'left')).toEqual({ left: expect.closeTo(56.589, 3), top: expect.closeTo(150.735, 3), under: 37, maxWidth: expect.closeTo(254.361, 3) })
    })

    test('me: upright over my pile and under the side seats\' columns at their common size, but never onto my hand; on wide windows over my pile, as today; in landscape at the bottom left, beside my hand (§4.1, §4.2; Rulings I P1, O)', () => {
        for (const layout of seven()) {
            const targets = tableTargets(layout)
            const spot = seatSpot(seat('me'), targets, layout)
            const pile = targets.piles.A
            const pileTop = pile.top + (pile.height * (1 - pile.scale)) / 2
            const pileLeft = pile.left + (pile.width * (1 - pile.scale)) / 2
            const today = { left: Math.max(12, pileLeft - 4), top: Math.max(layout.hud + 8, pileTop - 34) }
            const where = nameOf(layout)
            // my declared cards over my plate: up to the middle and 6 px before any trick slot in their rows (Ruling N)
            const above = (top: number) => Math.min(layout.board.w / 2 - 6 - today.left, roomBefore(slotBoxes(layout).map((one) => one.box), today.left, 'left', top - 4 - layout.declared.h, top))
            if (layout.kind === 'tablet' || layout.kind === 'desktop') {
                expect(spot, where).toEqual({ ...today, above: expect.closeTo(above(today.top), 9) })
            } else if (layout.kind === 'portrait') {
                // the side seat's two chip lines and four cards (or its two lines and my four cards over my plate), then 4 px;
                // but my plate and its timer bar stay 6 px over my hand's cards
                const left = spotAt(layout, 'left')
                const handTop = Math.min(...handPlaces(layout, 8).map((card) => box(card).y0))
                const top = Math.max(today.top, Math.min(left.top + left.under! + 44 + 4 + layout.declared.h + 4, handTop - 6 - 33))
                // my chips start past my declared cards' room and run to 8 px before the board's edge from my plate at its widest
                const room = above(top)
                expect(spot, where).toEqual({ left: today.left, top, above: expect.closeTo(room, 9), beside: { from: expect.closeTo(room + 4, 9), room: expect.closeTo(layout.board.w - 8 - (12 + Math.max(140, room) + 4), 9) } })
            } else {
                const top = layout.board.h - 8 - 33
                const rows: [number, number] = [top - 4 - (20 + 4 + layout.declared.h), top + 33]
                const hand = handPlaces(layout, 8).map(box)
                const room = Math.min(layout.board.w / 2 - 6 - 12, roomBefore(slotBoxes(layout).map((one) => one.box), 12, 'left', ...rows), roomBefore(hand, 12, 'left', ...rows))
                expect(spot, where).toEqual({ left: 12, top, maxWidth: expect.closeTo(room, 9) })
            }
        }
        // 812×375 @2: my hand's first card, turned −7.7°, starts at 182.46
        expect(spotAt(at(812, 375, 2, 'landscape', 71), 'me')).toEqual({ left: 12, top: 334, maxWidth: expect.closeTo(164.456, 3) })
        // 375×553 @2: the side seats' columns from 344.27 would want my plate at 443.77; my hand (from 459.50) holds it at
        // 420.50; my declared cards stop 6 px before the me slot (from 148.15), my chips start at 146.15 + 12, 211 px wide
        expect(spotAt(at(375, 553, 2, 'portrait', 71), 'me')).toEqual({ left: 12, top: expect.closeTo(420.5, 1), above: expect.closeTo(130.150, 3), beside: { from: expect.closeTo(134.150, 3), room: 211 } })
    })

    test('at 667×323 @2 my plate and its chips and declared cards meet none of the left seat\'s boxes (seatBoxes), whichever team\'s cards show (§4.2)', () => {
        const layout = at(667, 323, 2, 'landscape', 71)
        for (const team of TEAMS) {
            const boxes = seatBoxes(layout, tableTargets(layout), team)
            const mine = boxes.filter((one) => one.id === 'me').map((one) => boxOf(one.box))
            const left = boxes.filter((one) => one.id === 'left').map((one) => boxOf(one.box))
            expect(mine.length, team).toBe(2)
            expect(left.length, team).toBe(2)
            for (const a of mine) for (const b of left) expect(overlap(a, b), `${team}: ${JSON.stringify(a)} ${JSON.stringify(b)}`).toBe(false)
        }
    })
})

describe('seatBoxes: each seat\'s common column (board-fit spec §3.2): the plate, one row of chips, up to four declared cards', () => {
    test('375×812 @2: the plate 26 tall with its timer bar (4 + 3), a 20-px chip row (Chip.tsx Tag: h-5), two under a portrait side fan, 4-px gaps, 132 wide; four 35.5-px declared cards at 45 % overlap for one team only, alone as wide as their row', () => {
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
        const round = (r: number[]) => r.map((n) => Number(n.toFixed(3)))
        expect(mine.map((one) => one.id)).toEqual(['me', 'me', 'right', 'right', 'partner', 'left', 'left'])
        expect(mine.map(rect)).toEqual([
            // my plate and its timer, my chips beside it as far as they may run; my declared cards over it, their row wide
            [12, me.top, 375 - 8 - 12, 33],
            [12, me.top - 4 - 47.5, row, 47.5],
            // the right seat's plate and timer above its fan, its chips under it, right-aligned at its edge
            [right.left - 132, right.top, 132, 33],
            // two chip lines under the fan (Ruling O: its Zvanja chip and "No challenge" don't fit one line before the me slot)
            [right.left - 132, right.top + right.under!, 132, 44],
            // my partner's column beside the fan: plate, timer, chips, declared cards; as wide as the board leaves
            [partner.left, partner.top, partner.maxWidth!, 33 + 24 + 4 + 47.5],
            [8, left.top, 132, 33],
            [8, left.top + left.under!, 132, 44],
        ].map(round))
        expect(partner.maxWidth).toBeLessThan(132)
        expect(theirs.map((one) => one.id)).toEqual(['me', 'right', 'right', 'partner', 'left', 'left'])
        expect(theirs.map(rect)).toEqual([
            [12, me.top, 375 - 8 - 12, 33],
            [right.left - 132, right.top, 132, 33],
            [right.left - 132, right.top + right.under!, 132, 44 + 4 + 47.5],
            [partner.left, partner.top, partner.maxWidth!, 57],
            [8, left.top, 132, 33],
            [8, left.top + left.under!, 132, 95.5],
        ].map(round))
    })

    test('the declared cards\' row widens their box where four of them need more than 132 px (2560×1300: 142-px cards, 376.3 px); never narrower than four 12-px corners', () => {
        const layout = at(2560, 1300, 1, 'desktop', 213, 284)
        expect(layout.declared.w).toBe(142)
        const right = seatBoxes(layout, tableTargets(layout), 'theirs').filter((one) => one.id === 'right')
        const spot = spotAt(layout, 'right')
        // the plate's box stays 132; the chips and cards beside the fan run 376.3 leftwards from the column's edge
        expect(right.map((one) => [one.box.x, one.box.w])).toEqual([[spot.left - 132, 132], [expect.closeTo(spot.left - 142 * 2.65, 9), expect.closeTo(142 * 2.65, 9)]])
        expect(right[1].box.h).toBeCloseTo(20 + 4 + 190, 9)
    })

    test('landscape: my partner\'s row on one line where it fits; its cards aside, the plate and a chip on the row, where not; my chips and declared cards over my plate', () => {
        const wide = at(812, 375, 2, 'landscape', 71)
        const partner = spotAt(wide, 'partner')
        const one = seatBoxes(wide, tableTargets(wide), 'mine').filter((b) => b.id === 'partner')
        // 132 + 4 + 86 + 4 + 94.08 = 320.08 ≤ 341.59: one line as tall as the cards, the timer bar under it
        expect(one).toEqual([{ id: 'partner', box: { x: partner.left, y: partner.top, w: expect.closeTo(132 + 4 + 86 + 4 + 35.5 * 2.65, 9), h: 47.5 + 7 } }])
        const narrow = at(667, 323, 2, 'landscape', 71)
        const aside = spotAt(narrow, 'partner')
        expect(seatBoxes(narrow, tableTargets(narrow), 'mine').filter((b) => b.id === 'partner')).toEqual([
            { id: 'partner', box: { x: aside.left, y: aside.top, w: 132 + 4 + 86, h: 33 } },
            { id: 'partner', box: { x: expect.closeTo(aside.left - aside.aside!.offset - 35.5 * 2.65, 9), y: aside.top, w: expect.closeTo(35.5 * 2.65, 9), h: 47.5 } },
        ])
        const me = spotAt(narrow, 'me')
        expect(seatBoxes(narrow, tableTargets(narrow), 'mine').filter((b) => b.id === 'me').map((b) => [b.box.x, b.box.y, b.box.w, b.box.h])).toEqual([
            // up to my hand's first card, 6 px clear (91.96 px), never under a common chip
            [12, me.top, expect.closeTo(91.956, 3), 33],
            [12, me.top - 4 - (20 + 4 + 47.5), expect.closeTo(91.956, 3), 20 + 4 + 47.5],
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
