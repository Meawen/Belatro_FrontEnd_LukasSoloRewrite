import { describe, test, expect } from 'vitest'
import { parseMatchResult } from './matchResult'

describe('parseMatchResult (R-36)', () => {
    test("Team A's points come first even when Team B wins (en dash, as the backend writes it)", () => {
        expect(parseMatchResult('Team B wins 870–1001')).toEqual({ teamAScore: 870, teamBScore: 1001 })
    })

    test('a hyphen works too', () => {
        expect(parseMatchResult('Team A wins 1001-650')).toEqual({ teamAScore: 1001, teamBScore: 650 })
    })

    test('spaces around the dash are fine', () => {
        expect(parseMatchResult('Team A wins 1001 – 650')).toEqual({ teamAScore: 1001, teamBScore: 650 })
    })

    test('a forfeit has no points', () => {
        expect(parseMatchResult('Team A wins by forfeit')).toBe('forfeit')
    })
})
