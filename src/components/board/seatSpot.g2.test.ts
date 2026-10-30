import { describe, test, expect } from 'vitest'
import { declaredStep, seatBoxes, seatSpot } from './seatSpot'
import { fanPlaces, handPlaces, hudBoxes, tableTargets, trickSlots, type Layout } from './model/cardTargets'
import { at, box, boxOf, hull, nameOf, overlap, seven, type Box } from '../../test/fixtures/layouts'

/** Each trick slot at the widest a stable tilt makes it (tilt(): −4.8…+4.8°). */
const slotBoxes = (layout: Layout) => Object.entries(trickSlots(layout)).map(([position, slot]) => ({ position, box: box({ ...slot, rotate: 4.8 }) }))

/**
 * My full hand's exposed strips (board-fit spec G1, Ruling J): each card's part above the board's bottom edge that the
 * next card leaves uncovered (its left part, as far as the next card's left edge, in its own turn); the last card's
 * whole visible part.
 */
function strips(layout: Layout): Box[] {
    const hand = handPlaces(layout, 8)
    return hand.map((card, i) => {
        const w = i < hand.length - 1 ? hand[i + 1].left - card.left : card.width
        const cx = card.left + card.width / 2
        const cy = card.top + card.height / 2
        const r = (card.rotate * Math.PI) / 180
        const corners = [[card.left, card.top], [card.left + w, card.top], [card.left, card.top + card.height], [card.left + w, card.top + card.height]]
            .map(([x, y]) => [cx + (x - cx) * Math.cos(r) - (y - cy) * Math.sin(r), cy + (x - cx) * Math.sin(r) + (y - cy) * Math.cos(r)])
        const xs = corners.map(([x]) => x)
        const ys = corners.map(([, y]) => y)
        return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.min(Math.max(...ys), layout.board.h) }
    })
}

const show = (b: Box) => `[${[b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0].map((n) => n.toFixed(1)).join(', ')}]`
const by = (a: Box, b: Box) => `${(Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)).toFixed(1)}×${(Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)).toFixed(1)}`

/** Every box of a seat's common column that meets a trick slot, a HUD box, another seat's box or my hand's strips. */
function collisions(layout: Layout): string[] {
    const met: string[] = []
    for (const team of ['mine', 'theirs'] as const) {
        const where = `${nameOf(layout)} ${team}`
        const boxes = seatBoxes(layout, tableTargets(layout), team).map((one, i, all) => ({ ...one, part: all.slice(0, i).filter((b) => b.id === one.id).length, b: boxOf(one.box) }))
        const huds = hudBoxes(layout).map(boxOf)
        const hand = strips(layout)
        for (const one of boxes) {
            const name = `${one.id}#${one.part} ${show(one.b)}`
            for (const slot of slotBoxes(layout)) if (overlap(one.b, slot.box)) met.push(`${where}: ${name} meets slot ${slot.position} ${show(slot.box)} by ${by(one.b, slot.box)}`)
            huds.forEach((hud, i) => { if (overlap(one.b, hud)) met.push(`${where}: ${name} meets hud#${i} ${show(hud)} by ${by(one.b, hud)}`) })
            hand.forEach((strip, i) => { if (overlap(one.b, strip)) met.push(`${where}: ${name} meets my hand card ${i}'s strip ${show(strip)} by ${by(one.b, strip)}`) })
            for (const other of boxes) {
                if (other.id <= one.id || !overlap(one.b, other.b)) continue
                met.push(`${where}: ${name} meets ${other.id}#${other.part} ${show(other.b)} by ${by(one.b, other.b)}`)
            }
        }
    }
    return met
}

/**
 * The §7 layouts still open after the fix round (task-3-report.md, "Open cases"), with exactly what they meet today, so
 * a change to either shows. Every other §7 layout must meet nothing.
 */
const OPEN: Record<string, string[]> = {
    // Ruling O: a side seat's two chip lines (and its cards, or my cards over my plate) leave no room above my column
    // before my hand on the short phones (G1 kept: my plate stays 6 px over my hand)
    '375x553@2 71.00/71.00': [
        "375x553@2 71.00/71.00 mine: left#1 [8.0, 344.3, 132.0, 44.0] meets me#1 [12.0, 369.0, 94.1, 47.5] by 94.1×19.2",
        "375x553@2 71.00/71.00 theirs: me#0 [12.0, 420.5, 355.0, 33.0] meets right#1 [235.0, 344.3, 132.0, 95.5] by 132.0×19.2",
        "375x553@2 71.00/71.00 theirs: left#1 [8.0, 344.3, 132.0, 95.5] meets me#0 [12.0, 420.5, 355.0, 33.0] by 128.0×19.2",
    ],
    '390x664@3 94.67/94.67': [
        "390x664@3 94.67/94.67 mine: left#1 [8.0, 403.9, 132.0, 44.0] meets me#1 [12.0, 438.6, 124.5, 63.3] by 124.5×9.2",
        "390x664@3 94.67/94.67 theirs: me#0 [12.0, 506.0, 370.0, 33.0] meets right#1 [250.0, 403.9, 132.0, 111.3] by 132.0×9.2",
        "390x664@3 94.67/94.67 theirs: left#1 [8.0, 403.9, 132.0, 111.3] meets me#0 [12.0, 506.0, 370.0, 33.0] by 128.0×9.2",
    ],
    // never chosen: fits rejects it (its partner slot meets the partner fan; see the last test)
    '1280x720@1 142.00/213.00': [
        "1280x720@1 142.00/213.00 theirs: right#1 [630.5, 197.6, 132.0, 119.0] meets slot right [520.6, 223.0, 157.4, 201.2] by 47.5×93.6",
        "1280x720@1 142.00/213.00 theirs: left#1 [197.5, 197.6, 132.0, 119.0] meets slot left [282.0, 223.0, 157.4, 201.2] by 47.5×93.6",
    ],
}

