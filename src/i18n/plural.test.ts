import { describe, test, expect } from 'vitest'
import { plural, type PluralForms } from './plural'
import type { Lang } from './lang'

const counted = (ns: number[], forms: PluralForms, lang: Lang) => ns.map((n) => `${n} ${plural(n, forms, lang)}`).join(', ')

describe('plural (spec §1.1: three Croatian forms)', () => {
    test('English: one and other', () => {
        expect(counted([0, 1, 2, 21], { one: 'match', other: 'matches' }, 'en')).toBe('0 matches, 1 match, 2 matches, 21 matches')
    })

    // Review focus 5
    test('Croatian forms around 11–14 and 21–24', () => {
        expect(counted([1, 2, 5, 11, 12, 21, 22, 25], { one: 'partija', few: 'partije', other: 'partija' }, 'hr'))
            .toBe('1 partija, 2 partije, 5 partija, 11 partija, 12 partija, 21 partija, 22 partije, 25 partija')
        // "partija" reads the same for one and other; "stol" doesn't, so this catches a one/other mix-up
        expect(counted([1, 2, 4, 5, 11, 12, 14, 21, 22, 24, 25], { one: 'stol', few: 'stola', other: 'stolova' }, 'hr'))
            .toBe('1 stol, 2 stola, 4 stola, 5 stolova, 11 stolova, 12 stolova, 14 stolova, 21 stol, 22 stola, 24 stola, 25 stolova')
    })

    test('a missing few falls back to other', () => {
        expect(plural(2, { one: 'a', other: 'b' }, 'hr')).toBe('b')
    })
})
