import { describe, test, expect } from 'vitest'
import { fold } from './fold'

describe('fold (backend Usernames.fold, spec §1.5)', () => {
    test('lower case, with the marks taken off č ć š ž đ (the backend UsernamesTest cases)', () => {
        expect(fold('ČĆŠŽĐčćšžđ')).toBe('ccszdccszd')
        expect(fold('Matić')).toBe('matic')
        expect(fold('đuro')).toBe('duro')
        expect(fold('ŠIME_99')).toBe('sime_99')
    })

    test('every other character is kept', () => {
        expect(fold('Bot-Ana')).toBe('bot-ana')
        expect(fold('a_c')).toBe('a_c')
        expect(fold('Kod Mire, 2')).toBe('kod mire, 2')
    })
})
