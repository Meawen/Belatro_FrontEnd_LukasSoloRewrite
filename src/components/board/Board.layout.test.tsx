import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderBoard, tableState } from './testing'
import { declaredStep } from './seatSpot'
import { fanPlaces, layoutFor, trickSlots } from './model/cardTargets'
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
const px = (el: HTMLElement, side: 'left' | 'top' | 'maxWidth') => Number.parseFloat(el.style[side])

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
    test('in landscape my plate sits by my hand, above my pile, right of the left seat’s column, so that column never reaches it (board-fit spec §4.2)', () => {
        withDpr(2, () => {
            // the call: eight cards in my hand, so my pile sits beside its first card, as far left as it goes
            renderBoard({ state: tableState(find(table, 'call:')), viewport: { width: 812, height: 375 } })
            const mine = screen.getByTestId('seat-carol')
            const bob = screen.getByTestId('seat-bob')
            // the left seat's column: 132 px from its edge (four 35.5-px declared cards need 94), then 4 px clear; my
            // pile's left edge less 4 would be 133
            expect(px(bob, 'left')).toBe(8)
            expect(px(mine, 'left')).toBe(8 + 132 + 4)
            expect(px(mine, 'top')).toBeLessThan(px(screen.getByTestId('pile-a'), 'top'))
        })
        // bidding, six cards: my pile sits further right, and my plate over it
        cleanup()
        withDpr(2, () => {
            renderBoard({ state: tableState(find(table, 'bid:bob:PASS')), viewport: { width: 812, height: 375 } })
            expect(px(screen.getByTestId('seat-carol'), 'left')).toBe(px(screen.getByTestId('pile-a'), 'left') - 4)
        })
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

    test('a side seat\'s chips and declared cards line up under its fan on its own edge, inside its seat, the plate above the fan: never across the felt onto the trick or my hand (board-fit spec §4.1–§4.3; gameplay rules §6)', () => {
        // the right seat's plate ends at the right edge (seatSpot: translateX(-100%)), so its column grows leftwards from there
        expect(css).toMatch(/\.board-seat\[data-position="right"\] \{[^}]*align-items: flex-end;/)
        expect(css).toMatch(/\.board-seat\[data-position="right"\] \.board-seat__chips \{[^}]*justify-content: flex-end;/)
        // the left seat's starts at the left edge: left-aligned, as every column is
        expect(css).toMatch(/\.board-seat \{[^}]*align-items: flex-start;/)
        // the chips and declared cards under the fan: placed from the plate's top (seatSpot's under), as wide as they are
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
                // the plate above the fan, 6 px clear; the chips and cards from 6 px under the fan
                expect(px(dave, 'top') + 26, where).toBeCloseTo(fan.y0 - 6, 9)
                const under = dave.querySelector<HTMLElement>(':scope > .board-seat__under')!
                expect(px(dave, 'top') + px(under, 'top'), where).toBeCloseTo(fan.y1 + 6, 9)
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

    test('my partner\'s chips and declared cards: in its column beside the fan upright and on desktops, on the plate\'s row in landscape, the timer bar under the row (board-fit spec §4.1, §4.2)', () => {
        expect(css).toMatch(/\.board\[data-layout="landscape"\] \.board-seat\[data-position="partner"\] \{[^}]*flex-direction: row;[^}]*flex-wrap: wrap;/)
        expect(css).toMatch(/\.board\[data-layout="landscape"\] \.board-seat\[data-position="partner"\] \.board-seat__timer \{[^}]*order: 1;[^}]*flex-basis: 100%;/)
        // seed 1254, the hand's first card: alice (my partner) holds Zvanja 20 and three declared cards
        const t = playTable({ seed: 1254 })
        for (const viewport of [{ width: 812, height: 375 }, { width: 375, height: 812 }, { width: 1440, height: 900 }]) {
            const where = `${viewport.width}x${viewport.height}`
            const { unmount } = renderBoard({ state: tableState(t[indexOf(t, 'play:')], 'carol', 'snapshot'), viewport })
            const alice = screen.getByTestId('seat-alice')
            expect(alice.querySelector('.board-seat__under'), where).toBeNull()
            expect(alice.querySelector(':scope > .board-seat__chips')?.textContent, where).toBe('Zvanja 20')
            expect(alice.querySelectorAll(':scope > .board-seat__declared img'), where).toHaveLength(3)
            unmount()
        }
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
