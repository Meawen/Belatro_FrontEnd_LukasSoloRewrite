import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'
import type { ErrorCode } from './serverErrors'

// Node 26's own localStorage global is unusable here; borrow jsdom's (see services/api.test.ts)
const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

beforeEach(() => {
    vi.stubGlobal('localStorage', jsdomStorage)
    jsdomStorage.clear()
    vi.resetModules()
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

// copied from backend exceptions/ErrorCodes.java at 9b572f6; a later task that adds a code adds it here and a line in
// both catalogs (Ruling 4)
const BACKEND_CODES = [
    'SESSION_EXPIRED', 'UNAUTHENTICATED', 'BAD_CREDENTIALS', 'WRONG_PASSWORD', 'ACCESS_DENIED', 'RATE_LIMITED',
    'SERVICE_UNAVAILABLE', 'INVITE_CODE_INVALID', 'USERNAME_TAKEN', 'EMAIL_TAKEN', 'LINK_INVALID', 'NOTHING_TO_CONFIRM',
    'EMAIL_UNCHANGED', 'PASSWORD_BLANK', 'EMAIL_NOT_VERIFIED', 'PAGE_INVALID', 'SEARCH_INVALID', 'BOT_NOT_DELETABLE',
    'FRIEND_USER_REQUIRED', 'FRIEND_SELF', 'FRIEND_IS_BOT', 'FRIENDSHIP_NOT_YOURS', 'FRIEND_SENDER_ONLY',
    'FRIEND_RECIPIENT_ONLY', 'FRIENDSHIP_FINAL', 'LOBBY_ID_REQUIRED', 'LOBBY_NOT_FOUND', 'HOST_CANNOT_LEAVE',
    'KICK_TARGET_REQUIRED', 'NOT_IN_LOBBY', 'LOBBY_PASSWORD_REQUIRED', 'LOBBY_PASSWORD_WRONG', 'LOBBY_PASSWORD_TOO_LONG',
    'LOBBY_CLOSED', 'LOBBY_FULL', 'TEAM_REQUIRED', 'TEAM_INVALID', 'TEAM_FULL', 'TEAMS_INCOMPLETE', 'PLAYERS_UNASSIGNED',
    'BOTS_CASUAL_ONLY', 'NO_BOT_FREE', 'NO_SEAT_TO_FILL', 'ALREADY_QUEUED', 'DECLINE_TOO_LATE', 'HOST_ONLY',
    'DECLINE_COOLDOWN', 'NOT_A_PARTICIPANT', 'USER_NOT_FOUND', 'FRIENDSHIP_NOT_FOUND', 'MATCH_NOT_FOUND', 'SORT_UNKNOWN',
    'VALIDATION',
]

// copied from backend ErrorCodesTest.STOMP_SENTENCES / STOMP_PREFIXES (a prefix followed by a game id)
const STOMP: [string, ErrorCode][] = [
    ['Game not found', 'GAME_NOT_FOUND'],
    ["You can't challenge now", 'CANT_CHALLENGE'],
    ['Declarations are being said', 'DECLARATIONS_BEING_SAID'],
    ['The dealer must call trump', 'DEALER_MUST_CALL'],
    ['Wait for the post-hand pause to end', 'WAIT_FOR_PAUSE'],
    ['Not a participant in game 6ae4f0', 'NOT_A_PARTICIPANT'],
    ['Rematch is not available for game g1', 'REMATCH_UNAVAILABLE'],
]

const GENERIC_HR = 'Nešto je pošlo po zlu. Pokušaj ponovno.'
const PASSWORD_SENTENCE = 'Password must be at least 8 characters and at most 72 bytes'
const USERNAME_SENTENCE = 'Username must be 3-20 characters: English letters a-z, digits or underscore'

const load = async () => ({
    ...(await import('./serverErrors')),
    ...(await import('./lang')),
    ...(await import('../services/api')),
    ...(await import('./catalog/en')),
    ...(await import('./catalog/hr')),
})

describe("server errors in the site's language (spec §1.1, §8)", () => {
    test('every code the backend sends, and every game refusal, has a line in both catalogs, and nothing else does', async () => {
        const { en, hr } = await load()
        const expected = [...new Set([...BACKEND_CODES, ...STOMP.map(([, code]) => code)])].sort()
        expect(expected).toHaveLength(59)
        expect(Object.keys(en.errors.codes).sort()).toEqual(expected)
        expect(Object.keys(hr.errors.codes).sort()).toEqual(expected)
    })

    test('a known code gives its line, in English and in Croatian', async () => {
        const { localiseApiError, ApiError, setLang, en, hr } = await load()
        const full = new ApiError({ status: 409, message: 'Lobby is full', code: 'LOBBY_FULL' })
        expect(localiseApiError(full)).toBe('This table is full. Choose another one, or open your own.')
        const lines = Object.entries(en.errors.codes).filter(([, line]) => typeof line === 'string')
        const coded = (code: string) => new ApiError({ status: 400, message: 'x', code })
        for (const [code, line] of lines) expect(localiseApiError(coded(code)), code).toBe(line)

        setLang('hr')
        expect(localiseApiError(full)).toBe('Ovaj je stol pun. Odaberi drugi ili otvori svoj.')
        for (const [code] of lines) expect(localiseApiError(coded(code)), code).toBe(hr.errors.codes[code as ErrorCode])
    })

    test("an unknown code: Croatian shows the generic line, English keeps the server's own sentence", async () => {
        const { localiseApiError, ApiError, setLang } = await load()
        const unknown = [
            new ApiError({ status: 404, message: 'Not Found', code: 'HTTP_404' }),
            new ApiError({ status: 400, message: 'A newer sentence', code: 'SOMETHING_NEW' }),
            // inherited from Object.prototype, not a line
            new ApiError({ status: 400, message: 'Not a code: constructor', code: 'constructor' }),
            new ApiError({ status: 400, message: 'Not a code: toString', code: 'toString' }),
        ]
        for (const err of unknown) expect(localiseApiError(err), err.code).toBe(err.message)

        setLang('hr')
        for (const err of unknown) expect(localiseApiError(err), err.code).toBe(GENERIC_HR)
    })

    test("a body without a code (an older server, or Spring's own error page) is unmapped", async () => {
        const { localiseApiError, ApiError, setLang } = await load()
        const codeless = new ApiError({ status: 409, message: 'Lobby is full' })
        expect(localiseApiError(codeless)).toBe('Lobby is full')
        setLang('hr')
        expect(localiseApiError(codeless)).toBe(GENERIC_HR)
    })

    test('a network failure says the generic line in Croatian', async () => {
        const { localiseApiError, ApiError, setLang } = await load()
        const offline = new ApiError({ status: 0, message: 'Failed to fetch' })
        expect(localiseApiError(offline)).toBe('Failed to fetch')
        setLang('hr')
        expect(localiseApiError(offline)).toBe(GENERIC_HR)
    })

    test('the decline cooldown carries its seconds, with Croatian plurals', async () => {
        const { localiseApiError, ApiError, setLang } = await load()
        const cooldown = (n: number) =>
            new ApiError({ status: 429, message: `You declined a match; you can queue again in ${n} s`, code: 'DECLINE_COOLDOWN' })
        // no number to put in the line
        const bare = new ApiError({ status: 429, message: 'You declined a match', code: 'DECLINE_COOLDOWN' })
        expect(localiseApiError(cooldown(1))).toBe('You declined a match. Wait 1 more second, then queue again.')
        expect(localiseApiError(cooldown(97))).toBe('You declined a match. Wait 97 more seconds, then queue again.')
        expect(localiseApiError(bare)).toBe('You declined a match')

        setLang('hr')
        const words: [number, string][] = [[1, 'sekundu'], [2, 'sekunde'], [5, 'sekundi'], [21, 'sekundu'], [22, 'sekunde'], [97, 'sekundi']]
        for (const [n, word] of words) {
            expect(localiseApiError(cooldown(n))).toBe(`Nakon odbijene partije pričekaj još ${n} ${word} pa opet traži partiju.`)
        }
        expect(localiseApiError(bare)).toBe(GENERIC_HR)
    })

    test("the credential rules read in the site's language, with VALIDATION or without a code", async () => {
        const { localiseApiError, ApiError, setLang } = await load()
        const rules = [
            [PASSWORD_SENTENCE, 'Lozinka mora imati najmanje 8 znakova i najviše 72 bajta.'],
            [USERNAME_SENTENCE, 'Korisničko ime mora imati 3–20 znakova: slova a–z bez kvačica, brojke ili donju crtu.'],
        ]
        for (const code of ['VALIDATION', undefined]) {
            for (const [sentence] of rules) {
                expect(localiseApiError(new ApiError({ status: 400, message: sentence, code })), `${code} ${sentence}`).toBe(sentence)
            }
        }

        setLang('hr')
        for (const code of ['VALIDATION', undefined]) {
            for (const [sentence, line] of rules) {
                expect(localiseApiError(new ApiError({ status: 400, message: sentence, code })), `${code} ${sentence}`).toBe(line)
            }
        }
    })

    test('any other VALIDATION field message gets the form line', async () => {
        const { localiseApiError, ApiError, setLang } = await load()
        const invalid = new ApiError({ status: 400, message: 'must be a well-formed email address', code: 'VALIDATION' })
        expect(localiseApiError(invalid)).toBe("Something you entered isn't valid. Check the form and try again.")
        setLang('hr')
        expect(localiseApiError(invalid)).toBe('Nešto od upisanog nije ispravno. Provjeri obrazac i pokušaj ponovno.')
    })

    test('at sign-in a translated "Bad credentials" (HTTP_401) is a wrong username or password (Ruling 16)', async () => {
        const { localiseLoginError, localiseApiError, ApiError, setLang } = await load()
        const translated = new ApiError({ status: 401, message: 'Ungültige Anmeldedaten', code: 'HTTP_401' })
        const coded = new ApiError({ status: 401, message: 'Bad credentials', code: 'BAD_CREDENTIALS' })
        const limited = new ApiError({ status: 429, message: 'Too many requests, try again later', code: 'RATE_LIMITED' })
        const wrong = 'Wrong username or password. Check both and try again.'
        expect(localiseLoginError(translated)).toBe(wrong)
        expect(localiseLoginError(coded)).toBe(wrong)
        expect(localiseLoginError(limited)).toBe('Too many tries. Wait a little, then try again.')
        // any other screen: a 401 there is not about a name and a password
        expect(localiseApiError(translated)).toBe('Ungültige Anmeldedaten')

        setLang('hr')
        const wrongHr = 'Pogrešno korisničko ime ili lozinka. Provjeri oboje i pokušaj ponovno.'
        expect(localiseLoginError(translated)).toBe(wrongHr)
        expect(localiseLoginError(coded)).toBe(wrongHr)
        expect(localiseLoginError(limited)).toBe('Previše pokušaja. Pričekaj malo pa pokušaj ponovno.')
        expect(localiseApiError(translated)).toBe(GENERIC_HR)
    })

    test('every game refusal maps to its code', async () => {
        const { stompErrorCode } = await load()
        for (const [sentence, code] of STOMP) expect(stompErrorCode(sentence), sentence).toBe(code)
        expect(stompErrorCode('Something the server never says')).toBeNull()
        // a prefix needs its trailing space and a game id
        expect(stompErrorCode('Not a participant in game')).toBeNull()
    })

    test("a game refusal reads in the site's language", async () => {
        const { localiseStompError, setLang, en, hr } = await load()
        for (const [sentence, code] of STOMP) expect(localiseStompError(sentence), sentence).toBe(en.errors.codes[code])
        expect(localiseStompError('The dealer must call trump')).toBe('You must call trump.')
        expect(localiseStompError('Something the server never says')).toBe('Something the server never says')

        setLang('hr')
        for (const [sentence, code] of STOMP) expect(localiseStompError(sentence), sentence).toBe(hr.errors.codes[code])
        expect(localiseStompError('The dealer must call trump')).toBe('Mus! Moraš zvati.')
        expect(localiseStompError('Something the server never says')).toBe(GENERIC_HR)
    })

    test("English keeps the game's own word: zvanja (§1.3, carried b)", async () => {
        const { localiseStompError } = await load()
        expect(localiseStompError('Declarations are being said')).toBe('Wait until the zvanja are shown, then play your card.')
    })

    test('the table lines name Birtija and „Ajmo još jednu!” (carried)', async () => {
        const { localiseApiError, localiseStompError, ApiError, setLang } = await load()
        setLang('hr')
        expect(localiseApiError(new ApiError({ status: 400, message: 'x', code: 'LOBBY_ID_REQUIRED' })))
            .toBe('Poveznica stola nije ispravna. Otvori stol ponovno iz Birtije.')
        expect(localiseStompError('Rematch is not available for game g1'))
            .toBe('„Ajmo još jednu!” za ovu partiju više nije moguće. Vrati se u Birtiju i sjedni za novi stol.')
    })
})
