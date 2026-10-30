import { describe, test, expect } from 'vitest'
import {
    bandBottom, bannerSpot, belotRow, cardSize, cardTargets, fanPlaces, fanStepOf, handPlaces, hudBoxes, layoutAt, layoutFor, tableTargets, tilt, trickCentre,
    trickSlots, type Layout, type Target, type Targets, type Viewport,
} from './cardTargets'
import { crispCardWidth } from '../../ui/cardWidth'
import { EMPTY_LOCAL, boardModel, type BoardModel, type SeatPosition } from './boardModel'
import { indexOf, playTable } from '../../../test/fixtures/views/table'
import { at, box, nameOf, overlap, seven, type Box } from '../../../test/fixtures/layouts'

/** The busiest table: my 8 cards, a 3-card trick, 8 backs at every other seat. */
function busyModel(me = 'carol'): BoardModel {
    const table = playTable()
    const call = table[indexOf(table, 'call:')]
    const priv = structuredClone(call.private[me])
    priv.publicPart.currentTrick!.plays = Object.fromEntries(
        ['alice', 'bob', 'dave'].filter((id) => id !== me).map((id) => [id, call.private[id].hand[0]]))
    priv.publicPart.currentTrick!.leadPlayerId = 'dave'
    return boardModel({ publicView: priv.publicPart, privateView: priv, receivedAt: 0, skew: 0, source: 'live' }, me, EMPTY_LOCAL)
}

const rad = (deg: number) => (deg * Math.PI) / 180

function checkFit(viewport: Viewport, minVisible: number) {
    const model = busyModel()
    const layout = layoutFor(viewport)
    const { w: W, h: H } = layout.board
    const t: Targets = cardTargets(model, layout)
    const hand = model.hand.map((card) => t.cards[card.id])
    const trick = model.trick!.plays.map((play) => t.cards[play.id])
    const backs = Object.entries(t.cards).filter(([id]) => id.startsWith('back:')).map(([, target]) => target)
    expect(hand).toHaveLength(8)
    expect(trick).toHaveLength(3)
    expect(backs).toHaveLength(24)
    // everything is on screen; hand cards may run off the bottom edge only
    for (const target of [...hand, ...trick, ...backs, t.piles.A, t.piles.B]) {
        const b = box(target)
        expect(b.x0).toBeGreaterThanOrEqual(0)
        expect(b.x1).toBeLessThanOrEqual(W)
        expect(b.y0).toBeGreaterThanOrEqual(layout.kind === 'landscape' ? 0 : layout.hud)
        if (!hand.includes(target)) expect(b.y1).toBeLessThanOrEqual(H)
    }
    // every hand card exposes a strip minVisible px tall and, on phones, max(32, 0.36 of its width) px wide; on
    // desktops 40 % of its width (board-fit spec §3.5, redesign spec §5.6.3)
    const strip = layout.kind === 'desktop' ? 0.4 * layout.hand.w : Math.max(32, 0.36 * layout.hand.w)
    hand.forEach((card, i) => {
        if (i < hand.length - 1) expect(hand[i + 1].left - card.left).toBeGreaterThanOrEqual(strip)
        expect(H - card.top).toBeGreaterThanOrEqual(minVisible)
    })
    // the regions never cover each other: hand, trick, each seat's backs, the piles
    const handTop = Math.min(...hand.map((card) => card.top))
    trick.forEach((card) => expect(box(card).y1).toBeLessThan(handTop))
    const groups: Box[][] = [
        trick.map(box),
        ...['alice', 'bob', 'dave'].map((id) => Object.entries(t.cards).filter(([key]) => key.startsWith(`back:${id}:`)).map(([, target]) => box(target))),
        [box(t.piles.A)], [box(t.piles.B)],
        hand.map((card) => box({ ...card, rotate: 0 })),
    ]
    groups.forEach((group, i) => groups.slice(i + 1).forEach((other) =>
        group.forEach((a) => other.forEach((b) => expect(overlap(a, b)).toBe(false)))))
    return { layout, targets: t, model }
}

