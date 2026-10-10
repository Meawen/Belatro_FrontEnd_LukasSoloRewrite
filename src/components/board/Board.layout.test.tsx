import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderBoard, tableState } from './testing'
import { find, playTable } from '../../test/fixtures/views/table'

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
const px = (el: HTMLElement, side: 'left' | 'top') => Number.parseFloat(el.style[side])

describe('Board: layout details from the visual pass (spec §5.6)', () => {
    test('in landscape my chip sits over my pile beside the hand, clear of the left seat’s chips', () => {
        renderBoard({ state: tableState(find(table, 'bid:bob:PASS')), viewport: { width: 812, height: 375 } })
        const mine = screen.getByTestId('seat-carol')
        const pile = screen.getByTestId('pile-a')
        expect(px(mine, 'left')).toBeCloseTo(px(pile, 'left') - 4, 0)
        expect(px(mine, 'top')).toBeLessThan(px(pile, 'top'))
        expect(px(mine, 'left')).toBeGreaterThan(px(screen.getByTestId('seat-bob'), 'left') + 120)
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
})
