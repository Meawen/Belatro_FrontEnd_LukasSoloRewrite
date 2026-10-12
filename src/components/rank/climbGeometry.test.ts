import { describe, test, expect } from 'vitest'
import { CLIMB_PAD, climbGeometry, FORECAST_GAMES, type ClimbBand } from './climbGeometry'
import { history } from '../../test/fixtures/ranks'

const BANDS: ClimbBand[] = [
    { key: 'DECEC', name: 'Dečec', min: null, max: 1000 },
    { key: 'FAKIN', name: 'Fakin', min: 1000, max: 1200 },
    { key: 'PAJDAS', name: 'Pajdaš', min: 1200, max: 1400 },
    { key: 'GOSPON', name: 'Gospon', min: 1400, max: 1600 },
    { key: 'MAJSTER', name: 'Majster', min: 1600, max: 1800 },
    { key: 'KAJKAVAC', name: 'Kajkavac', min: 1800, max: null },
]

// ranks spec §8.3: your climb's geometry, in CSS px
describe('climbGeometry', () => {
    test('x from the game before the first point to 20 games past the last; the plot is 180 px in a wide container', () => {
        const g = climbGeometry(history({ games: 57 }), 848, { bands: BANDS, nextMinRating: 1600 })
        expect(g.plot).toEqual({ left: CLIMB_PAD.left, top: CLIMB_PAD.top, width: 848 - CLIMB_PAD.left - CLIMB_PAD.right, height: 180 })
        expect([g.g0, g.last, g.gN]).toEqual([0, 57, 57 + FORECAST_GAMES])
        expect(g.x(0)).toBe(CLIMB_PAD.left)
        expect(g.x(77)).toBeCloseTo(CLIMB_PAD.left + g.plot.width)
        expect(climbGeometry(history({ games: 57 }), 343, { bands: BANDS, nextMinRating: 1600 }).plot.height).toBe(150)
    })

    test('the y-range holds the history, the band and the next start, padded and widened to multiples of 50 (C-9)', () => {
        const low = history({ games: 12, rating: 1240, pace: 0.4, step: 40 })
        const g = climbGeometry(low, 848, { bands: BANDS, nextMinRating: 1400 })
        expect(g.y1).toBeGreaterThanOrEqual(1400)
        expect(g.y0 % 50).toBe(0)
        expect(g.y1 % 50).toBe(0)
        expect(g.y(1400)).toBeGreaterThanOrEqual(g.plot.top)
    })

    test('the line starts at the rating before the first point, then every point; the current point is the last', () => {
        const h = history({ games: 57 })
        const g = climbGeometry(h, 848, { bands: BANDS, nextMinRating: 1600 })
        expect(g.line).toHaveLength(58)
        expect(g.line[0]).toEqual({ game: 0, rating: 1200, x: g.x(0), y: g.y(1200) })
        expect(g.current).toEqual({ game: 57, rating: 1452, x: g.x(57), y: g.y(1452) })
        expect(g.dots).toEqual([g.current])
    })

    test('ten points or fewer: a dot on each', () => {
        const g = climbGeometry(history({ games: 3, rating: 1256, pace: null, paceGames: 0 }), 848, { bands: BANDS, nextMinRating: null })
        expect(g.dots).toHaveLength(3)
        expect(g.forecast).toBeNull()
        expect(g.gN).toBe(3)
    })

    test('the forecast: a line to rating + 20·pace, a band of ± step·√m that starts with no width', () => {
        const g = climbGeometry(history({ games: 57, rating: 1452, pace: 4.2, step: 31 }), 848, { bands: BANDS, nextMinRating: 1600 })
        expect(g.forecast!.from).toEqual({ x: g.x(57), y: g.y(1452) })
        expect(g.forecast!.to.y).toBeCloseTo(g.y(1452 + 20 * 4.2))
        const [upper0] = g.forecast!.upper
        const lower0 = g.forecast!.lower[0]
        expect(upper0).toEqual(lower0)
        expect(g.forecast!.upper[20].y).toBeCloseTo(g.y(1452 + 84 + 31 * Math.sqrt(20)))
        expect(g.forecast!.lower[20].y).toBeCloseTo(g.y(1452 + 84 - 31 * Math.sqrt(20)))
    })

    test('rank bands clipped to the range, named only when 16 px tall; the next start drawn', () => {
        const g = climbGeometry(history({ games: 57 }), 848, { bands: BANDS, nextMinRating: 1600 })
        const keys = g.bands.map((band) => band.key)
        expect(keys).toContain('PAJDAS')
        expect(keys).toContain('GOSPON')
        for (const band of g.bands) {
            expect(band.y0).toBeGreaterThanOrEqual(g.plot.top - 0.001)
            expect(band.y1).toBeLessThanOrEqual(g.plot.top + g.plot.height + 0.001)
            expect(band.label).toBe(band.y1 - band.y0 >= 16)
        }
        expect(g.next!.y).toBeCloseTo(g.y(1600))
    })

    test('y ticks at the rank starts inside the range, 14 px apart at least; with none inside, the two ends', () => {
        const g = climbGeometry(history({ games: 57 }), 848, { bands: BANDS, nextMinRating: 1600 })
        expect(g.ticksY.map((tick) => tick.value)).toEqual(expect.arrayContaining([1400, 1600]))
        for (let i = 1; i < g.ticksY.length; i++) expect(Math.abs(g.ticksY[i].y - g.ticksY[i - 1].y)).toBeGreaterThanOrEqual(14)
        const flat = climbGeometry(history({ games: 20, rating: 1300, pace: 0.1, step: 12 }), 343, { bands: [], nextMinRating: null })
        expect(flat.ticksY.map((tick) => tick.value)).toEqual([flat.y0, flat.y1])
    })

    test('x labels: the first game, the current one and +20, without overlaps', () => {
        const g = climbGeometry(history({ games: 57 }), 848, { bands: BANDS, nextMinRating: 1600 })
        expect(g.labelsX.map((label) => label.text)).toEqual(['Game 1', 'Game 57', '+20'])
        // under the first game, not under the rating before it (refine)
        expect(g.labelsX[0].x).toBeCloseTo(g.x(1))
        const one = climbGeometry(history({ games: 1, rating: 1256 }), 343, { bands: BANDS, nextMinRating: 1400 })
        expect(one.labelsX.map((label) => label.text)).not.toContain('Game 1 Game 1')
        expect(one.labelsX.filter((label) => label.text === 'Game 1')).toHaveLength(1)
    })

    test('x labels never touch: a phone with 80 and 100 ranked games (final review, Important 2)', () => {
        for (const games of [57, 80, 100, 160]) {
            const g = climbGeometry(history({ games, rating: 1500 }), 311, { bands: BANDS, nextMinRating: 1600 })
            const spans = [...g.labelsX].sort((a, b) => a.left - b.left)
            for (let i = 1; i < spans.length; i++) expect(spans[i].left - spans[i - 1].right, `${games} games`).toBeGreaterThanOrEqual(6)
            expect(g.labelsX.map((label) => label.text)).toContain(`Game ${games}`)
        }
    })

    test('one point (review focus 3): a real domain, no NaN anywhere', () => {
        const g = climbGeometry(history({ games: 1, rating: 1256, pace: null, paceGames: 0 }), 343, { bands: BANDS, nextMinRating: null })
        expect(g.gN - g.g0).toBeGreaterThanOrEqual(1)
        expect(g.y1).toBeGreaterThan(g.y0)
        expect(JSON.stringify({ ...g, x: undefined, y: undefined })).not.toMatch(/NaN|Infinity/)
    })
})