describe('the seat columns at the board-fit §7 sizes (spec G1, G2)', () => {
    test('no seat\'s common column meets a trick slot (±4.8°), the HUD\'s boxes, another seat\'s or my hand\'s exposed strips, whichever team\'s declared cards show', () => {
        const layouts = seven().filter((layout) => !(nameOf(layout) in OPEN))
        expect(layouts).toHaveLength(18 - Object.keys(OPEN).length)
        expect(layouts.flatMap(collisions)).toEqual([])
    })

    test('the open cases meet exactly what the report lists', () => {
        for (const layout of seven().filter((one) => nameOf(one) in OPEN)) expect(collisions(layout), nameOf(layout)).toEqual(OPEN[nameOf(layout)])
    })

    test('1280×720 @1 at 142/213 is a pair fits rejects: its partner trick slot meets the partner\'s fan', () => {
        const layout = seven().find((one) => nameOf(one) === '1280x720@1 142.00/213.00')!
        const fan = hull(fanPlaces(layout, 'partner', 8).map(box))
        expect(overlap(box({ ...trickSlots(layout).partner, rotate: 4.8 }), fan)).toBe(true)
    })
})

/** tableTargets' me: my id is my position, my team A. */
const ME = { id: 'me', position: 'me', team: 'A', isMe: true, bot: false, cardsLeft: 8, current: true, dealer: true, bid: null, bela: true, challengeUsed: true } as const

describe('my own column never reaches my hand or the trick (board-fit spec G1, §3.2)', () => {
    test('upright, the rare full row (my plate at its widest with the countdown, D and the caller\'s badge; Bela, "Zvanja 100 + 20", "No challenge") wraps upwards beside my plate, clear of my hand\'s strips and every trick slot', () => {
        // the chips in caption type with 6 px each side: Bela 46, Zvanja 100 + 20 138, No challenge 113; 4 px apart
        const chips = [46, 138, 113]
        for (const layout of [at(375, 553, 2, 'portrait', 71), at(390, 664, 3, 'portrait', 94.67)]) {
            const where = nameOf(layout)
            const spot = seatSpot(ME, tableTargets(layout), layout)
            const room = spot.beside!.room
            const lines = chips.reduce((rows, w) => {
                const last = rows[rows.length - 1]
                if (last !== undefined && last + 4 + w <= room) rows[rows.length - 1] = last + 4 + w
                else rows.push(w)
                return rows
            }, [] as number[])
            expect(lines.length, where).toBe(2)
            // the plate (140 at most) and its timer bar; the chips from 4 px after it, bottom-aligned with it, rising a line a wrap
            const plate = { x0: spot.left, x1: spot.left + 140, y0: spot.top, y1: spot.top + 33 }
            const row = { x0: spot.left, x1: spot.left + 140 + 4 + room, y0: spot.top + 26 - (lines.length * 20 + (lines.length - 1) * 4), y1: spot.top + 26 }
            expect(row.x1, where).toBe(layout.board.w - 8)
            for (const mine of [plate, row]) {
                strips(layout).forEach((strip, i) => expect(overlap(mine, strip), `${where} card ${i} ${show(mine)} ${show(strip)}`).toBe(false))
                for (const slot of slotBoxes(layout)) expect(overlap(mine, slot.box), `${where} slot ${slot.position} ${show(mine)}`).toBe(false)
            }
        }
    })

    test('seven declared cards over my plate overlap more to stay within `above`, clear of every trick slot (Ruling N)', () => {
        for (const layout of [at(375, 553, 2, 'portrait', 71), at(390, 664, 3, 'portrait', 94.67), at(1440, 900, 1, 'desktop', 142, 213)]) {
            const where = nameOf(layout)
            const spot = seatSpot(ME, tableTargets(layout), layout)
            const w = layout.declared.w
            const step = declaredStep(w, 7, spot.above)
            expect(step, where).toBeGreaterThanOrEqual(12)
            const cards = { x0: spot.left, x1: spot.left + w + 6 * step, y0: spot.top - 4 - layout.declared.h, y1: spot.top - 4 }
            expect(cards.x1 - cards.x0, where).toBeLessThanOrEqual(spot.above! + 1e-9)
            for (const slot of slotBoxes(layout)) expect(overlap(cards, slot.box), `${where} slot ${slot.position} ${show(cards)} ${show(slot.box)}`).toBe(false)
        }
        // 375×553 @2: 130.15 px for seven 35.5-px cards, 15.78 apart (19.53 at 45 %); 390×664 @3: 124.5 px for 47.33-px cards, 12.86 apart
        expect(declaredStep(35.5, 7, seatSpot(ME, tableTargets(at(375, 553, 2, 'portrait', 71)), at(375, 553, 2, 'portrait', 71)).above)).toBeCloseTo((130.150 - 35.5) / 6, 3)
    })
})