describe('layoutFor (spec §5.6, §3.6)', () => {
    test('landscape at height ≤ 500 whatever the width; desktop from 1024; portrait below 768, tablet up to 1023', () => {
        expect(layoutFor({ width: 812, height: 375, dpr: 3 }).kind).toBe('landscape')
        expect(layoutFor({ width: 1280, height: 480, dpr: 1 }).kind).toBe('landscape')
        expect(layoutFor({ width: 1440, height: 900, dpr: 1 }).kind).toBe('desktop')
        expect(layoutFor({ width: 375, height: 812, dpr: 3 }).kind).toBe('portrait')
        expect(layoutFor({ width: 820, height: 1180, dpr: 2 }).kind).toBe('tablet')
    })

    test('desktop: the board area up to 1100 px and the 320-px Bela Blok column', () => {
        const layout = layoutFor({ width: 1440, height: 900, dpr: 1 })
        expect(layout.board).toEqual({ x: 10, y: 0, w: 1100, h: 900 })
        expect(layout.blok).toEqual({ x: 1110, y: 0, w: 320, h: 900 })
        expect(layoutFor({ width: 1200, height: 800, dpr: 1 }).board.w).toBe(880)
        expect(layoutFor({ width: 375, height: 812, dpr: 3 }).blok).toBeNull()
    })

    test('card sizes per density: whole device pixels per art pixel', () => {
        expect(layoutFor({ width: 375, height: 812, dpr: 3 })).toMatchObject({ hand: { w: 71, h: 95 }, trick: { w: 71, h: 95 }, backScale: 0.5 })
        expect(layoutFor({ width: 812, height: 375, dpr: 2 })).toMatchObject({ hand: { w: 71, h: 95 }, backScale: 0.4 })
        expect(layoutFor({ width: 1440, height: 900, dpr: 2 })).toMatchObject({ hand: { w: 106.5, h: 142.5 }, trick: { w: 106.5, h: 142.5 } })
        expect(layoutFor({ width: 1440, height: 900, dpr: 1 })).toMatchObject({ hand: { w: 142, h: 190 }, trick: { w: 71, h: 95 } })
        // a non-integer ratio: 3 device px per art px, the size nearest the intended 71
        const pixel = cardSize(71, 2.625)
        expect(pixel.w * 2.625).toBeCloseTo(213)
        expect(pixel.h * 2.625).toBeCloseTo(285)
        expect(cardSize(71, 1.25).w * 1.25).toBeCloseTo(71)
    })
})

describe('layoutAt: the whole layout at given card sizes (board-fit spec §3)', () => {
    test('2560×1300 @1 at 213/284: the board 1100 × 284/142 = 2200 wide, centred left of Bela Blok\'s column; the backs drawn at half the trick (§3.3)', () => {
        const layout = at(2560, 1300, 1, 'desktop', 213, 284)
        expect(layout).toMatchObject({ kind: 'desktop', trick: { w: 213, h: 285 }, hand: { w: 284, h: 380 }, backScale: 0.5, hud: 52, handShow: 0.8 })
        expect(layout.board).toEqual({ x: 20, y: 0, w: 2200, h: 1300 })
        expect(layout.blok).toEqual({ x: 2220, y: 0, w: 320, h: 1300 })
        expect(layout.back).toEqual(layout.trick)
        expect(layout.back.w * layout.backScale).toBe(106.5)
        // a hand no bigger than 142 keeps the 1100 cap; a narrow window gives the board what Blok leaves
        expect(at(1440, 900, 2, 'desktop', 106.5).board).toEqual({ x: 10, y: 0, w: 1100, h: 900 })
        expect(at(1536, 730, 1.25, 'desktop', 113.6, 170.4).board.w).toBe(1536 - 320)
    })

    test('phones and tablets: the whole window, no Blok column; the phone back on phones, the trick card on a tablet; scale .4, a 44-px HUD and half a hand card in landscape (§3.2–§3.4)', () => {
        const upright = at(390, 664, 3, 'portrait', 94.67)
        expect(upright).toMatchObject({ kind: 'portrait', board: { x: 0, y: 0, w: 390, h: 664 }, blok: null, back: { w: 71, h: 95 }, backScale: 0.5, hud: 52, handShow: 0.8 })
        expect(upright.trick.w).toBeCloseTo(94.67, 2)
        expect(upright.hand).toEqual(upright.trick)
        expect(at(844, 340, 3, 'landscape', 71)).toMatchObject({ board: { x: 0, y: 0, w: 844, h: 340 }, blok: null, back: { w: 71, h: 95 }, backScale: 0.4, hud: 44, handShow: 0.5 })
        const tablet = at(960, 980, 1, 'tablet', 142, 213)
        expect(tablet).toMatchObject({ board: { x: 0, y: 0, w: 960, h: 980 }, blok: null, backScale: 0.5, hud: 52, handShow: 0.8 })
        expect(tablet.back).toEqual(tablet.trick)
    })

    test('layoutFor keeps today\'s sizes through layoutAt (Task 4 swaps the size rule); a retina desktop\'s backs follow its trick (§3.3)', () => {
        for (const viewport of [{ width: 375, height: 812, dpr: 3 }, { width: 812, height: 375, dpr: 2 }, { width: 820, height: 1180, dpr: 2 }, { width: 1440, height: 900, dpr: 1 }, { width: 1440, height: 900, dpr: 2 }]) {
            const today = layoutFor(viewport)
            expect(layoutAt(viewport, today.kind, today.trick, today.hand), `${viewport.width}@${viewport.dpr}`).toEqual(today)
        }
        expect(layoutFor({ width: 1440, height: 900, dpr: 2 }).back).toEqual({ w: 106.5, h: 142.5 })
        expect(layoutFor({ width: 1440, height: 900, dpr: 1 }).back).toEqual({ w: 71, h: 95 })
    })

    test('declared cards: crisp, the step nearest half the trick card, never narrower than the backs as drawn (§3.5)', () => {
        expect(at(375, 812, 2, 'portrait', 71).declared).toEqual({ w: 35.5, h: 47.5 })
        expect(at(390, 664, 3, 'portrait', 94.67).declared.w).toBeCloseTo(142 / 3, 9)
        expect(at(2560, 1300, 1, 'desktop', 213, 284).declared).toEqual({ w: 142, h: 190 })
        expect(at(1536, 730, 1.25, 'desktop', 113.6, 170.4).declared.w).toBeCloseTo(56.8, 9)
        // a trick card whose half is under the backs as drawn (35.5): the next crisp step up, not 23.67
        const small = at(375, 812, 3, 'portrait', 142 / 3)
        expect(small.declared.w).toBeCloseTo(142 / 3, 9)
        for (const layout of seven()) {
            const { w, h } = layout.declared
            const s = (w * layout.viewport.dpr) / 71
            expect(w, nameOf(layout)).toBeGreaterThanOrEqual(layout.back.w * layout.backScale)
            expect(Math.abs(s - Math.round(s)), nameOf(layout)).toBeLessThan(1e-9)
            expect(h, nameOf(layout)).toBeCloseTo((95 * w) / 71, 9)
        }
    })
})

