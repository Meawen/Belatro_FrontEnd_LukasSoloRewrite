import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { JSDOM } from 'jsdom'

// Node 26's own localStorage global is unusable here; borrow jsdom's (see services/api.test.ts)
const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

beforeEach(() => {
    vi.stubGlobal('localStorage', jsdomStorage)
    jsdomStorage.clear()
    vi.resetModules()
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.doUnmock('./catalog/loadEn')
})

describe('t: the catalog of the site language (spec §1.2)', () => {
    test('cat() follows the language at call time', async () => {
        const { cat } = await import('./t')
        const { setLang } = await import('./lang')
        expect(cat().titles.settings).toBe('Settings')
        setLang('hr')
        expect(cat().titles.settings).toBe('Postavke')
    })

    test('useT consumers re-render on a switch', async () => {
        const { useT } = await import('./t')
        const { setLang } = await import('./lang')
        function Title() {
            return <h1>{useT().titles.settings}</h1>
        }
        render(<Title />)
        expect(screen.getByRole('heading')).toHaveTextContent('Settings')
        act(() => setLang('hr'))
        expect(screen.getByRole('heading')).toHaveTextContent('Postavke')
        act(() => setLang('en'))
        expect(screen.getByRole('heading')).toHaveTextContent('Settings')
    })
})

