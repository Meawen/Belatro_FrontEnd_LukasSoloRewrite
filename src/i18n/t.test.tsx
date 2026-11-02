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
})