describe('distances scale with the card size (board-fit spec §3.3, §3.5)', () => {
    test('the hand step: 36/71 of the hand card upright, 52/71 sideways, 0.59 on desktops, or less where the board is narrow', () => {
        const step = (layout: Layout) => { const hand = handPlaces(layout, 8); return hand[1].left - hand[0].left }
        expect(step(at(375, 812, 2, 'portrait', 71))).toBe(36)
        expect(step(at(812, 375, 2, 'landscape', 71))).toBe(52)
        expect(step(at(2560, 1300, 1, 'desktop', 213, 284))).toBeCloseTo(0.59 * 284, 9)
        // 960 px can't take 213 × 36/71 = 108: the eight fill the board less 16 px each side
        expect(step(at(960, 980, 1, 'tablet', 142, 213))).toBeCloseTo(96.962, 3)
        expect(handPlaces(at(375, 812, 2, 'portrait', 71), 1)).toEqual([{ left: 375 / 2 - 35.5, top: 812 - 76, width: 71, height: 95, rotate: 0, scale: 1, z: 0 }])
    })

    test('the fan step is 10 px per 47.5 px of the back as drawn (16 on desktop); the side insets and the partner\'s drop under the HUD follow the back\'s width / 71', () => {
        const big = at(2560, 1300, 1, 'desktop', 213, 284)
        expect(fanStepOf(big)).toBe(48)
        expect(fanStepOf(at(1440, 900, 1, 'desktop', 71, 142))).toBe(16)
        expect(fanStepOf(at(375, 812, 2, 'portrait', 71))).toBe(10)
        expect(fanStepOf(at(960, 980, 1, 'tablet', 142, 213))).toBe(20)
        // sideways the backs are drawn at .4: 38 px tall, so 8 px apart (today 10)
        expect(fanStepOf(at(812, 375, 2, 'landscape', 71))).toBe(8)
        const centreOf = (fan: Target[]) => ({ x: (fan[0].left + fan[fan.length - 1].left) / 2 + fan[0].width / 2, y: (fan[0].top + fan[fan.length - 1].top) / 2 + fan[0].height / 2 })
        // 56 px under the HUD and 70 px in from the sides at a 71-wide back, three times that at 213
        expect(centreOf(fanPlaces(big, 'partner', 8))).toEqual({ x: 1100, y: 52 + 168 })
        expect(centreOf(fanPlaces(big, 'left', 8)).x).toBe(210)
        expect(centreOf(fanPlaces(big, 'right', 8)).x).toBe(2200 - 210)
        expect(centreOf(fanPlaces(big, 'left', 8)).y).toBeCloseTo(trickCentre(big).y - 10, 9)
        const phone = at(375, 812, 2, 'portrait', 71)
        expect(centreOf(fanPlaces(phone, 'partner', 8))).toEqual({ x: 375 / 2, y: 52 + 46 })
        expect(centreOf(fanPlaces(phone, 'left', 8)).x).toBe(30)
        const sideways = at(812, 375, 2, 'landscape', 71)
        expect(centreOf(fanPlaces(sideways, 'partner', 8)).y).toBe(44 + 23)
        expect(centreOf(fanPlaces(sideways, 'right', 8)).x).toBe(812 - 30)
        expect(centreOf(fanPlaces(sideways, 'right', 8)).y).toBeCloseTo(trickCentre(sideways).y, 9)
        // the backs: the seat's turn, ±2° a card, at the layout's scale; my own hand is no fan
        const left = fanPlaces(phone, 'left', 8)
        expect(left.map((back) => back.rotate)).toEqual([83, 85, 87, 89, 91, 93, 95, 97])
        expect(left.every((back) => back.scale === 0.5 && back.width === 71)).toBe(true)
        expect(left[1].top - left[0].top).toBeCloseTo(10, 9)
        expect(fanPlaces(phone, 'me', 8)).toEqual([])
    })

    test('cardTargets builds from handPlaces, fanPlaces and trickSlots', () => {
        const model = busyModel()
        for (const layout of [layoutFor({ width: 375, height: 812, dpr: 3 }), at(2560, 1300, 1, 'desktop', 213, 284), at(844, 340, 3, 'landscape', 71)]) {
            const t = cardTargets(model, layout)
            expect(model.hand.map((card) => t.cards[card.id]), nameOf(layout)).toEqual(handPlaces(layout, 8))
            for (const seat of model.seats.filter((one) => !one.isMe)) {
                expect(Array.from({ length: 8 }, (_, i) => t.cards[`back:${seat.id}:${i}`]), seat.id).toEqual(fanPlaces(layout, seat.position, 8))
            }
            const slots = trickSlots(layout)
            for (const play of model.trick!.plays) expect(t.cards[play.id]).toEqual({ ...slots[play.position ?? 'me'], rotate: tilt(play.id), z: play.order })
            expect(Object.values(slots).every((slot) => slot.rotate === 0 && slot.scale === 1 && slot.width === layout.trick.w)).toBe(true)
        }
    })
})

