import { describe, test, expect } from 'vitest'
import { bubbleSpot, declaredStep, seatBoxes, seatSpot, type SeatSpot } from './seatSpot'
import { EMPTY_LOCAL, boardModel, type SeatModel, type SeatPosition } from './model/boardModel'
import { cardTargets, fanPlaces, fanStepOf, handPlaces, hudBoxes, hudRightGroup, tableTargets, trickSlots, type Layout } from './model/cardTargets'
import { layoutFor } from './model/fit'
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

    test('landscape: my partner\'s plate beside the fan on its middle line, or 6 px under the HUD\'s right group where that leaves no room for a plate (Ruling AB); its chips and cards on its row; the cards on the fan\'s left side, on the plate\'s row and never higher than 6 px under the HUD\'s lines (the left group\'s first line reaches 52 px down: Ruling AE), where the row lacks room, clear of the HUD (§4.2; Ruling I b)', () => {
        // short desktop windows at 150 % or 200 % count as landscape: there the plate stays on the fan's middle line, and
        // these send its cards aside
        const wide = [{ width: 1280, height: 480, dpr: 1.5 }, { width: 1024, height: 400, dpr: 2 }, { width: 1100, height: 420, dpr: 2 }].map(layoutFor)
        // Android sideways at the owner's exact 71 px; 1366×500 @1.75, the plate on the middle line with its cards on its row
        const more = [{ width: 915, height: 332, dpr: 2.625 }, { width: 851, height: 329, dpr: 2.75 }, { width: 1366, height: 500, dpr: 1.75 }].map(layoutFor)
        for (const layout of [...seven().filter((one) => one.kind === 'landscape'), ...more, ...wide]) {
            const where = nameOf(layout)
            const fan = fanOf(layout, 'partner')
            const spot = spotAt(layout, 'partner')
            const group = hudRightGroup(layout)!
            const middle = (fan.y0 + fan.y1) / 2 - 13
            const before = group.x - 6 - (fan.x1 + 8)
            const dropped = middle < group.y + group.h && before < 132
            const maxWidth = Math.min(layout.board.w - fan.x1 - 20, dropped || middle >= group.y + group.h ? Infinity : before)
            expect(plateOf(spot), where).toEqual({ left: expect.closeTo(fan.x1 + 8, 9), top: expect.closeTo(dropped ? group.y + group.h + 6 : middle, 9), transform: undefined, maxWidth: expect.closeTo(maxWidth, 9) })
            const fits = 132 + 4 + 86 + 4 + row4(layout) <= maxWidth
            if (!fits) expect(spot.aside, where).toBeDefined()
            // the cards aside: on the plate's row; where the plate stays on the fan's middle line above 58, 6 px under the
            // HUD's lines instead (never rising beside the HUD's left group)
            const under = group.y + group.h + 6
            if (spot.aside) expect(spot.aside.drop, where).toBe(spot.top < under ? under - spot.top : undefined)
            if (!spot.aside) continue
            const end = fan.x0 - 8
            expect(spot.left - spot.aside.offset, where).toBeCloseTo(end, 9)
            const huds = hudBoxes(layout).map(boxOf)
            const y0 = spot.top + (spot.aside.drop ?? 0)
            expect(spot.aside.room, where).toBeLessThanOrEqual(roomBefore(huds, end, 'right', y0, y0 + layout.declared.h) + 1e-9)
            // as seatBoxes counts them, whichever team's cards show: on no HUD box
            for (const team of TEAMS) {
                for (const one of seatBoxes(layout, tableTargets(layout), team).filter((b) => b.id === 'partner')) {
                    for (const hud of huds) expect(overlap(boxOf(one.box), hud), `${where} ${team} ${JSON.stringify(one.box)} ${JSON.stringify(hud)}`).toBe(false)
                }
            }
        }
        // the wide ones: the plate stays on the fan's middle line (44), beside the right group; the cards aside go 6 px under
        // the HUD's lines, 58 px from the top
        for (const layout of wide) {
            const spot = spotAt(layout, 'partner')
            expect(spot.top, nameOf(layout)).toBeLessThan(58)
            expect(spot.aside, nameOf(layout)).toBeDefined()
            expect(spot.top + spot.aside!.drop!, nameOf(layout)).toBe(58)
        }
        // 812×375 @2: 132 + 4 + 86 + 4 + 94.08 = 320.08 fit the 341.59 beside the fan; 667×323 @2 has 269.09, so the cards go
        // left of the fan, ending at 281.09, 99.09 px of room up to 6 px past the HUD's wrapped Challenge line (ending at 176).
        // The plate's top 44: the fan's middle 13 px under the 44-px HUD (owner 2026-11-01, board-fit spec §4.2: Ruling Q's
        // 17 made it 48; at first 23, 54)
        // since Ruling AB 6 px under the HUD's right group (its hit areas reach 52); since Ruling AE the cards aside stay on
        // that row too (14 px higher, on the fan's middle line, they met the left group's first line)
        expect(spotAt(at(812, 375, 2, 'landscape', 71), 'partner')).toEqual({ left: expect.closeTo(458.410, 3), top: 58, maxWidth: expect.closeTo(341.590, 3) })
        expect(spotAt(at(667, 323, 2, 'landscape', 71), 'partner')).toEqual({ left: expect.closeTo(385.910, 3), top: 58, maxWidth: expect.closeTo(269.090, 3), aside: { offset: expect.closeTo(104.819, 3), room: expect.closeTo(99.090, 3) } })
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
                // the column starts where a fan at the partner's step would: on desktops the side fans step closer (12 per 71
                // of back, not 16), so the drawn fan starts lower, still beside the column, and the column stays put
                const fan = hull(fanPlaces(layout, position, 8, fanStepOf(layout)).map(box))
                const spot = spotAt(layout, position)
                const where = `${nameOf(layout)} ${position}`
                expect(spot.top, where).toBeCloseTo(fan.y0, 9)
                expect(fanOf(layout, position).y0, where).toBeGreaterThanOrEqual(spot.top - 1e-9)
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
        // 812×375 @2: the left fan ends at 50.59; its slot, from 316.94, leaves 254.36 px. The fan's top 148.11: the band
        // starts 4 px higher with the partner's fan and ends 4.75 px lower over the lowered hand (owner 2026-11-01, §4.2;
        // Ruling Q's 147.73, at first 150.73)
        expect(spotAt(at(812, 375, 2, 'landscape', 71), 'left')).toEqual({ left: expect.closeTo(56.589, 3), top: expect.closeTo(148.110, 3), under: 37, maxWidth: expect.closeTo(254.361, 3) })
    })

    test('me: upright over my pile and under the side seats\' columns at their common size, but never onto my hand; on wide windows over my pile, or past the left seat\'s backs where its fan reaches down beside it; in landscape at the bottom left, beside my hand (§4.1, §4.2; Rulings I P1, X)', () => {
        for (const layout of seven()) {
            const targets = tableTargets(layout)
            const spot = seatSpot(seat('me'), targets, layout)
            const pile = targets.piles.A
            const pileTop = pile.top + (pile.height * (1 - pile.scale)) / 2
            const pileLeft = pile.left + (pile.width * (1 - pile.scale)) / 2
            const today = { left: Math.max(12, pileLeft - 4), top: Math.max(layout.hud + 8, pileTop - 34) }
            const where = nameOf(layout)
            // my declared cards over my plate: up to the middle and 6 px before any trick slot in their rows (Ruling N)
            const above = (top: number, from = today.left) => Math.min(layout.board.w / 2 - 6 - from, roomBefore(slotBoxes(layout).map((one) => one.box), from, 'left', top - 4 - layout.declared.h, top))
            // the left seat's backs, 8 and 7 of them (Ruling X)
            const backs = [8, 7].flatMap((n) => fanPlaces(layout, 'left', n).map(box))
            const clearOfBacks = (b: Box) => backs.every((back) => !overlap(b, back))
            if (layout.kind === 'tablet' || layout.kind === 'desktop') {
                // over my pile at its height; past the left fan where it reaches my plate and its chips, else at the pile
                expect(spot.top, where).toBe(today.top)
                const plate = { x0: spot.left, x1: spot.left + 160, y0: spot.top, y1: spot.top + 33 + 4 + 20 }
                expect(clearOfBacks(plate), where).toBe(true)
                if (spot.left !== today.left) expect(clearOfBacks({ ...plate, x0: today.left, x1: today.left + 160 }), where).toBe(false)
                // my declared cards over it, from cardsFrom, clear of the backs too, up to the middle and the slots in their rows
                const from = spot.left + (spot.cardsFrom ?? 0)
                expect(spot.above, where).toBeCloseTo(above(spot.top, from), 9)
                expect(clearOfBacks({ x0: from, x1: from + spot.above!, y0: spot.top - 4 - layout.declared.h, y1: spot.top - 4 }), where).toBe(true)
            } else if (layout.kind === 'portrait') {
                // the side seat's chip line and four cards (or its chip line and my four cards over my plate), then 4 px; but
                // my plate and its timer bar stay 6 px over my hand's cards
                const left = spotAt(layout, 'left')
                const handTop = Math.min(...handPlaces(layout, 8).map((card) => box(card).y0))
                const top = Math.max(today.top, Math.min(left.top + left.under! + 20 + 4 + layout.declared.h + 4, handTop - 6 - 33))
                // my chips start past my declared cards' room and run to 8 px before the board's edge from my plate at its
                // widest (180: You, D, the caller's badge, the Bela badge, the no-challenge badge, the countdown; 160 before the Bela badge)
                const room = above(top)
                // my chips from a fixed place: past my declared cards' room and past my plate at its widest on my turn (224,
                // "Your turn" and its badges; owner 2026-11-03), so they never shift as it widens
                const from = Math.max(room, 224) + 4
                expect(spot, where).toEqual({ left: today.left, top, above: expect.closeTo(room, 9), beside: { from: expect.closeTo(from, 9), room: expect.closeTo(layout.board.w - 8 - (12 + from), 9) } })
            } else {
                const top = layout.board.h - 8 - 33
                const rows: [number, number] = [top - 4 - (20 + 4 + layout.declared.h), top + 33]
                const hand = handPlaces(layout, 8).map(box)
                const room = Math.min(layout.board.w / 2 - 6 - 12, roomBefore(slotBoxes(layout).map((one) => one.box), 12, 'left', ...rows), roomBefore(hand, 12, 'left', ...rows))
                expect(spot, where).toMatchObject({ left: 12, top, maxWidth: expect.closeTo(room, 9) })
                // the line of chips nearest my plate, as wide as a Zvanja 100 + 20 chip (124) where that is wider than the
                // room, stays 6 px over my hand's cards it reaches (Ruling X)
                const base = top - 4 - (spot.lift ?? 0)
                const reach = hand.filter((card) => card.x0 < 12 + Math.max(room, 124) && card.x1 > 12)
                expect(base, where).toBeLessThanOrEqual(Math.min(...reach.map((card) => card.y0)) - 6 + 1e-9)
                if (spot.lift) expect(base, where).toBeCloseTo(Math.min(...reach.map((card) => card.y0)) - 6, 9)
                // my declared cards over my chips, past the left seat's backs (Ruling X)
                const from = 12 + (spot.cardsFrom ?? 0)
                const cards = { x0: from, x1: from + (spot.above ?? room), y0: base - 20 - 4 - layout.declared.h, y1: base - 20 - 4 }
                expect(clearOfBacks(cards), where).toBe(true)
            }
        }
        // 1440×900 @1: the left fan reaches down beside my pile, so my plate starts 6 px past its backs (Ruling X; was 12)
        const wide = at(1440, 900, 1, 'desktop', 142, 213)
        expect(spotAt(wide, 'me').left).toBeCloseTo(Math.max(...fanPlaces(wide, 'left', 8).map(box).map((b) => b.x1)) + 6, 9)
        // 667×323 @2: my cards 44.59 px past my plate's left edge, past the left fan; the column 8.08 px higher for a wide chip
        // (the lowered hand sits 4.75 px lower: owner 2026-11-01; was 12.83)
        expect(spotAt(at(667, 323, 2, 'landscape', 71), 'me')).toEqual({ left: 12, top: 282, maxWidth: expect.closeTo(91.956, 3), cardsFrom: expect.closeTo(44.589, 3), above: expect.closeTo(181.861, 3), lift: expect.closeTo(8.078, 3) })
        // 812×375 @2: my hand's first card, turned −7.7°, starts at 182.46; my cards start past the left fan, which reaches
        // their rows once a second line of chips lifts them (Ruling X)
        expect(spotAt(at(812, 375, 2, 'landscape', 71), 'me')).toEqual({ left: 12, top: 334, maxWidth: expect.closeTo(164.456, 3), cardsFrom: expect.closeTo(44.589, 3), above: expect.closeTo(304.061, 3) })
        // 375×553 @2: the side seats' columns from 344.27 put my plate at 419.77, 0.73 px above my hand's limit (420.50); my
        // declared cards stop 6 px before the me slot (from 148.15); my chips start 4 px past my plate at its widest on my turn
        // (224: "Still there?" and its badges, Task M; 218 for "Your turn", owner 2026-11-03), at 228, and run 127 px to 8 px before
        // the edge
        expect(spotAt(at(375, 553, 2, 'portrait', 71), 'me')).toEqual({ left: 12, top: expect.closeTo(419.772, 3), above: expect.closeTo(130.150, 3), beside: { from: 228, room: 127 } })
    })

    test('upright my chips start past my plate at its widest on my turn, whatever it says: "Still there?" with the countdown and all four badges measures 223.7 px in Chromium ("Na tebi je!" 219.4, "Zaspal si?" 218.9, "Your turn" 214; Task M fix round 1)', () => {
        for (const layout of [at(375, 553, 2, 'portrait', 71), at(390, 664, 3, 'portrait', 94.67), at(375, 812, 2, 'portrait', 71), at(430, 739, 3, 'portrait', 94.67)]) {
            const beside = spotAt(layout, 'me').beside!
            expect(beside.from, `${layout.viewport.width}x${layout.viewport.height}`).toBeGreaterThanOrEqual(223.7 + 4)
            // and the English "Decl. 100 + 20" (109.7 px) still fits beside it
            expect(beside.room, `${layout.viewport.width}x${layout.viewport.height}`).toBeGreaterThanOrEqual(109.7)
        }
    })

    test('moved past the left fan on a wide window, my plate stops 6 px short of every trick slot (±4.8°) in its rows, at the sizes layoutFor picks over 1024–2560 × 520–1440 at dpr 1, 1.25, 1.5 and 2 (board-fit spec G1; Ruling Y)', () => {
        let moved = 0
        for (const dpr of [1, 1.25, 1.5, 2]) {
            for (let width = 1024; width <= 2560; width += 64) {
                for (let height = 520; height <= 1440; height += 40) {
                    const layout = layoutFor({ width, height, dpr })
                    if (layout.kind !== 'desktop' && layout.kind !== 'tablet') continue
                    const targets = tableTargets(layout)
                    const spot = seatSpot(seat('me'), targets, layout)
                    const pile = targets.piles.A
                    const overPile = Math.max(12, pile.left + (pile.width * (1 - pile.scale)) / 2 - 4)
                    const where = `${width}x${height}@${dpr}`
                    // a maxWidth exactly where my plate moved; seatBoxes models the plate at it, never over 180
                    expect(spot.maxWidth !== undefined, where).toBe(spot.left > overPile)
                    if (spot.maxWidth === undefined) continue
                    moved++
                    const plate = { x0: spot.left, x1: spot.left + spot.maxWidth, y0: spot.top, y1: spot.top + 33 + 4 + 20 }
                    for (const slot of slotBoxes(layout)) expect(overlap(plate, { ...slot.box, x0: slot.box.x0 - 6 + 1e-9 }), `${where} ${slot.position}`).toBe(false)
                    const mine = seatBoxes(layout, targets, 'theirs').find((one) => one.id === 'me')!.box
                    expect(mine.w, where).toBeCloseTo(Math.min(spot.maxWidth, 180), 9)
                }
            }
        }
        expect(moved).toBeGreaterThan(100)
        // 1376×820 @1, the tightest: 126.55 px before the left slot
        const tight = layoutFor({ width: 1376, height: 820, dpr: 1 })
        expect(spotAt(tight, 'me').maxWidth).toBeCloseTo(126.547, 3)
    }, 60_000)

    test('at 667×323 @2 my plate and its chips and declared cards meet none of the left seat\'s boxes (seatBoxes), whichever team\'s cards show (§4.2)', () => {
        const layout = at(667, 323, 2, 'landscape', 71)
        for (const team of TEAMS) {
            const boxes = seatBoxes(layout, tableTargets(layout), team)
            const mine = boxes.filter((one) => one.id === 'me').map((one) => boxOf(one.box))
            const left = boxes.filter((one) => one.id === 'left').map((one) => boxOf(one.box))
            // my plate, then my chips over it and (with my team's cards) my declared cards past the left fan (Ruling X)
            expect(mine.length, team).toBe(team === 'mine' ? 3 : 2)
            expect(left.length, team).toBe(2)
            for (const a of mine) for (const b of left) expect(overlap(a, b), `${team}: ${JSON.stringify(a)} ${JSON.stringify(b)}`).toBe(false)
        }
    })
})

