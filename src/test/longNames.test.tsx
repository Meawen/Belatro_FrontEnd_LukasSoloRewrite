import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rule, uiCss } from './css'
import { renderBoard, tableState } from '../components/board/testing'
import { LONG_NAMES, devTable, parseDevOptions, seatId } from '../dev/devTable'
import { indexOf } from './fixtures/views/table'

// Review focus: the longest real names (20-character usernames, 50-character lobby names) never overflow.
// e2e/visual/checks/names.mjs proves it in Chromium; these pin the rules that make it so.

// board.css as written (Vitest doesn't load CSS); not new URL(…, import.meta.url), which Vite turns into an import
const boardCss = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'components', 'board', 'board.css'), 'utf8')
const px = (el: HTMLElement, side: 'left' | 'maxWidth') => Number.parseFloat(el.style[side])

// the whole board renders: slower than a 5-s default on a busy machine
vi.setConfig({ testTimeout: 20_000 })
beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => {
    vi.restoreAllMocks()
})

describe('the longest names', () => {
    test('/dev/board?names=long names every seat by a 20-character name in every frame; the labels stay', () => {
        const options = { ...parseDevOptions('?seat=carol&names=long'), hands: 1 }
        const short = devTable({ ...options, names: false }, 0)
        const long = devTable(options, 0)
        expect(seatId(options)).toBe(LONG_NAMES.carol)
        expect(Object.values(LONG_NAMES).every((name) => /^[A-Za-z0-9_]{20}$/.test(name))).toBe(true)
        expect(long[0].public.teamA.map((seat) => seat.id)).toEqual([LONG_NAMES.alice, LONG_NAMES.carol])
        expect(Object.keys(long[0].private).sort()).toEqual(Object.values(LONG_NAMES).sort())
        expect(JSON.stringify(long)).not.toMatch(/"(alice|bob|carol|dave)"/)
        expect(long.map((f) => f.label)).toEqual(short.map((f) => f.label))
    })

    test('at 375 the side seats’ chips each stop short of the board’s middle, and a long name ends in an ellipsis', () => {
        const table = devTable({ ...parseDevOptions('?names=long'), hands: 1 }, Date.now())
        const fanOut = table[indexOf(table, 'bid:bob:PASS')]
        renderBoard({ state: tableState(fanOut, LONG_NAMES.carol), me: LONG_NAMES.carol, viewport: { width: 375, height: 812 } })
        const left = screen.getByTestId(`seat-${LONG_NAMES.bob}`)
        const right = screen.getByTestId(`seat-${LONG_NAMES.dave}`)
        expect(px(left, 'left') + px(left, 'maxWidth')).toBeLessThanOrEqual(375 / 2 - 6)
        expect(px(right, 'left') - px(right, 'maxWidth')).toBeGreaterThanOrEqual(375 / 2 + 6)
        expect(px(screen.getByTestId(`seat-${LONG_NAMES.alice}`), 'maxWidth')).toBeLessThanOrEqual(375 - 32)
        expect(screen.getByTitle(LONG_NAMES.bob)).toHaveTextContent(LONG_NAMES.bob)
        expect(boardCss).toMatch(/\.board-seat__name > \.board-seat__label \{\s*flex-shrink: 1;\s*min-width: 0;\s*overflow: hidden;\s*text-overflow: ellipsis;/)
        expect(boardCss).toMatch(/\.board-seat__name \{\s*max-width: 100%;/)
    })

    test('a sheet’s title wraps a long word (a 50-character lobby name) instead of widening the sheet', () => {
        const title = rule('.ui-sheet__header > h2', uiCss())
        expect(title).toMatch(/min-width: 0;/)
        expect(title).toMatch(/overflow-wrap: anywhere;/)
    })
})