/**
 * A card's corner index (the art's rank and suit) after the card turns `rotate`° about its centre: 0.3 of its
 * width by 0.25 of its height at its top-left corner or, turned, at its bottom-right.
 */
function indexBox(card: Target, corner: 'top-left' | 'bottom-right', rotate: number): Box {
    const w = 0.3 * card.width
    const h = 0.25 * card.height
    const sign = corner === 'top-left' ? -1 : 1
    const dx = (sign * (card.width - w)) / 2
    const dy = (sign * (card.height - h)) / 2
    const r = rad(rotate)
    const cx = card.left + card.width / 2 + dx * Math.cos(r) - dy * Math.sin(r)
    const cy = card.top + card.height / 2 + dx * Math.sin(r) + dy * Math.cos(r)
    return box({ left: cx - w / 2, top: cy - h / 2, width: w, height: h, rotate, scale: 1, z: 0 })
}

describe('trickSlots: every trick card shows a corner index (board-fit spec G1, §7)', () => {
    const TILTS = Array.from({ length: 9 }, (_, k) => (k - 4) * 1.2)
    const POSITIONS: SeatPosition[] = ['me', 'right', 'partner', 'left']

    test('at every §7 layout, each slot\'s top-left or bottom-right index, at any tilt, meets none of the other three slots at their widest tilt', () => {
        expect(TILTS).toEqual([-4.8, -3.6, -2.4, -1.2, 0, 1.2, 2.4, 3.6, 4.8].map((r) => expect.closeTo(r, 9)))
        for (const layout of seven()) {
            const slots = trickSlots(layout)
            for (const position of POSITIONS) {
                const others = POSITIONS.filter((other) => other !== position).map((other) => tilted(slots[other]))
                for (const rotate of TILTS) {
                    const shows = (['top-left', 'bottom-right'] as const).some((corner) => others.every((other) => !overlap(indexBox(slots[position], corner, rotate), other)))
                    expect(shows, `${nameOf(layout)}: ${position} at ${rotate}°`).toBe(true)
                }
            }
        }
    })

    test('today\'s cross covers a side card\'s top-left index (the partner\'s card over the right one), so the turned bottom-right one is what shows', () => {
        const slots = trickSlots(at(375, 812, 2, 'portrait', 71))
        expect(overlap(indexBox(slots.right, 'top-left', 0), box(slots.partner))).toBe(true)
        expect(overlap(indexBox(slots.right, 'bottom-right', 0), box(slots.me))).toBe(false)
    })
})

