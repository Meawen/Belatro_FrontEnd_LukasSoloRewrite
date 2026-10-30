import { describe, test, expect } from 'vitest'
import { seatBoxes } from './seatSpot'
import { fanPlaces, handPlaces, hudBoxes, tableTargets, trickSlots, type Layout } from './model/cardTargets'
import { box, boxOf, hull, nameOf, overlap, seven, type Box } from '../../test/fixtures/layouts'

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
    // the HUD's worst case (3-digit scores wrap Blok to a second line, Challenge to a third) reaches the left plate above
    // its fan: no room between the HUD's column and the fan at the floor size
    '375x553@2 71.00/71.00': [
        "375x553@2 71.00/71.00 mine: left#0 [8.0, 183.5, 132.0, 33.0] meets hud#2 [8.0, 108.0, 120.0, 94.0] by 120.0×18.5",
        "375x553@2 71.00/71.00 theirs: left#0 [8.0, 183.5, 132.0, 33.0] meets hud#2 [8.0, 108.0, 120.0, 94.0] by 120.0×18.5",
    ],
    // a pair fits rejects anyway: its partner slot meets the partner's fan (see the last test)
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
