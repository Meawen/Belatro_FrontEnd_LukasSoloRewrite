import { describe, test, expect, vi, afterEach } from 'vitest'
import {
    GSI_URL,
    clearPendingGoogle,
    emailFromCredential,
    googleClientId,
    loadGoogle,
    peekPendingGoogle,
    renderGoogleButton,
    sameGoogleAccount,
    setPendingGoogle,
    subscribePendingGoogle,
} from './googleSignIn'

/** base64url, as a JWT's parts are: no padding, - and _ for + and /. */
const part = (value: unknown) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url')
/** A Google ID token's shape (header.payload.signature); only the payload matters here. */
const credentialWith = (payload: unknown) => `${part({ alg: 'RS256', kid: 'k1' })}.${part(payload)}.c2lnbmF0dXJl`

const gsiScripts = () => [...document.querySelectorAll(`script[src="${GSI_URL}"]`)] as HTMLScriptElement[]

/** Google Identity Services as the page sees it once its script ran: the two calls this site makes. */
function stubGoogle() {
    const id = { initialize: vi.fn(), renderButton: vi.fn() }
    vi.stubGlobal('google', { accounts: { id } })
    return id
}

afterEach(() => {
    // a load a test left in flight fails, so the next test starts with no script and nothing cached
    for (const script of gsiScripts()) {
        script.dispatchEvent(new Event('error'))
        script.remove()
    }
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    clearPendingGoogle()
})

describe('googleClientId (plan, SPA names: reachable from this module)', () => {
    test('the client id, or null when VITE_GOOGLE_CLIENT_ID is unset or blank', () => {
        vi.stubEnv('VITE_GOOGLE_CLIENT_ID', ' client-1.apps.googleusercontent.com ')
        expect(googleClientId()).toBe('client-1.apps.googleusercontent.com')
        vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '  ')
        expect(googleClientId()).toBeNull()
    })
})

describe('emailFromCredential (Google sign-in spec §4: the address, for display only)', () => {
    test("reads the payload's email: base64url with - and _, no padding, and a UTF-8 address", () => {
        // ">>>?" and "???" in the payload make + and / in plain base64, - and _ in base64url
        const tricky = { email: 'ana@gmail.com', note: '>>>???' }
        expect(credentialWith(tricky).split('.')[1]).toMatch(/[-_]/)
        expect(credentialWith(tricky).split('.')[1]).not.toMatch(/=$/)
        expect(emailFromCredential(credentialWith(tricky))).toBe('ana@gmail.com')
        expect(emailFromCredential(credentialWith({ email: 'željka.čavić@primjer.hr' }))).toBe('željka.čavić@primjer.hr')
    })

    test.each([
        ['nothing', ''],
        ['junk', 'not a token'],
        ['two parts', `${part({ alg: 'RS256' })}.${part({ email: 'ana@gmail.com' })}`],
        ['a payload that is not base64', `${part({ alg: 'RS256' })}.%%%.sig`],
        ['a payload that is not JSON', `${part({ alg: 'RS256' })}.${part('{email:')}.sig`],
        ['a payload of null', credentialWith(null)],
        ['no email', credentialWith({ sub: '1234' })],
        ['an email that is not a string', credentialWith({ email: 42 })],
    ])('returns null for %s', (_, credential) => {
        expect(emailFromCredential(credential)).toBeNull()
    })
})