describe('cardTargets: everything fits (spec §5.6)', () => {
    test('375×812 portrait: 8 cards at a 36-px step, each showing ≥ 36×76', () => {
        const { targets, model } = checkFit({ width: 375, height: 812, dpr: 3 }, 76)
        const hand = model.hand.map((card) => targets.cards[card.id])
        expect(hand[1].left - hand[0].left).toBe(36)
        expect(hand.map((card) => card.rotate)).toEqual([-7.7, -5.5, -3.3, -1.1, 1.1, 3.3, 5.5, 7.7].map((r) => expect.closeTo(r, 5)))
    })

    test('812×375 landscape: every card on screen, each hand card showing its top half, 47.5 px of 95 (board-fit spec §3.4)', () => {
        const { layout, targets, model } = checkFit({ width: 812, height: 375, dpr: 3 }, 47.5)
        const hand = model.hand.map((card) => targets.cards[card.id])
        expect(hand[1].left - hand[0].left).toBe(52)
        expect(Object.values(targets.cards).filter((t) => t.scale !== 1).every((t) => t.scale === 0.4)).toBe(true)
        expect(layout.handShow).toBe(0.5)
        hand.forEach((card) => expect(card.top).toBeLessThanOrEqual(375 - 0.5 * 95))
        // the outermost cards sit lowest: exactly half of each above the edge
        expect(hand[0].top).toBe(375 - 47.5)
        expect(hand[7].top).toBe(375 - 47.5)
    })

    test('the hand shows 80 % of each card elsewhere, as today (board-fit spec §3.4)', () => {
        for (const viewport of [{ width: 375, height: 812, dpr: 3 }, { width: 820, height: 1180, dpr: 2 }, { width: 1440, height: 900, dpr: 1 }]) {
            const layout = layoutFor(viewport)
            expect(layout.handShow, `${viewport.width}`).toBe(0.8)
            expect(handPlaces(layout, 8)[0].top, `${viewport.width}`).toBeCloseTo(viewport.height - 0.8 * layout.hand.h, 9)
        }
    })

    test('1440×900 desktop at 1× and 2×, the hand step 0.59 of the hand card (board-fit spec §3.5: today 84 and 64), and a 412×915 phone at 2.625×', () => {
        const one = checkFit({ width: 1440, height: 900, dpr: 1 }, 152)
        const hand = one.model.hand.map((card) => one.targets.cards[card.id])
        expect(hand[1].left - hand[0].left).toBeCloseTo(0.59 * 142, 9)
        expect(Math.round(hand[1].left - hand[0].left)).toBe(84)
        expect(hand[0].width).toBe(142)
        const two = checkFit({ width: 1440, height: 900, dpr: 2 }, 114)
        expect(two.targets.cards[two.model.hand[1].id].left - two.targets.cards[two.model.hand[0].id].left).toBeCloseTo(0.59 * 106.5, 9)
        checkFit({ width: 412, height: 915, dpr: 2.625 }, 86)
    })
})

describe('cardTargets: places', () => {
    const model = busyModel()
    const layout = layoutFor({ width: 375, height: 812, dpr: 3 })
    const t = cardTargets(model, layout)

    test('the trick is a cross: each card in its player\'s slot, with a stable tilt from its id', () => {
        const at = (id: string) => t.cards[model.trick!.plays.find((p) => p.playerId === id)!.id]
        expect(at('alice').top).toBeLessThan(at('dave').top)
        expect(at('dave').left).toBeGreaterThan(at('alice').left)
        expect(at('bob').left).toBeLessThan(at('alice').left)
        const id = model.trick!.plays[0].id
        expect(t.cards[id].rotate).toBe(tilt(id))
        expect(Math.abs(tilt('HERC-AS'))).toBeLessThanOrEqual(4.8)
    })

    test('my team\'s pile bottom-left, the opponents\' top-right; swept cards land at scale .5, ±8°', () => {
        expect(model.myTeam).toBe('A')
        expect(t.piles.A.left).toBeLessThan(t.piles.B.left)
        expect(t.piles.A.top).toBeGreaterThan(t.piles.B.top)
        expect([t.piles.A.scale, t.piles.A.rotate, t.piles.B.rotate]).toEqual([0.5, -8, 8])
        const daves = cardTargets(busyModel('dave'), layout)
        expect(daves.piles.B.left).toBeLessThan(daves.piles.A.left)
    })

    test('anchors: each seat\'s hand centre, where its plays and the deal come from', () => {
        expect(Object.keys(t.anchors).sort()).toEqual(['alice', 'bob', 'carol', 'dave'])
        expect(t.anchors.alice).toMatchObject({ x: 375 / 2, rotate: 180 })
        expect(t.anchors.dave.x).toBeGreaterThan(t.anchors.bob.x)
        expect(t.anchors.carol.y).toBeGreaterThan(t.anchors.alice.y)
    })

    test('fewer cards stay centred', () => {
        const six = { ...model, hand: model.hand.slice(0, 6) }
        const hand = six.hand.map((card) => cardTargets(six, layout).cards[card.id])
        const left = hand[0].left
        const right = hand[5].left + hand[5].width
        expect(left + right).toBeCloseTo(375)
    })
})

