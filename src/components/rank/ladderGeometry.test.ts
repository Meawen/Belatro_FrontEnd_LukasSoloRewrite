import { describe, test, expect } from 'vitest'
import { aheadPercent, LADDER_PAD, ladderGeometry, niceCeil, rankOfBin } from './ladderGeometry'
import { FEW_LADDER, LADDER } from '../../test/fixtures/ranks'
import type { Ladder } from '../../types/user'

// ranks spec §7.3: the ladder's geometry, in CSS px, from the ladder alone
describe('niceCeil', () => {
    test.each([[0, 1], [1, 1], [2, 2], [3, 5], [7, 10], [31, 50], [85, 100], [100, 100], [101, 200], [640, 1000]])('%i → %i', (n, nice) => {
        expect(niceCeil(n)).toBe(nice)
    })
})

describe('ladderGeometry', () => {
    test('one slot per 100 points from the lowest bin to the end of the highest; bars at most 24 px, centred', () => {
        const g = ladderGeometry(LADDER, 848, { you: null })
        expect(g.plot).toEqual({ left: LADDER_PAD.left, top: LADDER_PAD.top, width: 848 - LADDER_PAD.left - LADDER_PAD.right, height: 150 })
        expect([g.lo, g.hi]).toEqual([900, 1800])
        expect(g.slot).toBeCloseTo(816 / 9)
        expect(g.bars).toHaveLength(9)
        for (const bar of g.bars) expect(bar.w).toBe(24)
        const first = g.bars[0]
        expect(first.x).toBeCloseTo(LADDER_PAD.left + (g.slot - 24) / 2)
        expect(g.height).toBe(LADDER_PAD.top + 150 + LADDER_PAD.bottom)
    })

    test('a narrow container: a 120-px plot and thinner bars once the slot is small, with a 2-px gap', () => {
        const wide: Ladder = { ...LADDER, bins: Array.from({ length: 20 }, (_, i) => ({ from: 800 + i * 100, count: 3 + i })) }
        const g = ladderGeometry(wide, 311, { you: null })
        expect(g.plot.height).toBe(120)
        expect(g.slot).toBeCloseTo((311 - LADDER_PAD.left - LADDER_PAD.right) / 20)
        expect(g.bars[0].w).toBeCloseTo(g.slot - 2)
    })

    test('counts scale to a clean maximum; gridlines at its half and at it', () => {
        const g = ladderGeometry(LADDER, 848, { you: null })
        expect(g.yMax).toBe(100)
        expect(g.grid.map((line) => line.value)).toEqual([50, 100])
        const tallest = g.bars.find((bar) => bar.count === 85)!
        expect(tallest.h).toBeCloseTo(0.85 * 150)
        expect(tallest.y + tallest.h).toBeCloseTo(LADDER_PAD.top + 150)
    })

    test('each bar takes the rank its bin belongs to, from the ladder (no breakpoint in the code)', () => {
        const g = ladderGeometry(LADDER, 848, { you: null })
        expect(g.bars.map((bar) => bar.key)).toEqual(['DECEC', 'FAKIN', 'FAKIN', 'PAJDAS', 'PAJDAS', 'GOSPON', 'GOSPON', 'MAJSTER', 'MAJSTER'])
        const moved: Ladder = { ...LADDER, ranks: LADDER.ranks.map((r) => (r.key === 'GOSPON' ? { ...r, minRating: 1500 } : r)) }
        expect(ladderGeometry(moved, 848, { you: null }).bars.find((bar) => bar.from === 1400)!.key).toBe('PAJDAS')
    })

    test('rank bands behind the bars, clipped to the domain; a name only where it fits', () => {
        const g = ladderGeometry(LADDER, 848, { you: null })
        expect(g.bands.map((band) => [band.key, band.x0, band.x1])).toEqual([
            ['DECEC', g.x(900), g.x(1000)], ['FAKIN', g.x(1000), g.x(1200)], ['PAJDAS', g.x(1200), g.x(1400)],
            ['GOSPON', g.x(1400), g.x(1600)], ['MAJSTER', g.x(1600), g.x(1800)],
        ])
        expect(g.bands.every((band) => band.label)).toBe(true)
        const narrow = ladderGeometry(LADDER, 311, { you: null })
        // a 31-px Dečec band can't hold its name
        expect(narrow.bands.find((band) => band.key === 'DECEC')!.label).toBe(false)
    })

    test('x ticks at the rank starts inside the domain, dropped when closer than 36 px to the last one', () => {
        expect(ladderGeometry(LADDER, 848, { you: null }).ticks.map((tick) => tick.value)).toEqual([1000, 1200, 1400, 1600])
        const wide: Ladder = { ...LADDER, bins: Array.from({ length: 20 }, (_, i) => ({ from: 800 + i * 100, count: 5 })) }
        const ticks = ladderGeometry(wide, 311, { you: null }).ticks
        for (let i = 1; i < ticks.length; i++) expect(ticks[i].x - ticks[i - 1].x).toBeGreaterThanOrEqual(36)
        expect(ticks.length).toBeLessThan(5)
    })

    test('you at your Elo, inside your bin', () => {
        const g = ladderGeometry(LADDER, 848, { you: 1290 })
        expect(g.you!.x).toBeCloseTo(LADDER_PAD.left + 3.9 * g.slot)
    })

    test('a rating outside the bins widens the domain to hold it', () => {
        const g = ladderGeometry(LADDER, 848, { you: 1850 })
        expect(g.hi).toBe(1900)
    })

    test('one bin only: no zero width, no NaN anywhere (review focus 3)', () => {
        const g = ladderGeometry(FEW_LADDER, 311, { you: 1210 })
        expect([g.lo, g.hi]).toEqual([1200, 1300])
        expect(g.bars).toHaveLength(1)
        expect(JSON.stringify({ ...g, x: undefined })).not.toMatch(/NaN|Infinity|null/)
    })
})

describe('rankOfBin', () => {
    test('the last placed rank starting at or below the bin', () => {
        expect(rankOfBin(900, LADDER.ranks)).toBe('DECEC')
        expect(rankOfBin(1200, LADDER.ranks)).toBe('PAJDAS')
        expect(rankOfBin(2100, LADDER.ranks)).toBe('KAJKAVAC')
    })
})

describe('aheadPercent', () => {
    test('the players in lower bins plus half of your own, over every placed player (spec L-1)', () => {
        expect(aheadPercent(LADDER, 1290)).toBe(49)
        expect(aheadPercent(LADDER, 905)).toBe(4)
        expect(aheadPercent(LADDER, 1790)).toBe(98)
    })
})