describe('sameGoogleAccount (S2 A-2: the next tap after an expired token)', () => {
    test('the address the name step shows, trimmed and in any case', () => {
        expect(sameGoogleAccount(credentialWith({ email: 'ana@gmail.com' }), 'ana@gmail.com')).toBe(true)
        expect(sameGoogleAccount(credentialWith({ email: ' Ana@Gmail.COM ' }), 'ana@gmail.com ')).toBe(true)
        expect(sameGoogleAccount(credentialWith({ email: 'željka@primjer.hr' }), 'ŽELJKA@primjer.hr')).toBe(true)
    })

    test('another Google account is not', () => {
        expect(sameGoogleAccount(credentialWith({ email: 'ivo@gmail.com' }), 'ana@gmail.com')).toBe(false)
        expect(sameGoogleAccount(credentialWith({ email: 'ana@gmail.com' }), '')).toBe(false)
    })

    test("a token whose address can't be read counts as the same: the server checks it again", () => {
        expect(sameGoogleAccount('not-a-token', 'ana@gmail.com')).toBe(true)
        expect(sameGoogleAccount(credentialWith({ sub: '1234' }), 'ana@gmail.com')).toBe(true)
    })
})

describe('loadGoogle (spec §6.3: on demand, never in index.html)', () => {
    test('one script tag, async, for any number of callers; resolves when google.accounts.id is there', async () => {
        const first = loadGoogle()
        const second = loadGoogle()
        expect(gsiScripts()).toHaveLength(1)
        expect(gsiScripts()[0].async).toBe(true)
        stubGoogle()
        gsiScripts()[0].dispatchEvent(new Event('load'))
        await expect(first).resolves.toBeUndefined()
        await expect(second).resolves.toBeUndefined()
        // loaded: the next caller is answered at once, with no new tag
        await expect(loadGoogle()).resolves.toBeUndefined()
        expect(gsiScripts()).toHaveLength(1)
    })

    test('a script that fails to load (blocked) rejects, and the next try loads it again', async () => {
        const load = loadGoogle()
        gsiScripts()[0].dispatchEvent(new Event('error'))
        await expect(load).rejects.toThrow()
        expect(gsiScripts()).toHaveLength(0)
        void loadGoogle().catch(() => {})
        expect(gsiScripts()).toHaveLength(1)
    })

    test("a script that loads without google.accounts.id (a blocker's stand-in) rejects, and the next try loads it again", async () => {
        const load = loadGoogle()
        gsiScripts()[0].dispatchEvent(new Event('load'))
        await expect(load).rejects.toThrow()
        expect(gsiScripts()).toHaveLength(0)
        void loadGoogle().catch(() => {})
        expect(gsiScripts()).toHaveLength(1)
    })

    test('a script with no answer after 10 s rejects, and the next try loads it again', async () => {
        vi.useFakeTimers()
        const load = loadGoogle()
        let settled = false
        load.catch(() => {}).finally(() => { settled = true })
        await vi.advanceTimersByTimeAsync(9_999)
        expect(settled).toBe(false)
        await vi.advanceTimersByTimeAsync(1)
        await expect(load).rejects.toThrow()
        expect(gsiScripts()).toHaveLength(0)
        void loadGoogle().catch(() => {})
        expect(gsiScripts()).toHaveLength(1)
    })

    test('with google.accounts.id already there, nothing is loaded', async () => {
        stubGoogle()
        await expect(loadGoogle()).resolves.toBeUndefined()
        expect(gsiScripts()).toHaveLength(0)
    })
})