/** The lowest edge of the partner's full fan of eight backs: where the trick's band starts (board-fit spec §4). */
const fanBottomOf = (layout: Layout) => Math.max(...fanPlaces(layout, 'partner', 8).map((back) => box(back).y1))
/** The highest of my eight hand cards' tops. */
const handTopOf = (layout: Layout) => Math.min(...handPlaces(layout, 8).map((card) => card.top))
/** The widest a stable tilt makes a slot (tilt(): −4.8…+4.8°). */
const tilted = (slot: Target, rotate = 4.8) => box({ ...slot, rotate })

describe('trickCentre (spec §5.6; gameplay rules §6: the declaration moment is said there)', () => {
    test('the middle of the trick\'s cross, centred in the band between the partner\'s fan and my hand (board-fit spec §4.1–§4.3: no longer 44 % down, nor the middle in landscape)', () => {
        const model = busyModel()
        for (const viewport of [{ width: 1440, height: 900, dpr: 1 }, { width: 375, height: 812, dpr: 3 }, { width: 812, height: 375, dpr: 3 }]) {
            const layout = layoutFor(viewport)
            const centre = trickCentre(layout)
            const t = cardTargets(model, layout)
            const slots = model.trick!.plays.map((play) => t.cards[play.id])
            const middle = (slot: Target) => ({ x: slot.left + slot.width / 2, y: slot.top + slot.height / 2 })
            // the cross's opposite slots sit symmetric about it
            const xs = slots.map((slot) => middle(slot).x - centre.x)
            const ys = slots.map((slot) => middle(slot).y - centre.y)
            expect(Math.min(...xs) + Math.max(...xs), `${viewport.width}`).toBeCloseTo(0)
            expect(centre.x).toBe(layout.board.w / 2)
            expect(centre.y, `${viewport.width}`).toBeCloseTo((fanBottomOf(layout) + bandBottom(layout)) / 2, 9)
            expect(Math.max(...ys.map(Math.abs))).toBeLessThan(layout.trick.h)
        }
        // 375×812 @3: the partner's fan ends at 123.74 and the band at 711.2 (my hand's top 719.2 − 8), so the
        // cross sits at 417.47, 60 px lower than 44 % (357.28)
        const portrait = layoutFor({ width: 375, height: 812, dpr: 3 })
        expect(fanBottomOf(portrait)).toBeCloseTo(123.736, 3)
        expect(bandBottom(portrait)).toBeCloseTo(711.2, 9)
        expect(trickCentre(portrait).y).toBeCloseTo(417.468, 3)
        // 812×375: the fan ends at 87.59, the band at 302.7 (the lowered hand's top 310.7 − 8), so 195.14, not 187.5
        expect(trickCentre(layoutFor({ width: 812, height: 375, dpr: 3 })).y).toBeCloseTo(195.1445, 3)
    })

    test('at 390×664 @3 with 94.67-px cards the cross lies between the partner fan\'s bottom and the band\'s, the same room above and below (board-fit spec §4.1)', () => {
        const layout = layoutAt({ width: 390, height: 664, dpr: 3 }, 'portrait', cardSize(94.67, 3), cardSize(94.67, 3))
        const slots = trickSlots(layout)
        const fanBottom = fanBottomOf(layout)
        const top = tilted(slots.partner).y0
        const bottom = tilted(slots.me).y1
        expect(top).toBeGreaterThan(fanBottom)
        expect(bottom).toBeLessThan(bandBottom(layout))
        expect(top - fanBottom).toBeCloseTo(bandBottom(layout) - bottom, 9)
        expect(trickCentre(layout).y).toBeCloseTo((123.736 + 537.867) / 2, 2)
    })

    test('late in a hand the trick stays put: the centre and slots come from the layout alone, 8 cards in hand or 1 (Review Focus 4)', () => {
        const busy = busyModel()
        const late: BoardModel = { ...busy, hand: busy.hand.slice(0, 1), seats: busy.seats.map((seat) => ({ ...seat, cardsLeft: 1 })) }
        for (const viewport of [{ width: 375, height: 812, dpr: 3 }, { width: 812, height: 375, dpr: 2 }, { width: 1440, height: 900, dpr: 1 }]) {
            const layout = layoutFor(viewport)
            const now = cardTargets(busy, layout)
            const later = cardTargets(late, layout)
            expect(Object.keys(later.cards).filter((id) => id.startsWith('back:'))).toHaveLength(3)
            for (const play of busy.trick!.plays) {
                expect(later.cards[play.id], `${viewport.width} ${play.id}`).toEqual(now.cards[play.id])
                expect(now.cards[play.id]).toEqual({ ...trickSlots(layout)[play.position ?? 'me'], rotate: tilt(play.id), z: play.order })
            }
        }
    })
})

