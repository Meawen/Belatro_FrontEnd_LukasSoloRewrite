import { declaredStep, seatSpot } from '../../components/board/seatSpot'
import { tableTargets, type Layout } from '../../components/board/model/cardTargets'
import type { SeatModel, SeatPosition } from '../../components/board/model/boardModel'
import type { Box } from './layouts'

/**
 * The dev board's busy column at its biggest (Ruling AB; Task 5's busy=1 with names=long): long names on every plate, so
 * each plate as wide as its column lets it (mine at its widest: 224 upright, reading "Still there?", 180 elsewhere); its Bela
 * and no-challenge badges on the plate,
 * inside its width (owner, 2026-11-03: Bela as a badge); for the team whose cards show ('mine': me and my partner;
 * 'theirs': the side seats) a "Zvanja 100 + 20" chip (122.9 px in Chromium, 124 here) and six declared cards. Each column
 * laid out as Seats.tsx and board.css lay it out: chips wrapping within the column's room (a chip wider than the room on
 * a line of its own), declared cards stepped to their room (declaredStep).
 */
const PLATE = 26
const GAP = 4
const TIMER = 3
const PLATE_ROW = PLATE + GAP + TIMER
const CHIP_ROW = 20
const MY_PLATE = 180
/** On upright phones my plate reads "Your turn" on my turn (owner, 2026-11-03), "Still there?" in its last 10 s: 224 at its widest (Task M). */
const MY_TURN_PLATE = 224
/**
 * A long name's plate at its widest: 413.6 px in Chromium (20 W's with the D, the caller's badge, the Bela and no-challenge
 * badges and the countdown; 326.3 with the two badges only; was 230). Its maxWidth caps it everywhere upright and sideways.
 */
const LONG_PLATE = 414
const ZVANJA = 124
const DECLARED = 6

export interface BusyBox {
    /** The seat's position (tableTargets' seat ids), and which part of its column. */
    id: SeatPosition
    part: 'plate' | 'chips' | 'cards'
    box: Box
}

const seat = (position: SeatPosition): SeatModel => ({
    id: position, position, team: position === 'me' || position === 'partner' ? 'A' : 'B', isMe: position === 'me',
    bot: false, cardsLeft: 8, current: true, dealer: true, bid: null, bela: true, challengeUsed: true,
})

/** Chip widths in lines within `room` px, as flex-wrap lays them: each line's width. */
function lines(chips: number[], room: number): number[] {
    const out: number[] = []
    for (const w of chips) {
        const last = out.length - 1
        if (last >= 0 && out[last] + GAP + w <= room) out[last] += GAP + w
        else out.push(w)
    }
    return out
}

const rect = (x: number, y: number, w: number, h: number): Box => ({ x0: x, x1: x + w, y0: y, y1: y + h })

/** Every seat's busy column as boxes, for the team whose declared cards show. */
export function busyBoxes(layout: Layout, declaredTeam: 'mine' | 'theirs'): BusyBox[] {
    const targets = tableTargets(layout)
    const dw = layout.declared.w
    const dh = layout.declared.h
    const out: BusyBox[] = []
    for (const position of ['me', 'right', 'partner', 'left'] as const) {
        const spot = seatSpot(seat(position), targets, layout)
        const winner = (declaredTeam === 'mine') === (position === 'me' || position === 'partner')
        const chips = winner ? [ZVANJA] : []
        const row = (room: number) => (winner ? dw + (DECLARED - 1) * declaredStep(dw, DECLARED, room) : 0)
        const add = (part: BusyBox['part'], box: Box) => out.push({ id: position, part, box })
        const room = spot.maxWidth ?? Infinity
        if (position === 'me') {
            const plate = Math.min(layout.kind === 'portrait' ? MY_TURN_PLATE : MY_PLATE, room)
            add('plate', rect(spot.left, spot.top, plate, PLATE_ROW))
            const from = spot.left + (spot.cardsFrom ?? 0)
            if (layout.kind === 'portrait') {
                // my chips beside my plate, wrapping upwards (wrap-reverse) within beside.room; my cards over my plate
                const start = spot.left + Math.max(MY_PLATE + GAP, spot.beside!.from)
                lines(chips, spot.beside!.room).forEach((w, k) => add('chips', rect(start, spot.top + PLATE - CHIP_ROW - k * (CHIP_ROW + GAP), w, CHIP_ROW)))
                if (winner) add('cards', rect(from, spot.top - GAP - dh, row(spot.above!), dh))
            } else if (layout.kind === 'landscape') {
                // my chips over my plate (wrap-reverse within maxWidth), lifted where my Zvanja chip comes first; my cards over them
                const ls = lines(chips, room)
                const base = spot.top - GAP
                ls.forEach((w, k) => add('chips', rect(spot.left, base - CHIP_ROW - k * (CHIP_ROW + GAP), w, CHIP_ROW)))
                const top = base - ls.length * (CHIP_ROW + GAP)
                if (winner) add('cards', rect(from, top - dh, row(spot.above ?? room), dh))
            } else {
                lines(chips, room).forEach((w, k) => add('chips', rect(spot.left, spot.top + PLATE_ROW + GAP + k * (CHIP_ROW + GAP), w, CHIP_ROW)))
                if (winner) add('cards', rect(from, spot.top - GAP - dh, row(spot.above!), dh))
            }
            continue
        }
        if (position === 'partner' && layout.kind === 'landscape') {
            // one row (wrapping within maxWidth): the plate, the chips, the cards unless they sit aside; the timer bar under
            const items = [Math.min(LONG_PLATE, room), ...chips, ...(winner && !spot.aside ? [row(room)] : [])]
            const heights = [PLATE, ...chips.map(() => CHIP_ROW), ...(winner && !spot.aside ? [dh] : [])]
            let x = spot.left
            let y = spot.top
            let lineH = 0
            items.forEach((w, i) => {
                if (x > spot.left && x + w > spot.left + room) {
                    x = spot.left
                    y += lineH + GAP
                    lineH = 0
                }
                add(i === 0 ? 'plate' : i <= chips.length ? 'chips' : 'cards', rect(x, y, w, heights[i]))
                x += w + GAP
                lineH = Math.max(lineH, heights[i])
            })
            if (winner && spot.aside) {
                const w = row(spot.aside.room)
                add('cards', rect(spot.left - spot.aside.offset - w, spot.top + (spot.aside.drop ?? 0), w, dh))
            }
            continue
        }
        // a column: the plate, then (under it, or `under` px down) the chips' lines and the cards, on the seat's own side
        const right = spot.transform !== undefined
        const at = (w: number) => (right ? spot.left - w : spot.left)
        const plate = Math.min(LONG_PLATE, room)
        add('plate', rect(at(plate), spot.top, plate, PLATE_ROW))
        let y = spot.top + (spot.under ?? PLATE_ROW + GAP)
        for (const w of lines(chips, room)) {
            add('chips', rect(at(w), y, w, CHIP_ROW))
            y += CHIP_ROW + GAP
        }
        if (winner) {
            const w = row(room)
            add('cards', rect(at(w), y, w, dh))
        }
    }
    return out
}
