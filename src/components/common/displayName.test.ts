import { describe, test, expect } from 'vitest'
import { displayName } from './displayName'
import { setLang } from '../../i18n/lang'

describe('displayName (spec §3.1)', () => {
    test('a removed account (obrisan_…) reads Guest; any other name is shown as it is', () => {
        expect(displayName('obrisan_3fa9c2d1')).toBe('Guest')
        for (const name of ['gost_4821', 'matić', 'ana_obrisan_x', '']) expect(displayName(name), name).toBe(name)
    })

    test('in Croatian a removed account is Gost (§1.4)', () => {
        setLang('hr')
        try {
            expect(displayName('obrisan_3fa9c2d1')).toBe('Gost')
        } finally {
            setLang('en')
        }
    })
})