describe('bandBottom (board-fit spec §4; Ruling E)', () => {
    test('8 px over my full hand\'s top; on desktop also over the hover lift (24 px and the ×1.08 growth: 4 % of the card\'s height)', () => {
        const portrait = layoutFor({ width: 375, height: 812, dpr: 3 })
        // the outermost cards' top 812 − 76, the middle two 1.4·(3.5² − 0.5²) higher
        expect(handTopOf(portrait)).toBeCloseTo(812 - 76 - 16.8, 9)
        expect(bandBottom(portrait)).toBeCloseTo(handTopOf(portrait) - 8, 9)
        const landscape = layoutFor({ width: 812, height: 375, dpr: 2 })
        expect(bandBottom(landscape)).toBeCloseTo(375 - 47.5 - 16.8 - 8, 9)
        const desktop = layoutAt({ width: 1440, height: 900, dpr: 1 }, 'desktop', cardSize(142, 1), cardSize(213, 1))
        expect(bandBottom(desktop)).toBeCloseTo(900 - 0.8 * 285 - 16.8 - 8 - 24 - 0.04 * 285, 9)
        // the portrait arrangement on a 768–1023-px window reserves no lift: only the desktop's does
        const tablet = layoutAt({ width: 960, height: 980, dpr: 1 }, 'tablet', cardSize(142, 1), cardSize(213, 1))
        expect(bandBottom(tablet)).toBeCloseTo(handTopOf(tablet) - 8, 9)
    })
})

describe('belotRow (gameplay rules §6): a belot\'s eight cards in the declaration panel', () => {
    test('two-thirds of a trick card, crisp, 45 % under the next; closer where eight would overflow the panel', () => {
        const viewports: Viewport[] = [
            { width: 1440, height: 900, dpr: 1 }, { width: 1440, height: 900, dpr: 2 }, { width: 1024, height: 768, dpr: 2 }, { width: 1920, height: 1080, dpr: 1.25 },
            { width: 375, height: 812, dpr: 2 }, { width: 375, height: 812, dpr: 3 }, { width: 812, height: 375, dpr: 2 }, { width: 812, height: 375, dpr: 3 },
            { width: 320, height: 568, dpr: 2 }, { width: 768, height: 1024, dpr: 2 },
        ]
        for (const viewport of viewports) {
            const layout = layoutFor(viewport)
            const { width, step } = belotRow(layout)
            const where = `${viewport.width}x${viewport.height}@${viewport.dpr}`
            // board.css .board-moment__panel: max-width min(320px, 100% − 128px), 14 px each side
            const room = Math.min(320, layout.board.w - 128) - 28
            expect(width + 7 * step, where).toBeLessThanOrEqual(room + 1e-9)
            // as PlayingCard draws it: crisp at this density, so it never grows past the row
            expect(width, where).toBe(crispCardWidth(layout.trick.w * 0.66, viewport.dpr))
            expect(crispCardWidth(width, viewport.dpr), where).toBeCloseTo(width, 9)
            expect(step, where).toBeLessThanOrEqual(width * 0.55 + 1e-9)
            expect(step, where).toBeGreaterThan(width * 0.3)
        }
        // a retina desktop: the crisp card rounds up to 71 px, so the eight sit closer (S3 review: ~12 px over each side)
        const retina = belotRow(layoutFor({ width: 1440, height: 900, dpr: 2 }))
        expect(retina.width).toBe(71)
        expect(retina.step).toBeCloseTo((292 - 71) / 7, 9)
        // elsewhere 45 % under the next, of the card as drawn
        expect(belotRow(layoutFor({ width: 375, height: 812, dpr: 2 }))).toEqual({ width: 35.5, step: 35.5 * 0.55 })
        expect(belotRow(layoutFor({ width: 1440, height: 900, dpr: 1 })).step).toBeCloseTo(71 * 0.66 * 0.55, 9)
        expect(belotRow(layoutFor({ width: 375, height: 812, dpr: 2 }), 1).step).toBe(0)
    })
})

