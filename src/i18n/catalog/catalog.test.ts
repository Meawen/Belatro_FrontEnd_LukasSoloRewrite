import { describe, test, expect } from 'vitest'
import { en } from './en'
import { hr } from './hr'

/** Every leaf of a catalog as [dotted.path, value], depth-first. */
function leaves(node: object, prefix = ''): [string, unknown][] {
    return Object.entries(node).flatMap(([key, value]): [string, unknown][] => {
        const path = prefix ? `${prefix}.${key}` : key
        return value !== null && typeof value === 'object' ? leaves(value, path) : [[path, value]]
    })
}

describe('the catalogs (spec §1.2)', () => {
    test('hr has every key of en and nothing else, each non-empty (deep key walk)', () => {
        const enLeaves = new Map(leaves(en))
        const hrLeaves = new Map(leaves(hr))
        expect([...hrLeaves.keys()].sort()).toEqual([...enLeaves.keys()].sort())
        for (const [path, enValue] of enLeaves) {
            const hrValue = hrLeaves.get(path)
            for (const value of [enValue, hrValue]) {
                if (typeof value === 'string') expect(value.trim(), path).not.toBe('')
                else expect(typeof value, path).toBe('function')
            }
            expect(typeof hrValue, path).toBe(typeof enValue)
            if (typeof enValue === 'function' && typeof hrValue === 'function') expect(hrValue.length, path).toBe(enValue.length)
        }
    })

    test('the §1.4 names in the page titles', () => {
        const names = (titles: typeof en.titles) => [titles.home, titles.tables, titles.table, titles.matches, titles.friends, titles.profile, titles.settings, titles.ranked]
        expect(names(hr.titles)).toEqual(['Doma', 'Birtija', 'Stol', 'Zapisnik', 'Pajdaši', 'Profil', 'Postavke', 'Rangirano'])
        expect(names(en.titles)).toEqual(['Home', 'Tables', 'Table', 'Matches', 'Friends', 'Profile', 'Settings', 'Ranked'])
    })
})
