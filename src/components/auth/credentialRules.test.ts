import { describe, test, expect } from 'vitest'
import { passwordRuleError, usernameRuleError } from './credentialRules'
import { en } from '../../i18n/catalog/en'
import { setLang } from '../../i18n/lang'

const PASSWORD_RULE_MESSAGE = en.errors.rules.password
const USERNAME_RULE_MESSAGE = en.errors.rules.username

describe('passwordRuleError (mirrors backend @ValidPassword)', () => {
    test('8 characters is enough, 7 is not', () => {
        expect(passwordRuleError('12345678')).toBeNull()
        expect(passwordRuleError('1234567')).toBe(PASSWORD_RULE_MESSAGE)
    })
    test('the minimum counts code points like the backend, not UTF-16 units', () => {
        // each emoji is one code point but two UTF-16 units (and 4 bytes)
        expect(passwordRuleError('😀'.repeat(4))).toBe(PASSWORD_RULE_MESSAGE)
        expect(passwordRuleError('😀'.repeat(8))).toBeNull()
    })
    test('the cap is 72 bytes of UTF-8, not 72 characters', () => {
        expect(passwordRuleError('a'.repeat(72))).toBeNull()
        expect(passwordRuleError('a'.repeat(73))).toBe(PASSWORD_RULE_MESSAGE)
        // 37 x "ä" is 37 characters but 74 bytes
        expect(passwordRuleError('ä'.repeat(37))).toBe(PASSWORD_RULE_MESSAGE)
    })
    test('a password of only spaces is refused, like the backend refuses a blank one', () => {
        expect(passwordRuleError('        ')).toBe(PASSWORD_RULE_MESSAGE)
    })
    test('the message is the backend one, word for word', () => {
        expect(PASSWORD_RULE_MESSAGE).toBe('Password must be at least 8 characters and at most 72 bytes')
    })
})

describe('usernameRuleError (mirrors SignupRequestDTO @Pattern)', () => {
    test('letters, digits and underscore, 3 to 20 long', () => {
        expect(usernameRuleError('Ana_99')).toBeNull()
        expect(usernameRuleError('ab')).toBe(USERNAME_RULE_MESSAGE)
        expect(usernameRuleError('a'.repeat(21))).toBe(USERNAME_RULE_MESSAGE)
        expect(usernameRuleError('ana.b')).toBe(USERNAME_RULE_MESSAGE)
        expect(usernameRuleError('ana b')).toBe(USERNAME_RULE_MESSAGE)
    })
    test('č ć š ž đ and their capitals are letters, as on the server (backend UsernamesTest)', () => {
        for (const name of ['Matić', 'ĐURO_7', 'abc', 'ž'.repeat(20), 'mišo', 'ŠĐŽČĆšđžčćŠĐŽČĆšđžčć']) {
            expect(usernameRuleError(name), name).toBeNull()
        }
        // 'c\u030Cevapi' is a decomposed č (c + U+030C, combining caron), which the server refuses too
        for (const name of ['ab', 'a'.repeat(21), 'ž'.repeat(21), 'bad name!', 'miño', 'Bot-Ana', 'c\u030Cevapi']) {
            expect(usernameRuleError(name), name).toBe(USERNAME_RULE_MESSAGE)
        }
    })
    test('the reserved obrisan_ prefix is left to the server (USERNAME_RESERVED)', () => {
        expect(usernameRuleError('obrisan_x')).toBeNull()
    })
    test('the message is the backend one, word for word', () => {
        expect(USERNAME_RULE_MESSAGE).toBe('Username must be 3–20 characters: letters (including č ć š ž đ), digits or _')
    })
})

describe('the rules in Croatian', () => {
    test("the forms' own check reads in the site's language", () => {
        setLang('hr')
        try {
            expect(passwordRuleError('1234567')).toBe('Lozinka mora imati najmanje 8 znakova i najviše 72 bajta.')
            expect(usernameRuleError('ab')).toBe('Korisničko ime mora imati 3–20 znakova: slova (i č ć š ž đ), brojke ili donju crtu.')
        } finally {
            setLang('en')
        }
    })
})
