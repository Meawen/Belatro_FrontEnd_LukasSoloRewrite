import { describe, test, expect } from 'vitest'
import { nextRankName, placedRanks } from './rankNames'
import { LADDER, rank } from '../../test/fixtures/ranks'

// spec R-3: the next rank's name comes from the ladder, never from a key
describe('nextRankName', () => {
    test('is the ladder entry that starts where this rank ends', () => {
        expect(nextRankName(rank('PAJDAS'), LADDER)).toBe('Gospon')
        expect(nextRankName(rank('DECEC'), LADDER)).toBe('Fakin')
    })

    test('is the name the ladder sends', () => {
        const renamed = { ...LADDER, ranks: LADDER.ranks.map((r) => (r.key === 'GOSPON' ? { ...r, name: 'Renamed' } : r)) }
        expect(nextRankName(rank('PAJDAS'), renamed)).toBe('Renamed')
    })

    test('is null at the top, for Cucek, without a rank or without a ladder', () => {
        expect(nextRankName(rank('KAJKAVAC'), LADDER)).toBeNull()
        expect(nextRankName(rank('CUCEK'), LADDER)).toBeNull()
        expect(nextRankName(undefined, LADDER)).toBeNull()
        expect(nextRankName(rank('PAJDAS'), null)).toBeNull()
    })
})

describe('placedRanks', () => {
    test('the six ranks past placement, in rank order, with their starts', () => {
        expect(placedRanks(LADDER).map((r) => [r.key, r.minRating])).toEqual([
            ['DECEC', null], ['FAKIN', 1000], ['PAJDAS', 1200], ['GOSPON', 1400], ['MAJSTER', 1600], ['KAJKAVAC', 1800],
        ])
    })
})