describe('renderGoogleButton (spec §2: Google\'s own button, in the site\'s language)', () => {
    const slot = () => document.createElement('div')

    test("Google's standard outline button, Continue with Google, in the site's language, at the slot's width (at most 400)", () => {
        vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-1.apps.googleusercontent.com')
        const google = stubGoogle()
        const el = slot()
        renderGoogleButton(el, { locale: 'hr', width: 352.6, onCredential: vi.fn() })
        expect(google.renderButton).toHaveBeenCalledWith(el, {
            type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', locale: 'hr', width: '352',
        })
        renderGoogleButton(el, { locale: 'en', width: 640, onCredential: vi.fn() })
        expect(google.renderButton).toHaveBeenLastCalledWith(el, expect.objectContaining({ locale: 'en', width: '400' }))
        // a slot not laid out (jsdom) measures 0: no width, Google's own
        renderGoogleButton(el, { locale: 'en', width: 0, onCredential: vi.fn() })
        expect(google.renderButton.mock.lastCall?.[1]).not.toHaveProperty('width')
    })

    test("initialize once per page, with the client id; Google's answer goes to the button drawn last", () => {
        vi.stubEnv('VITE_GOOGLE_CLIENT_ID', ' client-1.apps.googleusercontent.com ')
        const google = stubGoogle()
        const first = vi.fn()
        const second = vi.fn()
        renderGoogleButton(slot(), { locale: 'en', width: 0, onCredential: first })
        renderGoogleButton(slot(), { locale: 'hr', width: 0, onCredential: second })
        expect(google.initialize).toHaveBeenCalledTimes(1)
        const [config] = google.initialize.mock.calls[0]
        expect(config.client_id).toBe('client-1.apps.googleusercontent.com')
        config.callback({ credential: 'id-token', select_by: 'btn' })
        expect(second).toHaveBeenCalledWith('id-token')
        expect(first).not.toHaveBeenCalled()
    })

    test('a button drawn again replaces the one before it', () => {
        vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-1.apps.googleusercontent.com')
        const google = stubGoogle()
        google.renderButton.mockImplementation((parent: HTMLElement) => parent.append(document.createElement('iframe')))
        const el = slot()
        renderGoogleButton(el, { locale: 'en', width: 0, onCredential: vi.fn() })
        renderGoogleButton(el, { locale: 'hr', width: 0, onCredential: vi.fn() })
        expect(el.querySelectorAll('iframe')).toHaveLength(1)
    })

    test('throws when Google is not loaded, or there is no client id', () => {
        vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-1.apps.googleusercontent.com')
        expect(() => renderGoogleButton(slot(), { locale: 'en', width: 0, onCredential: vi.fn() })).toThrow()
        vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
        stubGoogle()
        expect(() => renderGoogleButton(slot(), { locale: 'en', width: 0, onCredential: vi.fn() })).toThrow()
    })
})

describe('the pending Google credential (P-1: in memory only)', () => {
    test('set, peek and clear', () => {
        expect(peekPendingGoogle()).toBeNull()
        setPendingGoogle({ credential: 'id-token', email: 'ana@gmail.com' })
        expect(peekPendingGoogle()).toEqual({ credential: 'id-token', email: 'ana@gmail.com' })
        // the same snapshot until the next set, as useSyncExternalStore needs
        expect(peekPendingGoogle()).toBe(peekPendingGoogle())
        clearPendingGoogle()
        expect(peekPendingGoogle()).toBeNull()
    })

    test('a subscriber is told on every set and clear, and not after it unsubscribes', () => {
        const told = vi.fn()
        const unsubscribe = subscribePendingGoogle(told)
        setPendingGoogle({ credential: 'id-token', email: 'ana@gmail.com' })
        clearPendingGoogle()
        expect(told).toHaveBeenCalledTimes(2)
        unsubscribe()
        setPendingGoogle({ credential: 'id-token-2', email: 'ana@gmail.com' })
        expect(told).toHaveBeenCalledTimes(2)
    })

    test('never in storage', () => {
        setPendingGoogle({ credential: 'id-token', email: 'ana@gmail.com' })
        expect(JSON.stringify({ ...localStorage })).not.toContain('id-token')
        expect(JSON.stringify({ ...sessionStorage })).not.toContain('id-token')
    })

    test('a reload loses it: a fresh copy of the module has no pending credential (P-1)', async () => {
        setPendingGoogle({ credential: 'id-token', email: 'ana@gmail.com' })
        vi.resetModules()
        const fresh = await import('./googleSignIn')
        expect(fresh.peekPendingGoogle()).toBeNull()
        // the copy this file imported still holds it: the two are separate modules, as two page loads are
        expect(peekPendingGoogle()).toEqual({ credential: 'id-token', email: 'ana@gmail.com' })
    })
})
