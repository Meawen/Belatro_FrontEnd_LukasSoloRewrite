import { describe, test, expect } from 'vitest'
import { cardSize, cardTargets, layoutFor, tilt, type Target, type Targets, type Viewport } from './cardTargets'
import { EMPTY_LOCAL, boardModel, type BoardModel } from './boardModel'
import { indexOf, playTable } from '../../../test/fixtures/views/table'

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
/** The on-screen bounding box of a rotated, scaled card. */
function box(t: Target) {
    const cx = t.left + t.width / 2
    const cy = t.top + t.height / 2
    const w = t.width * t.scale
    const h = t.height * t.scale
    const r = rad(t.rotate)
    const hw = (Math.abs(Math.cos(r)) * w + Math.abs(Math.sin(r)) * h) / 2
    const hh = (Math.abs(Math.sin(r)) * w + Math.abs(Math.cos(r)) * h) / 2
    return { x0: cx - hw, x1: cx + hw, y0: cy - hh, y1: cy + hh }
}
type Box = ReturnType<typeof box>
const overlap = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

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
    // every hand card exposes a strip at least 36 px wide and minVisible px tall
    hand.forEach((card, i) => {
        if (i < hand.length - 1) expect(hand[i + 1].left - card.left).toBeGreaterThanOrEqual(36)
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

describe('cardTargets: everything fits (spec §5.6)', () => {
    test('375×812 portrait: 8 cards at a 36-px step, each showing ≥ 36×76', () => {
        const { targets, model } = checkFit({ width: 375, height: 812, dpr: 3 }, 76)
        const hand = model.hand.map((card) => targets.cards[card.id])
        expect(hand[1].left - hand[0].left).toBe(36)
        expect(hand.map((card) => card.rotate)).toEqual([-7.7, -5.5, -3.3, -1.1, 1.1, 3.3, 5.5, 7.7].map((r) => expect.closeTo(r, 5)))
    })

    test('812×375 landscape: every card on screen, each hand card showing ≥ 36×71', () => {
        const { targets, model } = checkFit({ width: 812, height: 375, dpr: 3 }, 71)
        const hand = model.hand.map((card) => targets.cards[card.id])
        expect(hand[1].left - hand[0].left).toBe(52)
        expect(Object.values(targets.cards).filter((t) => t.scale !== 1).every((t) => t.scale === 0.4)).toBe(true)
    })

    test('1440×900 desktop at 1× and 2×, and a 412×915 phone at 2.625×', () => {
        const one = checkFit({ width: 1440, height: 900, dpr: 1 }, 152)
        const hand = one.model.hand.map((card) => one.targets.cards[card.id])
        expect(hand[1].left - hand[0].left).toBe(84)
        expect(hand[0].width).toBe(142)
        const two = checkFit({ width: 1440, height: 900, dpr: 2 }, 114)
        expect(two.targets.cards[two.model.hand[1].id].left - two.targets.cards[two.model.hand[0].id].left).toBe(64)
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
