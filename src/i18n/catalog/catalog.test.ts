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

    test('the §1.4 names S4 shows', () => {
        expect(hr.tables.privateTable).toBe('Stol za ekipu')
        expect(hr.ranked.find).toBe('Igraj rangirano')
        expect(hr.ranked.searching).toBe('Tražimo ti pajdaše…')
        expect(hr.matchDetails.capot).toBe('ŠTIGLJA')
        expect(hr.matchDetails.pass).toBe('DALJE')
        expect(en.tables.privateTable).toBe('Private table')
        expect(en.ranked.searching).toBe('Finding players…')
    })

    test("S4's counts: three Croatian forms around 11–14 and 21–24", () => {
        expect([1, 2, 5, 11, 12, 21, 22, 25].map(hr.matches.count)).toEqual(
            ['1 partija', '2 partije', '5 partija', '11 partija', '12 partija', '21 partija', '22 partije', '25 partija'])
        expect([1, 2, 5, 21, 22].map(hr.tables.bots)).toEqual(['1 bot', '2 bota', '5 botova', '21 bot', '22 bota'])
        expect([1, 2, 5].map(hr.tables.open)).toEqual(['1 otvoren stol', '2 otvorena stola', '5 otvorenih stolova'])
        expect([1, 2, 12].map(hr.admin.users.found)).toEqual(['Pronađen 1 korisnik', 'Pronađena 2 korisnika', 'Pronađeno 12 korisnika'])
        expect([1, 2, 4].map(hr.matchDetails.cardCount)).toEqual(['1 karta', '2 karte', '4 karte'])
    })
})
