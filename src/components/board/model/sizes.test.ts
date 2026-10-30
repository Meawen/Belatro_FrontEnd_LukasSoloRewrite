import { describe, test, expect } from 'vitest'
import { crispSteps, desktopCandidates, floorPair, phoneCandidates, type SizePair } from './sizes'
import { cardSize, type Size } from './cardTargets'

/** Widths to two decimals, as the spec writes them (94.67 for 94.666…). */
const widths = (sizes: Size[]) => sizes.map((size) => size.w)
const near = (values: number[]) => values.map((value) => expect.closeTo(value, 2))
const pairs = (list: SizePair[]) => list.map(({ trick, hand }) => [trick.w, hand.w])
const ratio = ({ trick, hand }: SizePair) => hand.w / trick.w
const SLACK = 1e-6

describe('crispSteps', () => {
    test('every 71·s/dpr between the bounds, smallest first', () => {
        expect(widths(crispSteps(1, 71, 213))).toEqual([71, 142, 213])
        expect(widths(crispSteps(1.25, 56.8, 227.2))).toEqual(near([56.8, 113.6, 170.4, 227.2]))
        expect(widths(crispSteps(2, 71, 213))).toEqual([71, 106.5, 142, 177.5, 213])
        expect(widths(crispSteps(3, 71, 107))).toEqual(near([71, 94.67]))
    })

    test('a bound rounded to 0.01 px still takes its step', () => {
        expect(widths(crispSteps(3, 94.67, 118.33))).toEqual(near([94.67, 118.33]))
    })

    test('each step is 95·s/dpr tall', () => {
        expect(crispSteps(2, 71, 213).map((size) => size.h)).toEqual([95, 142.5, 190, 237.5, 285])
    })
})

describe('phoneCandidates', () => {
    test('biggest first, from the biggest step up to 107 px down to the step nearest 71', () => {
        expect(widths(phoneCandidates(3))).toEqual(near([94.67, 71]))
        expect(widths(phoneCandidates(2))).toEqual([106.5, 71])
        // the next step, 108.19, is over 107
        expect(widths(phoneCandidates(2.625))).toEqual(near([81.14]))
    })

    test.each([0.5, 1, 1.25, 1.5, 2, 2.625, 3])('the last is the step nearest 71 at dpr %s', (dpr) => {
        expect(phoneCandidates(dpr).at(-1)?.w).toBe(cardSize(71, dpr).w)
    })
})

describe('desktopCandidates', () => {
    test('the in-band pairs first, then the fallback, each by the biggest trick and the hand nearest 1.5×', () => {
        expect(pairs(desktopCandidates(1))).toEqual([
            // in band (hand 1.33–1.67× the trick): a tie goes to the smaller hand
            [213, 284], [213, 355], [142, 213],
            // the fallback (1× to 2×): a tie goes to the bigger hand
            [213, 426], [213, 213], [142, 284], [142, 142], [71, 142], [71, 71],
        ])
    })

    test('at 125 % the 113.6/170.4 pair comes before any out-of-band pair with that trick', () => {
        const list = desktopCandidates(1.25)
        const isTrick = (pair: SizePair) => Math.abs(pair.trick.w - 113.6) < 0.01
        const inBand = list.findIndex((pair) => isTrick(pair) && Math.abs(pair.hand.w - 170.4) < 0.01)
        expect(inBand).toBeGreaterThanOrEqual(0)
        list.forEach((pair, i) => {
            const outOfBand = ratio(pair) < 1.33 - SLACK || ratio(pair) > 1.67 + SLACK
            if (isTrick(pair) && outOfBand) expect(i).toBeGreaterThan(inBand)
        })
    })

    test('every pair has the hand 1× to 2× the trick, and the trick from the floor to 213 px', () => {
        const floor = cardSize(71, 1.25).w
        for (const pair of desktopCandidates(1.25)) {
            expect(ratio(pair)).toBeGreaterThanOrEqual(1 - SLACK)
            expect(ratio(pair)).toBeLessThanOrEqual(2 + SLACK)
            expect(pair.trick.w).toBeGreaterThanOrEqual(floor - SLACK)
            expect(pair.trick.w).toBeLessThanOrEqual(213 + SLACK)
        }
    })

    test.each([0.5, 3])('non-empty and finite at dpr %s', (dpr) => {
        const list = desktopCandidates(dpr)
        expect(list.length).toBeGreaterThan(0)
        for (const { trick, hand } of list) {
            for (const value of [trick.w, trick.h, hand.w, hand.h]) expect(Number.isFinite(value)).toBe(true)
        }
    })
})

describe('floorPair', () => {
    test('the floor trick with the hand nearest 1.5×, a tie of 1× and 2× to the bigger hand', () => {
        expect(pairs([floorPair(1)])).toEqual([[71, 142]])
    })
})
