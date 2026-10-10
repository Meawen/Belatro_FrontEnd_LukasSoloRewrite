import { describe, test, expect } from 'vitest'
import { parseMatchResult, resultWinner, teamOfUser, yourResult } from './matchResult'

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

    test('text it cannot read gives no points, never a made-up 0 : 0 (spec §3.1 rule 6)', () => {
        expect(parseMatchResult('Match abandoned')).toBeNull()
    })
})

const match = (result: string | null) => ({
    result,
    teamA: [{ id: 'u1', username: 'ana' }, { id: 'u2', username: 'bob' }],
    teamB: [{ id: 'u3', username: 'cy' }, { id: 'u4', username: 'dan' }],
})

describe('resultWinner and yourResult (spec §4.9; R-36)', () => {
    test('the winner is the team the result names, a forfeit included', () => {
        expect(['Team B wins 870–1001', 'Team A wins 1001-650', 'Team B wins by forfeit', 'Match abandoned', null].map(resultWinner))
            .toEqual(['B', 'A', 'B', null, null])
    })

    test('my team comes from teamA / teamB by my id', () => {
        expect(['u2', 'u3', 'u9', null].map((id) => teamOfUser(match(null), id))).toEqual(['A', 'B', null, null])
    })

    test('WIN when the result names my team, LOSS when it names the other, a forfeit included', () => {
        expect(yourResult(match('Team A wins 1001–650'), 'u1')).toBe('WIN')
        expect(yourResult(match('Team A wins 1001–650'), 'u3')).toBe('LOSS')
        expect(yourResult(match('Team B wins by forfeit'), 'u4')).toBe('WIN')
        expect(yourResult(match('Team B wins by forfeit'), 'u2')).toBe('LOSS')
    })

    test('the raw result when it does not parse, or when I am in neither team; nothing without one', () => {
        expect(yourResult(match('Team A wins'), 'u1')).toBe('Team A wins')
        expect(yourResult(match('Match abandoned'), 'u1')).toBe('Match abandoned')
        expect(yourResult(match('Team A wins 1001–650'), 'u9')).toBe('Team A wins 1001–650')
        expect(yourResult(match(null), 'u1')).toBeNull()
    })
})
