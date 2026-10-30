import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'

// Node 26's own localStorage global is unusable here; borrow jsdom's (see services/api.test.ts)
const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

beforeEach(() => {
    vi.stubGlobal('localStorage', jsdomStorage)
    jsdomStorage.clear()
    vi.resetModules()
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
})

const load = async () => ({
    ...(await import('./socketErrors')),
    ...(await import('../services/gameSocket')),
    ...(await import('./lang')),
})

describe("the game socket's own lines in the site's language (spec §1.1)", () => {
    test('in English each line is the socket\'s own, byte for byte', async () => {
        const { localiseSocketError, SESSION_ENDED_MESSAGE, CONNECT_REFUSED_MESSAGE, AUTH_REQUIRED_MESSAGE } = await load()
        expect(localiseSocketError(SESSION_ENDED_MESSAGE)).toBe('Your session ended — please sign in again')
        expect(localiseSocketError(CONNECT_REFUSED_MESSAGE)).toBe('Could not connect to the game server. Try again.')
        expect(localiseSocketError(AUTH_REQUIRED_MESSAGE)).toBe('Authentication required')
        for (const line of [SESSION_ENDED_MESSAGE, CONNECT_REFUSED_MESSAGE, AUTH_REQUIRED_MESSAGE]) expect(localiseSocketError(line)).toBe(line)
    })

    test('in Croatian', async () => {
        const { localiseSocketError, SESSION_ENDED_MESSAGE, CONNECT_REFUSED_MESSAGE, AUTH_REQUIRED_MESSAGE, setLang } = await load()
        setLang('hr')
        expect(localiseSocketError(SESSION_ENDED_MESSAGE)).toBe('Sesija je završila. Prijavi se ponovno.')
        expect(localiseSocketError(CONNECT_REFUSED_MESSAGE)).toBe('Ne možemo se spojiti na poslužitelj igre. Pokušaj ponovno.')
        expect(localiseSocketError(AUTH_REQUIRED_MESSAGE)).toBe('Za igru je potrebna prijava.')
    })

    test('null stays null, and any other line comes back as it is', async () => {
        const { localiseSocketError, setLang } = await load()
        setLang('hr')
        expect(localiseSocketError(null)).toBeNull()
        expect(localiseSocketError('Something else')).toBe('Something else')
    })
})