describe('bannerSpot (gameplay rules §6): the challenge banner where the trick goes, unless the docked hand result covers it', () => {
    test('centred on the trick; in landscape with the hand result open, its top edge under the HUD', () => {
        for (const viewport of [{ width: 1440, height: 900, dpr: 1 }, { width: 375, height: 812, dpr: 2 }, { width: 812, height: 375, dpr: 2 }, { width: 812, height: 340, dpr: 3 }]) {
            const layout = layoutFor(viewport)
            const where = `${viewport.width}x${viewport.height}`
            expect(bannerSpot(layout, false), where).toEqual({ ...trickCentre(layout), top: false })
            // a short landscape screen: the docked sheet covers the middle of the felt (S4's open item)
            expect(bannerSpot(layout, true), where).toEqual(layout.kind === 'landscape'
                ? { x: layout.board.w / 2, y: layout.hud + 8, top: true }
                : { ...trickCentre(layout), top: false })
        }
    })
})

describe('tableTargets: a full table from the layout alone (seatBoxes, fits)', () => {
    test('my 8 hand cards, 8 backs at every other seat, the four trick slots, the anchors and piles as cardTargets makes them; seat ids are the positions, my team A', () => {
        const busy = busyModel()
        for (const layout of [at(390, 664, 3, 'portrait', 94.67), at(812, 375, 2, 'landscape', 71), at(1440, 900, 1, 'desktop', 142, 213)]) {
            const t = tableTargets(layout)
            const where = nameOf(layout)
            expect(Object.keys(t.cards), where).toHaveLength(8 + 3 * 8 + 4)
            expect(Array.from({ length: 8 }, (_, i) => t.cards[`hand:${i}`]), where).toEqual(handPlaces(layout, 8))
            for (const position of ['right', 'partner', 'left'] as const) {
                expect(Array.from({ length: 8 }, (_, i) => t.cards[`back:${position}:${i}`]), `${where} ${position}`).toEqual(fanPlaces(layout, position, 8))
            }
            expect(t.cards['back:me:0'], where).toBeUndefined()
            const slots = trickSlots(layout)
            for (const position of ['me', 'right', 'partner', 'left'] as const) expect(t.cards[`trick:${position}`], `${where} ${position}`).toEqual(slots[position])
            // the busy table (carol me, dave right, alice partner, bob left; 8 cards in hand, my team A) has the same anchors and piles
            const real = cardTargets(busy, layout)
            expect(t.anchors, where).toEqual({ me: real.anchors.carol, right: real.anchors.dave, partner: real.anchors.alice, left: real.anchors.bob })
            expect(t.piles, where).toEqual(real.piles)
        }
    })
})

describe('hudBoxes: what the HUD holds on the felt (board-fit spec G2)', () => {
    test('the HUD\'s band; on a portrait phone also the Challenge column under it on the left (board.css: Challenge over its info button, each 44 tall, 6 apart, from 8 + 44 + 6)', () => {
        expect(hudBoxes(at(375, 553, 2, 'portrait', 71))).toEqual([{ x: 0, y: 0, w: 375, h: 52 }, { x: 8, y: 58, w: 120, h: 94 }])
        expect(hudBoxes(at(390, 664, 3, 'portrait', 94.67))).toEqual([{ x: 0, y: 0, w: 390, h: 52 }, { x: 8, y: 58, w: 120, h: 94 }])
        expect(hudBoxes(at(812, 375, 2, 'landscape', 71))).toEqual([{ x: 0, y: 0, w: 812, h: 44 }])
        // the tablet keeps Challenge on the HUD's line (the stacking rule is data-layout="portrait" only)
        expect(hudBoxes(at(960, 980, 1, 'tablet', 142, 213))).toEqual([{ x: 0, y: 0, w: 960, h: 52 }])
        expect(hudBoxes(at(1440, 900, 1, 'desktop', 142, 213))).toEqual([{ x: 0, y: 0, w: 1120, h: 52 }])
    })
})