/** A load of the English chunk that the test settles. */
function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (error: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

describe('the English catalog loads on demand (the entry chunk limit)', () => {
    test('the shipped loader holds no English until asked, then gives the en catalog', async () => {
        // './catalog/loadEn.ts', not './catalog/loadEn': vitest.config.ts swaps the latter for a synchronous stand-in
        const { enNow, loadEn } = await import('./catalog/loadEn.ts')
        const { en } = await import('./catalog/en')
        expect(enNow).toBeNull()
        expect(await loadEn()).toBe(en)
    })

    test('switching to English waits for its catalog, then every useT user switches at once (no half-English page)', async () => {
        const chunk = deferred<typeof import('./catalog/en').en>()
        const loadEn = vi.fn(() => chunk.promise)
        vi.doMock('./catalog/loadEn', () => ({ enNow: null, loadEn }))
        const { cat, useT, switchLang } = await import('./t')
        const { getLang, setLang } = await import('./lang')
        const { en } = await import('./catalog/en')
        setLang('hr')
        function Title() {
            return <h1>{useT().titles.settings}</h1>
        }
        render(<Title />)
        expect(screen.getByRole('heading')).toHaveTextContent('Postavke')

        act(() => switchLang('en'))
        await act(async () => {})
        expect(loadEn).toHaveBeenCalledTimes(1)
        expect(getLang()).toBe('hr')
        expect(screen.getByRole('heading')).toHaveTextContent('Postavke')

        await act(async () => chunk.resolve(en))
        expect(getLang()).toBe('en')
        expect(screen.getByRole('heading')).toHaveTextContent('Settings')
        expect(cat().titles.settings).toBe('Settings')

        // back and forth now needs no load: Croatian is in the entry, English has arrived
        act(() => switchLang('hr'))
        expect(screen.getByRole('heading')).toHaveTextContent('Postavke')
        act(() => switchLang('en'))
        expect(screen.getByRole('heading')).toHaveTextContent('Settings')
        expect(loadEn).toHaveBeenCalledTimes(1)
    })

    test('a chunk that fails to arrive keeps the language, and the next switch tries again', async () => {
        const first = deferred<typeof import('./catalog/en').en>()
        const loadEn = vi.fn().mockReturnValueOnce(first.promise)
        vi.doMock('./catalog/loadEn', () => ({ enNow: null, loadEn }))
        const { switchLang, ensureCatalog } = await import('./t')
        const { getLang, setLang } = await import('./lang')
        const { en } = await import('./catalog/en')
        setLang('hr')
        switchLang('en')
        first.reject(new Error('Failed to fetch dynamically imported module'))
        await act(async () => {})
        expect(getLang()).toBe('hr')

        loadEn.mockResolvedValueOnce(en)
        switchLang('en')
        await vi.waitFor(() => expect(getLang()).toBe('en'))
        expect(loadEn).toHaveBeenCalledTimes(2)
        // Croatian is never fetched
        await ensureCatalog('hr')
        expect(loadEn).toHaveBeenCalledTimes(2)
    })

    test('no shipped module imports the English catalog except its loader (type imports aside)', async () => {
        const { shippedSources } = await import('../test/sourceFiles')
        // a static import of the en catalog from anywhere: './en', './catalog/en', '../i18n/catalog/en'
        const STATIC_EN = /^\s*import(?!\s+type\b)(?!\s*\()[^;]*?['"](?:\.\/|[^'"]*\/catalog\/)en['"]/m
        expect(STATIC_EN.test("import { en } from './catalog/en';")).toBe(true)
        expect(STATIC_EN.test("import { en } from './en';")).toBe(true)
        expect(STATIC_EN.test("import type { en } from './en';")).toBe(false)
        expect(STATIC_EN.test("export const loadEn = () => import('./en').then((m) => m.en);")).toBe(false)
        const hits = shippedSources().filter(({ path, text }) => !path.endsWith('.vitest.ts') && STATIC_EN.test(text)).map(({ path }) => path)
        expect(hits).toEqual([])
    })

    test('only i18n/t.ts reaches the English loader (Ruling 62), so every way to English goes through its rules', async () => {
        const { shippedSources } = await import('../test/sourceFiles')
        const LOADER = /['"](?:\.\.?\/)+(?:[^'"]*\/)?(?:catalog\/)?loadEn['"]/
        expect(LOADER.test("import { enNow, loadEn } from './catalog/loadEn';")).toBe(true)
        expect(LOADER.test("import { loadEn } from '../i18n/catalog/loadEn';")).toBe(true)
        expect(LOADER.test("import { loadEn } from './loadEn';")).toBe(true)
        const hits = shippedSources().filter(({ text }) => LOADER.test(text)).map(({ path }) => path)
        expect(hits).toEqual(['src/i18n/t.ts'])
    })
})

/** What a toast says now (components/ui/toastStore), from the same module registry as t.ts. */
async function toastNow() {
    return (await import('../components/ui/toastStore')).currentToast()?.message ?? null
}

describe('English that loads late or fails still shows, or says so, and can be retried (Ruling 62)', () => {
    const FAILED_HR = 'Engleski se nije učitao. Ponovno učitaj stranicu pa pokušaj opet.'

    test('another tab choosing English: this tab loads its catalog, then repaints in English', async () => {
        jsdomStorage.setItem('stiglja:lang', 'hr')
        const chunk = deferred<typeof import('./catalog/en').en>()
        const loadEn = vi.fn(() => chunk.promise)
        vi.doMock('./catalog/loadEn', () => ({ enNow: null, loadEn }))
        const { useT, followOtherTabs } = await import('./t')
        const { getLang } = await import('./lang')
        const { en } = await import('./catalog/en')
        const stop = followOtherTabs()
        function Title() {
            return <h1>{useT().titles.settings}</h1>
        }
        render(<Title />)
        expect(screen.getByRole('heading')).toHaveTextContent('Postavke')
        // what the browser does when the other tab stores its choice
        jsdomStorage.setItem('stiglja:lang', 'en')
        act(() => {
            window.dispatchEvent(new StorageEvent('storage', { key: 'stiglja:lang', newValue: 'en' }))
        })
        expect(getLang()).toBe('en')
        expect(loadEn).toHaveBeenCalledTimes(1)
        await act(async () => chunk.resolve(en))
        expect(screen.getByRole('heading')).toHaveTextContent('Settings')
        stop()
    })

    test('a first paint on a device that chose English waits for its catalog, then shows English', async () => {
        jsdomStorage.setItem('stiglja:lang', 'en')
        const chunk = deferred<typeof import('./catalog/en').en>()
        vi.doMock('./catalog/loadEn', () => ({ enNow: null, loadEn: vi.fn(() => chunk.promise) }))
        const { cat, catalogForFirstPaint } = await import('./t')
        const { en } = await import('./catalog/en')
        let painted = false
        void catalogForFirstPaint().then(() => { painted = true })
        await act(async () => {})
        expect(painted).toBe(false)
        chunk.resolve(en)
        await vi.waitFor(() => expect(painted).toBe(true))
        expect(cat().titles.settings).toBe('Settings')
        expect(await toastNow()).toBeNull()
    })

    test('a first paint whose English failed: it paints anyway and says so in Croatian, the page it shows', async () => {
        jsdomStorage.setItem('stiglja:lang', 'en')
        vi.doMock('./catalog/loadEn', () => ({ enNow: null, loadEn: vi.fn(async () => { throw new Error('Failed to fetch dynamically imported module') }) }))
        const { cat, catalogForFirstPaint } = await import('./t')
        await catalogForFirstPaint()
        expect(cat().titles.settings).toBe('Postavke')
        expect(await toastNow()).toBe(FAILED_HR)
    })

    test('a first paint whose English stalls: it paints after 3 s, says so once, and turns English if it arrives later', async () => {
        vi.useFakeTimers()
        jsdomStorage.setItem('stiglja:lang', 'en')
        const chunk = deferred<typeof import('./catalog/en').en>()
        vi.doMock('./catalog/loadEn', () => ({ enNow: null, loadEn: vi.fn(() => chunk.promise) }))
        const { useT, catalogForFirstPaint, ENGLISH_WAIT_MS } = await import('./t')
        const { subscribeToToasts } = await import('../components/ui/toastStore')
        const toasts = vi.fn()
        const unsubscribe = subscribeToToasts(toasts)
        const { en } = await import('./catalog/en')
        expect(ENGLISH_WAIT_MS).toBe(3000)
        let painted = false
        void catalogForFirstPaint().then(() => { painted = true })
        await vi.advanceTimersByTimeAsync(2999)
        expect(painted).toBe(false)
        await vi.advanceTimersByTimeAsync(1)
        expect(painted).toBe(true)
        expect(await toastNow()).toBe(FAILED_HR)
        function Title() {
            return <h1>{useT().titles.settings}</h1>
        }
        render(<Title />)
        expect(screen.getByRole('heading')).toHaveTextContent('Postavke')
        await act(async () => chunk.resolve(en))
        expect(screen.getByRole('heading')).toHaveTextContent('Settings')
        // one toast for the one load: shown when the wait ran out, not again when English arrived
        expect(toasts).toHaveBeenCalledTimes(1)
        unsubscribe()
    })

    test('a switch whose English fails or stalls says so in Croatian, keeps the page, and a press tries again', async () => {
        vi.useFakeTimers()
        const loadEn = vi.fn()
            .mockRejectedValueOnce(new Error('Failed to fetch dynamically imported module'))
            .mockReturnValueOnce(new Promise(() => {}))
        vi.doMock('./catalog/loadEn', () => ({ enNow: null, loadEn }))
        const { switchLang } = await import('./t')
        const { getLang, setLang } = await import('./lang')
        setLang('hr')

        switchLang('en')
        await vi.advanceTimersByTimeAsync(0)
        expect(getLang()).toBe('hr')
        expect(await toastNow()).toBe(FAILED_HR)
        await vi.advanceTimersByTimeAsync(2000)
        expect(await toastNow()).toBeNull()

        // a stalled one: after 3 s it says so, and the language stays
        switchLang('en')
        await vi.advanceTimersByTimeAsync(2999)
        expect(await toastNow()).toBeNull()
        await vi.advanceTimersByTimeAsync(1)
        expect(getLang()).toBe('hr')
        expect(await toastNow()).toBe(FAILED_HR)
        expect(loadEn).toHaveBeenCalledTimes(2)
    })

    test('a switch tried again after a failure fetches again, and switches', async () => {
        const loadEn = vi.fn().mockRejectedValueOnce(new Error('Failed to fetch dynamically imported module'))
        vi.doMock('./catalog/loadEn', () => ({ enNow: null, loadEn }))
        const { switchLang, catalogReady } = await import('./t')
        const { getLang, setLang } = await import('./lang')
        const { en } = await import('./catalog/en')
        setLang('hr')
        switchLang('en')
        await act(async () => {})
        expect(catalogReady('en')).toBe(false)
        expect(catalogReady('hr')).toBe(true)
        loadEn.mockResolvedValueOnce(en)
        switchLang('en')
        await vi.waitFor(() => expect(getLang()).toBe('en'))
        expect(catalogReady('en')).toBe(true)
        expect(loadEn).toHaveBeenCalledTimes(2)
    })
})
