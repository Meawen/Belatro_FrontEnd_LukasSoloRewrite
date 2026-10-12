import { describe, test, expect } from 'vitest'
import { forecastLines } from './forecastText'
import { history, rank } from '../../test/fixtures/ranks'

const primaryText = (lines: ReturnType<typeof forecastLines>) => (lines.primary ? lines.primary.join('') : null)

// ranks spec §8.4: the texts under your climb, word for word (primer decision 2)
describe('forecastLines', () => {
    test('rising with a next rank in reach: "At this pace: {next} in about {n} games", the name in bold (C-1)', () => {
        const lines = forecastLines(history({ rating: 1452, pace: 4.2, step: 31 }), rank('GOSPON'), 'Majster')
        expect(primaryText(lines)).toBe('At this pace: Majster in about 36 games')
        expect(lines.primary![1]).toBe('Majster')
        expect(lines.luck).toBe('Luck alone can move you about ±139 points over 20 games.')
    })

    test('one game away reads in the singular', () => {
        expect(primaryText(forecastLines(history({ rating: 1597, pace: 4.2 }), rank('GOSPON'), 'Majster'))).toBe('At this pace: Majster in about 1 game')
    })

    test('more than 100 games away (C-2)', () => {
        const lines = forecastLines(history({ rating: 1452, pace: 0.5 }), rank('GOSPON'), 'Majster')
        expect(primaryText(lines)).toBe('Majster is more than 100 games away at this pace.')
    })

    test.each([[-2], [0]])('pace %d: the gap as wins over losses (C-3)', (pace) => {
        const lines = forecastLines(history({ rating: 1452, pace, step: 31 }), rank('GOSPON'), 'Majster')
        expect(primaryText(lines)).toBe('148 points to Majster: about 5 more wins than losses.')
        expect(lines.primary![1]).toBe('Majster')
    })

    test('one win short reads in the singular', () => {
        expect(primaryText(forecastLines(history({ rating: 1580, pace: -1, step: 31 }), rank('GOSPON'), 'Majster'))).toBe('20 points to Majster: about 1 more win than losses.')
    })

    test('the top rank: its name and "the top rank.", the luck line still (C-4)', () => {
        const lines = forecastLines(history({ rating: 1846, pace: 3 }), rank('KAJKAVAC'), null)
        expect(primaryText(lines)).toBe('Kajkavac: the top rank.')
        expect(lines.luck).not.toBeNull()
    })

    test('placement: the count, no luck line (C-5)', () => {
        const lines = forecastLines(history({ games: 3, rating: 1256, pace: null, paceGames: 0 }), rank('CUCEK'), null)
        expect(primaryText(lines)).toBe('Placement: 3 of 10 ranked games')
        expect(lines.luck).toBeNull()
    })

    test('without the next name: "the next rank"', () => {
        expect(primaryText(forecastLines(history({ rating: 1452, pace: 4.2 }), rank('GOSPON'), null))).toBe('At this pace: the next rank in about 36 games')
    })

    test('the history already at or past the next start (review focus 2): no target line, never "about 0 games"', () => {
        const lines = forecastLines(history({ rating: 1610, pace: 4.2 }), rank('GOSPON'), 'Majster')
        expect(lines.primary).toBeNull()
        expect(lines.luck).not.toBeNull()
    })

    test('no rank (the profile has none): no target line', () => {
        expect(forecastLines(history(), undefined, null).primary).toBeNull()
    })
})