describe('my chips and the side seats\' chips at their common size upright (review, Ruling O)', () => {
    /** Chips in a row `room` wide, 4 px apart, wrapped greedily: each line's width (board.css: wrap-reverse, the first line lowest). */
    const lines = (chips: number[], room: number) => chips.reduce((rows, w) => {
        const last = rows[rows.length - 1]
        if (last !== undefined && last + 4 + w <= room) rows[rows.length - 1] = last + 4 + w
        else rows.push(w)
        return rows
    }, [] as number[])

    test('a narrow plate (no D, no badge: 92.3 px in Chromium): my chips start past my declared cards\' room, so the line they wrap upwards meets neither my six or seven declared cards, nor the me slot, nor my hand', () => {
        // measured in Chromium: "Zvanja 100 + 20" 122.9, "No challenge" 113; Bela about 46
        const sets = { two: [122.9, 113], three: [46, 122.9, 113] }
        for (const layout of [at(375, 553, 2, 'portrait', 71), at(390, 664, 3, 'portrait', 94.67)]) {
            const spot = seatSpot(ME, tableTargets(layout), layout)
            const start = Math.max(spot.left + 92.3 + 4, spot.left + spot.beside!.from)
            const w = layout.declared.w
            for (const [name, chips] of Object.entries(sets)) {
                const rows = lines(chips, spot.beside!.room)
                const where = `${nameOf(layout)} ${name} chips`
                expect(rows.length, where).toBe(2)
                const boxes = rows.map((width, k) => ({ x0: start, x1: start + width, y0: spot.top + 26 - (k + 1) * 20 - k * 4, y1: spot.top + 26 - k * 20 - k * 4 }))
                expect(Math.max(...boxes.map((b) => b.x1)), where).toBeLessThanOrEqual(layout.board.w - 8)
                for (const n of [6, 7]) {
                    const cards = { x0: spot.left, x1: spot.left + w + (n - 1) * declaredStep(w, n, spot.above), y0: spot.top - 4 - layout.declared.h, y1: spot.top - 4 }
                    for (const line of boxes) expect(overlap(line, cards), `${where}, ${n} cards: ${show(line)} ${show(cards)}`).toBe(false)
                }
                for (const line of boxes) {
                    for (const slot of slotBoxes(layout)) expect(overlap(line, slot.box), `${where} slot ${slot.position}`).toBe(false)
                    strips(layout).forEach((strip, i) => expect(overlap(line, strip), `${where} card ${i}`).toBe(false))
                }
            }
        }
    })

    test('a portrait side seat\'s chips under its fan take two lines (its Zvanja chip and "No challenge", about 203 px, against the room before the me slot), whichever team\'s cards show; my column clears them where the height allows, and stays off my hand where not', () => {
        for (const layout of seven().filter((one) => one.kind === 'portrait')) {
            const where = nameOf(layout)
            const left = seatSpot({ ...ME, id: 'left', position: 'left', team: 'B', isMe: false }, tableTargets(layout), layout)
            expect(86 + 4 + 113, where).toBeGreaterThan(left.maxWidth!)
            for (const team of ['mine', 'theirs'] as const) {
                const boxes = seatBoxes(layout, tableTargets(layout), team)
                const under = boxes.filter((one) => one.id === 'left')[1].box
                expect(under.h, `${where} ${team}`).toBeCloseTo(44 + (team === 'theirs' ? 4 + layout.declared.h : 0), 9)
                // never onto my hand
                for (const mine of boxes.filter((one) => one.id === 'me')) strips(layout).forEach((strip) => expect(overlap(boxOf(mine.box), strip), `${where} ${team}`).toBe(false))
            }
            // the short phones are open (see OPEN): the side columns reach my column there
            const met = collisions(layout).filter((line) => / meets (me|left|right)#/.test(line))
            expect(met, where).toEqual(OPEN[where] ?? [])
        }
    })
})
