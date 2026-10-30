import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderBoard, tableState } from './testing'
import { declaredStep } from './seatSpot'
import { fanPlaces, handPlaces, layoutFor, trickSlots } from './model/cardTargets'
import { find, indexOf, playTable } from '../../test/fixtures/views/table'
import { box, hull, overlap } from '../../test/fixtures/layouts'
import { LONG_NAMES, devTable, parseDevOptions } from '../../dev/devTable'

// board.css as written (Vitest doesn't load CSS); not new URL(…, import.meta.url), which Vite turns into an import
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'board.css'), 'utf8')

// the whole board renders in every test: slower than a 5-s default on a busy machine
vi.setConfig({ testTimeout: 20_000 })

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => {
    vi.restoreAllMocks()
})

const table = playTable()
const px = (el: HTMLElement, side: 'left' | 'top' | 'maxWidth' | 'marginRight') => Number.parseFloat(el.style[side])

/** The page at this device-pixel ratio (jsdom's is 1): the board and its cards read it. */
function withDpr<T>(dpr: number, run: () => T): T {
    const before = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio')
    Object.defineProperty(window, 'devicePixelRatio', { value: dpr, configurable: true })
    try {
        return run()
    } finally {
        if (before) Object.defineProperty(window, 'devicePixelRatio', before)
        else delete (window as { devicePixelRatio?: number }).devicePixelRatio
    }
}