describe('seatBoxes: each seat\'s common column (board-fit spec §3.2): the plate, one row of chips, up to four declared cards', () => {
    test('375×812 @2: the plate 26 tall with its timer bar (4 + 3), a 20-px chip row (Chip.tsx Tag: h-5), 4-px gaps, 132 wide; four 35.5-px declared cards at 45 % overlap for one team only, alone as wide as their row', () => {
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
            // its chip row under the fan ("No challenge" is a badge on the plate)
            [right.left - 132, right.top + right.under!, 132, 20],
            // my partner's column beside the fan: plate, timer, chips, declared cards; as wide as the board leaves
            [partner.left, partner.top, partner.maxWidth!, 33 + 24 + 4 + 47.5],
            [8, left.top, 132, 33],
            [8, left.top + left.under!, 132, 20],
        ].map(round))
        expect(partner.maxWidth).toBeLessThan(132)
        expect(theirs.map((one) => one.id)).toEqual(['me', 'right', 'right', 'partner', 'left', 'left'])
        expect(theirs.map(rect)).toEqual([
            [12, me.top, 375 - 8 - 12, 33],
            [right.left - 132, right.top, 132, 33],
            [right.left - 132, right.top + right.under!, 132, 20 + 4 + 47.5],
            [partner.left, partner.top, partner.maxWidth!, 57],
            [8, left.top, 132, 33],
            [8, left.top + left.under!, 132, 71.5],
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
            // my chips over it, lifted 12.83 px for a wide chip; my cards over them past the left fan (Ruling X)
            [12, expect.closeTo(me.top - 4 - me.lift! - 20, 9), expect.closeTo(91.956, 3), 20],
            [expect.closeTo(12 + me.cardsFrom!, 9), expect.closeTo(me.top - 4 - me.lift! - 20 - 4 - 47.5, 9), expect.closeTo(35.5 * 2.65, 9), 47.5],
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

describe('my seat stays put as my hand shrinks (board-fit spec anti-goal: no reflow during play; final review)', () => {
    /** A grid sample of every kind, and the windows where the review saw my plate or cards jump. */
    const sample = (): Layout[] => {
        const out: Layout[] = []
        for (const dpr of [1, 1.25, 2]) {
            for (let width = 1024; width <= 2560; width += 192) for (let height = 520; height <= 1440; height += 115) out.push(layoutFor({ width, height, dpr }))
            for (let width = 768; width < 1024; width += 64) for (let height = 600; height <= 1300; height += 175) out.push(layoutFor({ width, height, dpr }))
        }
        for (const dpr of [2, 3]) {
            for (let width = 320; width < 768; width += 56) for (let height = 520; height <= 1000; height += 120) out.push(layoutFor({ width, height, dpr }))
            for (let width = 568; width <= 1000; width += 72) for (let height = 300; height <= 500; height += 50) out.push(layoutFor({ width, height, dpr }))
        }
        for (const [width, height, dpr] of [[1920, 969, 1], [1920, 953, 1], [1680, 969, 1], [1728, 963, 2], [2560, 1335, 1], [1536, 714, 1.25], [1440, 789, 1], [1600, 789, 1]] as const) out.push(layoutFor({ width, height, dpr }))
        return out
    }

    test('seatSpot(me) and seatBoxes are the same with 1 to 8 cards in my hand, at every §7 layout and on a grid sample of every kind, though my pile drops as the hand shrinks', () => {
        const me = model.seats.find((one) => one.isMe)!
        expect(model.hand).toHaveLength(8)
        const layouts = [...seven(), ...sample()]
        expect(new Set(layouts.map((layout) => layout.kind))).toEqual(new Set(['portrait', 'landscape', 'tablet', 'desktop']))
        let dropped = 0
        for (const layout of layouts) {
            const at = (n: number) => {
                const targets = cardTargets({ ...model, hand: model.hand.slice(0, n) }, layout)
                return { spot: seatSpot(me, targets, layout), mine: seatBoxes(layout, targets, 'mine'), theirs: seatBoxes(layout, targets, 'theirs'), pile: targets.piles.A }
            }
            const full = at(8)
            for (let n = 1; n < 8; n++) {
                const now = at(n)
                const where = `${nameOf(layout)} ${n} cards`
                expect(now.spot, where).toEqual(full.spot)
                expect(now.mine, where).toEqual(full.mine)
                expect(now.theirs, where).toEqual(full.theirs)
            }
            if (at(1).pile.top !== full.pile.top) dropped++
        }
        // the pile itself still follows the hand (it sits over the hand's left end), on the windows where it lies over it
        expect(dropped).toBeGreaterThan(0)
    }, 60_000)
})
