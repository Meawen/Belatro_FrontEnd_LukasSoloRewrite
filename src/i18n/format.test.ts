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

    test('times and short dates follow the language', async () => {
        const { formatTime, formatDayMonth, setLang } = await load()
        const at = new Date(2026, 9, 2, 14, 5)
        expect(formatTime(at)).toBe('02:05 PM')
        expect(formatDayMonth(at)).toBe('Oct 2')
        expect(formatTime('not a date')).toBe('')
        expect(formatDayMonth('not a date')).toBe('')
        setLang('hr')
        expect(formatTime(at)).toBe('14:05')
        expect(formatDayMonth(at)).toBe('2. listopada')
        expect(formatTime('not a date')).toBe('')
        expect(formatDayMonth('not a date')).toBe('')
    })

    test('formatLongDate: the Zagreb day, in each language (the day the emails name)', async () => {
        const { formatLongDate, setLang } = await load()
        expect(formatLongDate('2026-11-06T10:00:00Z')).toBe('November 6, 2026')
        // 23:30 UTC is already the next day in Zagreb (B7's MailService DAY_EN/DAY_HR)
        expect(formatLongDate('2026-11-08T23:30:00Z')).toBe('November 9, 2026')
        expect(formatLongDate('x')).toBe('')
        setLang('hr')
        expect(formatLongDate('2026-11-06T10:00:00Z')).toBe('6. studenoga 2026.')
        expect(formatLongDate('2026-11-08T23:30:00Z')).toBe('9. studenoga 2026.')
        expect(formatLongDate('x')).toBe('')
    })

    test("formatDay: the server's Zagreb day as it came, in each language, whatever the browser's zone", async () => {
        const { formatDay, setLang } = await load()
        const was = process.env.TZ
        try {
            // UTC+14 and UTC−11: a day read as local midnight would move to the day before or after
            for (const zone of [was, 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
                if (zone === undefined) delete process.env.TZ
                else process.env.TZ = zone
                setLang('en')
                expect(formatDay('2026-10-21'), zone).toBe('Wed, Oct 21')
                expect(formatDay('2026-11-03'), zone).toBe('Tue, Nov 3')
                expect(formatDay('x'), zone).toBe('x')
                setLang('hr')
                expect(formatDay('2026-10-21'), zone).toBe('sri, 21. listopada')
                expect(formatDay('2026-11-03'), zone).toBe('uto, 3. studenoga')
                expect(formatDay('x'), zone).toBe('x')
            }
        } finally {
            if (was === undefined) delete process.env.TZ
            else process.env.TZ = was
        }
    })
})