describe('Board: layout details from the visual pass (spec §5.6)', () => {
    test('in landscape my plate sits at the bottom left, beside my hand, under the left seat\'s column beside its fan, so that column never reaches it (board-fit spec §4.2; Ruling I)', () => {
        for (const state of [find(table, 'call:'), find(table, 'bid:bob:PASS')]) {
            withDpr(2, () => {
                renderBoard({ state: tableState(state), viewport: { width: 812, height: 375 } })
                const mine = screen.getByTestId('seat-carol')
                // 12 px in, 8 px up (its plate and timer bar 33 tall); its column up to 6 px before my hand's first card
                const first = box(handPlaces(layoutFor({ width: 812, height: 375, dpr: 2 }), 8)[0])
                expect([px(mine, 'left'), px(mine, 'top')], state.label).toEqual([12, 375 - 8 - 33])
                expect(px(mine, 'maxWidth'), state.label).toBeCloseTo(first.x0 - 6 - 12, 9)
                // the left seat's column beside its fan ends above my chips and cards over my plate (four 35.5-px cards)
                const bob = screen.getByTestId('seat-bob')
                expect(px(bob, 'top') + px(bob.querySelector<HTMLElement>('.board-seat__under')!, 'top') + 20 + 4 + 47.5, state.label).toBeLessThan(375 - 8 - 33 + 4)
            })
            cleanup()
        }
    })

    test('on a phone my chip stays bottom-left, over my pile', () => {
        renderBoard({ state: tableState(find(table, 'bid:bob:PASS')), viewport: { width: 375, height: 812 } })
        expect(px(screen.getByTestId('seat-carol'), 'left')).toBe(12)
    })

    test('the phone bid panel: one compact block (Pass over the four suits) above the side seats; the HUD chips on one line', () => {
        expect(css).toMatch(/\.board\[data-layout="portrait"\] \.board-bid__buttons \{\s*display: grid;\s*grid-template-columns: repeat\(4, 52px\);/)
        expect(css).toMatch(/\.board\[data-layout="portrait"\] \.board-bid__buttons > \.ui-btn \{\s*grid-column: 1 \/ -1;/)
        expect(css).toMatch(/\.board\[data-layout="portrait"\] \.board-bid \{\s*top: 36%;/)
        expect(css).toMatch(/\.board-bid \{[^}]*width: max-content;/)
        expect(css).toMatch(/\.board-hud__group \{[^}]*min-height: 44px;/)
    })

    test('a side seat\'s chips and declared cards sit inside its seat on its own side: under its fan upright, under its plate beside the fan elsewhere; never across the felt onto the trick or my hand (board-fit spec §4.1–§4.3; Ruling I; gameplay rules §6)', () => {
        // the right seat's column ends at its right edge (seatSpot: translateX(-100%)), so it grows leftwards from there
        expect(css).toMatch(/\.board-seat\[data-position="right"\] \{[^}]*align-items: flex-end;/)
        expect(css).toMatch(/\.board-seat\[data-position="right"\] \.board-seat__chips \{[^}]*justify-content: flex-end;/)
        // the left seat's starts at its left edge: left-aligned, as every column is
        expect(css).toMatch(/\.board-seat \{[^}]*align-items: flex-start;/)
        // the chips and declared cards: placed from the plate's top (seatSpot's under), as wide as they are
        expect(css).toMatch(/\.board-seat__under \{[^}]*position: absolute;[^}]*left: 0;[^}]*display: flex;[^}]*flex-direction: column;[^}]*align-items: flex-start;[^}]*gap: 4px;[^}]*width: max-content;/)
        expect(css).toMatch(/\.board-seat\[data-position="right"\] \.board-seat__under \{[^}]*left: auto;[^}]*right: 0;[^}]*align-items: flex-end;/)
        // seed 7, the hand's second card: dave (my right) holds Zvanja 20 and his three declared cards
        for (const viewport of [{ width: 812, height: 375 }, { width: 375, height: 812 }, { width: 1440, height: 900 }]) {
            withDpr(2, () => {
                const where = `${viewport.width}x${viewport.height}`
                const { unmount } = renderBoard({ state: tableState(find(table, 'play:bob:PIK-BABA'), 'carol', 'snapshot'), viewport })
                expect(['carol', 'dave', 'alice', 'bob'].map((id) => screen.getByTestId(`seat-${id}`).dataset.position), where).toEqual(['me', 'right', 'partner', 'left'])
                const layout = layoutFor({ ...viewport, dpr: 2 })
                const fan = hull(fanPlaces(layout, 'right', 8).map(box))
                const dave = screen.getByTestId('seat-dave')
                const under = dave.querySelector<HTMLElement>(':scope > .board-seat__under')!
                if (layout.kind === 'portrait') {
                    // the plate and its timer bar above the fan, 6 px clear; the chips and cards 6 px under the fan or its slot
                    const slot = box({ ...trickSlots(layout).right, rotate: 4.8 })
                    expect(px(dave, 'top') + 33, where).toBeCloseTo(fan.y0 - 6, 9)
                    expect(px(dave, 'top') + px(under, 'top'), where).toBeCloseTo(Math.max(fan.y1, slot.y1) + 6, 9)
                } else {
                    // the column beside the fan's inner side from its top: the plate, its timer bar, then the chips and cards
                    expect(px(dave, 'left'), where).toBeCloseTo(fan.x0 - 6, 9)
                    expect(px(dave, 'top'), where).toBeCloseTo(fan.y0, 9)
                    expect(px(under, 'top'), where).toBe(26 + 4 + 3 + 4)
                }
                expect(dave.style.transform, where).toBe('translateX(-100%)')
                expect(px(under, 'maxWidth'), where).toBe(px(dave, 'maxWidth'))
                expect(dave.querySelector(':scope > .board-seat__chips'), where).toBeNull()
                expect(under.querySelector(':scope > .board-seat__chips')?.textContent, where).toBe('Zvanja 20')
                expect(under.querySelectorAll(':scope > .board-seat__declared img'), where).toHaveLength(3)
                // half a trick card wide, crisp (board-fit spec §3.5), 45 % under the next unless the column is narrower
                const cards = [...under.querySelectorAll<HTMLElement>('.board-seat__declared .ui-card')]
                const w = layout.declared.w
                expect(cards.map((card) => card.style.width), where).toEqual(Array(3).fill(`${w}px`))
                expect(cards.map((card) => card.style.marginLeft), where).toEqual(['', ...Array(2).fill(`${declaredStep(w, 3, px(dave, 'maxWidth')) - w}px`)])
                unmount()
            })
        }
        // at 375×812 @2 the cards are 35.5 px, half the 71-px trick card; at @1 the nearest crisp half is a whole 71
        expect(layoutFor({ width: 375, height: 812, dpr: 2 }).declared.w).toBe(35.5)
        expect(layoutFor({ width: 375, height: 812, dpr: 1 }).declared.w).toBe(71)
    })

    test('my partner\'s chips and declared cards: in its column beside the fan upright and on desktops, on the plate\'s row in landscape, the timer bar under the row; the cards on the fan\'s left side where the row lacks room (board-fit spec §4.1–§4.3; Ruling I b)', () => {
        expect(css).toMatch(/\.board\[data-layout="landscape"\] \.board-seat\[data-position="partner"\] \{[^}]*flex-direction: row;[^}]*flex-wrap: wrap;/)
        expect(css).toMatch(/\.board\[data-layout="landscape"\] \.board-seat\[data-position="partner"\] \.board-seat__timer \{[^}]*order: 1;[^}]*flex-basis: 100%;/)
        // aside: its right edge at the plate's left edge, moved left by a margin (seatSpot's aside offset)
        expect(css).toMatch(/\.board-seat__aside \{[^}]*position: absolute;[^}]*top: 0;[^}]*right: 100%;[^}]*display: flex;[^}]*width: max-content;/)
        // seed 1254, the hand's first card: alice (my partner) holds Zvanja 20 and three declared cards
        const t = playTable({ seed: 1254 })
        for (const viewport of [{ width: 812, height: 375 }, { width: 375, height: 812 }, { width: 1440, height: 900 }, { width: 667, height: 323 }]) {
            withDpr(2, () => {
                const where = `${viewport.width}x${viewport.height}`
                const { unmount } = renderBoard({ state: tableState(t[indexOf(t, 'play:')], 'carol', 'snapshot'), viewport })
                const alice = screen.getByTestId('seat-alice')
                expect(alice.querySelector('.board-seat__under'), where).toBeNull()
                expect(alice.querySelector(':scope > .board-seat__chips')?.textContent, where).toBe('Zvanja 20')
                // 667×323 @2: plate, chip and cards need 320 px, the row has 269
                const aside = alice.querySelector<HTMLElement>(':scope > .board-seat__aside')
                expect(aside !== null, where).toBe(viewport.width === 667)
                expect((aside ?? alice).querySelectorAll(':scope > .board-seat__declared img'), where).toHaveLength(3)
                if (aside) expect(px(aside, 'marginRight'), where).toBeCloseTo(104.819, 3)
                unmount()
            })
        }
    })

    test('upright my chips sit beside my plate, after it, bottom-aligned and wrapping upwards within their width, and my plate keeps the countdown\'s width, so they never shift or reach down onto my hand (board-fit spec §3.2, §4.1)', () => {
        expect(css).toMatch(/\.board\[data-layout="portrait"\] \.board-seat\[data-position="me"\] > \.board-seat__chips \{[^}]*position: absolute;[^}]*left: calc\(100% \+ 4px\);[^}]*top: 26px;[^}]*translate: 0 -100%;[^}]*flex-wrap: wrap-reverse;[^}]*width: max-content;/)
        expect(css).toMatch(/\.board-seat__seconds \{[^}]*min-width: 4ch;/)
        // the TS frame of the call: alice is to lead, then my turn comes
        const call = indexOf(table, 'call:')
        withDpr(2, () => {
            renderBoard({ state: tableState(table[call + 1]), viewport: { width: 375, height: 553 } })
            const mine = screen.getByTestId('seat-carol')
            expect(px(mine.querySelector<HTMLElement>(':scope > .board-seat__chips')!, 'maxWidth')).toBe(375 - 8 - (12 + 140 + 4))
            // not my turn: an empty, hidden place for the countdown on my plate
            const reserve = mine.querySelector('.board-seat__name > .board-seat__seconds')!
            expect(reserve).toHaveAttribute('aria-hidden', 'true')
            expect(reserve).toBeEmptyDOMElement()
            expect(within(mine).queryByTestId('turn-countdown')).toBeNull()
        })
        cleanup()
        // my turn: the countdown takes that place
        const mine = table.slice(call).find((frame) => frame.private.carol.publicPart.currentPlayerId === 'carol')!
        withDpr(2, () => {
            renderBoard({ state: tableState(mine), viewport: { width: 375, height: 553 } })
            const seat = screen.getByTestId('seat-carol')
            expect(seat.querySelectorAll('.board-seat__name > .board-seat__seconds')).toHaveLength(1)
            expect(within(seat).getByTestId('turn-countdown')).toHaveClass('board-seat__seconds')
        })
    })

    test('my declared cards over my plate run up to the trick slot beside them, overlapping more where they need to (board-fit spec §3.2 give-way 1; Ruling N)', () => {
        // seed 1254, the hand's first card: I declared six cards; a seventh makes the rare column
        const t = playTable({ seed: 1254 })
        const frame = structuredClone(t[indexOf(t, 'play:')])
        const zvanje = frame.private.carol.publicPart.zvanja!.seats.find((one) => one.playerId === 'carol')!
        const extra = frame.private.carol.hand.find((card) => !zvanje.cards.some((one) => one.boja === card.boja && one.rank === card.rank))!
        zvanje.cards.push(extra)
        expect(zvanje.cards).toHaveLength(7)
        withDpr(2, () => {
            renderBoard({ state: tableState(frame, 'carol', 'snapshot'), viewport: { width: 375, height: 553 } })
            const layout = layoutFor({ width: 375, height: 553, dpr: 2 })
            const above = screen.getByTestId('seat-carol').querySelector<HTMLElement>(':scope > .board-seat__above')!
            const cards = [...above.querySelectorAll<HTMLElement>('.board-seat__declared .ui-card')]
            const w = layout.declared.w
            // 148.15 − 6 − 12 = 130.15 px: the seven 35.5-px cards 15.78 apart, not 19.53
            expect(px(above, 'maxWidth')).toBeCloseTo(130.150, 3)
            expect(cards).toHaveLength(7)
            expect(cards.map((card) => card.style.marginLeft)).toEqual(['', ...Array(6).fill(`${declaredStep(w, 7, px(above, 'maxWidth')) - w}px`)])
        })
    })

    test('long names (Review Focus 2): each seat\'s plate at its maxWidth stops short of every trick slot, at 375×553 @2 and 667×323 @2', () => {
        const long = devTable({ ...parseDevOptions('?names=long'), hands: 1 }, Date.now())
        const fanOut = long[indexOf(long, 'play:')]
        for (const viewport of [{ width: 375, height: 553 }, { width: 667, height: 323 }]) {
            withDpr(2, () => {
                const { unmount } = renderBoard({ state: tableState(fanOut, LONG_NAMES.carol), me: LONG_NAMES.carol, viewport })
                const slots = Object.values(trickSlots(layoutFor({ ...viewport, dpr: 2 }))).map((slot) => box({ ...slot, rotate: 4.8 }))
                // my plate reads "You", never a long name
                for (const id of [LONG_NAMES.alice, LONG_NAMES.bob, LONG_NAMES.dave]) {
                    const el = screen.getByTestId(`seat-${id}`)
                    const where = `${viewport.width}x${viewport.height} ${el.dataset.position}`
                    const left = el.style.transform === 'translateX(-100%)' ? px(el, 'left') - px(el, 'maxWidth') : px(el, 'left')
                    // the plate and its timer bar at their widest
                    const plate = { x0: left, x1: left + px(el, 'maxWidth'), y0: px(el, 'top'), y1: px(el, 'top') + 26 + 4 + 3 }
                    for (const slot of slots) expect(overlap(plate, slot), `${where} ${JSON.stringify(plate)} ${JSON.stringify(slot)}`).toBe(false)
                    expect(screen.getByTitle(id), where).toHaveTextContent(id)
                }
                unmount()
            })
        }
    })

    test('a portrait HUD under 400 px reads the phase word but hides it while a trump is called, so Blok stays on the first line and Challenge right under it (board-fit spec G2; Ruling L)', () => {
        expect(css).toMatch(/@media \(max-width: 399\.98px\) \{\s*\.board\[data-layout="portrait"\] \.board-hud__phase--called \{[^}]*position: absolute;[^}]*width: 1px;[^}]*height: 1px;[^}]*overflow: hidden;[^}]*clip: rect\(0, 0, 0, 0\);[^}]*white-space: nowrap;/)
        // a trump called: the phase word carries the class, its text stays for screen readers
        renderBoard({ state: tableState(find(table, 'play:')), viewport: { width: 375, height: 553 } })
        const phase = screen.getByTestId('game-phase')
        expect(screen.getByTestId('trump')).toHaveTextContent('Herc')
        expect(phase).toHaveClass('board-hud__phase--called')
        expect(phase).toHaveTextContent('Playing')
        cleanup()
        // bidding, no trump: the word shows
        renderBoard({ state: tableState(find(table, 'bid:bob:PASS')), viewport: { width: 375, height: 553 } })
        expect(screen.getByTestId('game-phase')).not.toHaveClass('board-hud__phase--called')
        expect(screen.getByTestId('game-phase')).toHaveTextContent('Bidding')
    })

    test('on a portrait phone the HUD\'s Challenge stacks over its info button, so it stays in the felt\'s left column, clear of my partner\'s fan and plate (gameplay rules §6)', () => {
        expect(css).toMatch(/\.board\[data-layout="portrait"\] \.board-challenge--hud \.board-challenge__buttons \{[^}]*flex-direction: column;[^}]*align-items: flex-start;/)
        // each on its own ink chip, as Blok: the button on an opaque panel (a spent, greyed button is see-through), the info button its own
        expect(css).toMatch(/\.board\[data-layout="portrait"\] \.board-challenge--hud \.board-challenge__buttons \{[^}]*background: none;[^}]*clip-path: none;/)
        expect(css).toMatch(/\.board\[data-layout="portrait"\] \.board-challenge--hud \.board-challenge__main \{[^}]*background: var\(--material-ink\);[^}]*clip-path: var\(--notch\);/)
        expect(css).toMatch(/\.board\[data-layout="portrait"\] \.board-challenge--hud \.ui-btn--icon \{[^}]*--btn-bg: var\(--material-ink\);/)
        // elsewhere one panel behind both, as before
        expect(css).toMatch(/\.board-challenge--hud \.board-challenge__buttons \{[^}]*background: var\(--material-ink\);[^}]*clip-path: var\(--notch\);/)
        // on a line of its own, never beside Blok (that would reach the fan again); only its buttons and hint take taps
        expect(css).toMatch(/\.board\[data-layout="portrait"\] \.board-challenge--hud \{[^}]*flex-basis: 100%;[^}]*align-items: flex-start;[^}]*pointer-events: none;/)
        expect(css).toMatch(/\.board\[data-layout="portrait"\] \.board-challenge--hud > \* \{[^}]*pointer-events: auto;/)
    })

    test('in landscape the HUD\'s left group stops short of my partner\'s fan in the middle: a wide Challenge goes to a second line (gameplay rules §6)', () => {
        // the fan's left edge is about 52 px left of the middle (eight backs at 0.4); the group ends 6 px before it
        expect(css).toMatch(/\.board\[data-layout="landscape"\] \.board-hud__group:first-child \{[^}]*max-width: calc\(50% - 58px\);/)
    })
})
