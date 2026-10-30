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

const now = new Date(2026, 9, 30, 12, 0, 0)
const ago = (ms: number) => new Date(now.getTime() - ms)
const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const load = async () => ({ ...(await import('./format')), ...(await import('./lang')) })

describe('format: dates, relative times and numbers follow the language (spec §1.1)', () => {
    test('formatRelative in English', async () => {
        const { formatRelative } = await load()
        expect(formatRelative(ago(30 * SECOND), now)).toBe('just now')
        expect(formatRelative(ago(5 * MINUTE), now)).toBe('5 minutes ago')
        expect(formatRelative(ago(2 * HOUR), now)).toBe('2 hours ago')
        expect(formatRelative(ago(DAY), now)).toBe('1 day ago')
        expect(formatRelative(ago(3 * DAY), now)).toBe('3 days ago')
        expect(formatRelative(ago(-MINUTE), now)).toBe('just now')
    })

    test('formatRelative in Croatian', async () => {
        const { formatRelative, setLang } = await load()
        setLang('hr')
        expect(formatRelative(ago(30 * SECOND), now)).toBe('maloprije')
        expect(formatRelative(ago(5 * MINUTE), now)).toBe('prije 5 minuta')
        expect(formatRelative(ago(2 * HOUR), now)).toBe('prije 2 sata')
        expect(formatRelative(ago(DAY), now)).toBe('prije 1 dan')
        expect(formatRelative(ago(3 * DAY), now)).toBe('prije 3 dana')
    })

    test('dates and numbers follow the language', async () => {
        const { formatDate, formatNumber, setLang } = await load()
        expect(formatDate(new Date(2026, 9, 30))).toBe('10/30/2026')
        expect(formatNumber(1234567)).toBe('1,234,567')
        setLang('hr')
        expect(formatDate(new Date(2026, 9, 30))).toBe('30. 10. 2026.')
        expect(formatNumber(1234567)).toBe('1.234.567')
    })

    test('an unparseable date shows nothing, in either language', async () => {
        const { formatDate, formatRelative, setLang } = await load()
        expect(formatDate('not a date')).toBe('')
        expect(formatDate(NaN)).toBe('')
        expect(formatRelative('garbage', now)).toBe('')
        setLang('hr')
        expect(formatDate('not a date')).toBe('')
        expect(formatDate(NaN)).toBe('')
        expect(formatRelative('garbage', now)).toBe('')
    })
})
