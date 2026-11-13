import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render } from '@testing-library/react'
import { JSDOM } from 'jsdom'
import { usePageTitle } from './usePageTitle'

function Titled({ title }: { title: string }) {
    usePageTitle(title)
    return null
}

describe('usePageTitle (X-16)', () => {
    test('the document is titled "{Page} · Stiglja" while the page shows, and "Stiglja" after', () => {
        const { rerender, unmount } = render(<Titled title="Rules" />)
        expect(document.title).toBe('Rules · Stiglja')
        rerender(<Titled title="Privacy notice" />)
        expect(document.title).toBe('Privacy notice · Stiglja')
        unmount()
        expect(document.title).toBe('Stiglja')
    })
})

// Node 26's own localStorage global is unusable here; borrow jsdom's (see services/api.test.ts)
const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

describe('usePageTitle and the site language (open beta §1.1)', () => {
    let meta: HTMLMetaElement
    beforeEach(() => {
        vi.stubGlobal('localStorage', jsdomStorage)
        jsdomStorage.clear()
        vi.resetModules()
        meta = document.createElement('meta')
        meta.name = 'description'
        meta.content = 'x'
        document.head.append(meta)
    })
    afterEach(() => {
        meta.remove()
        vi.unstubAllGlobals()
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
    })

    test("the document's language and description follow the site's language", async () => {
        const { usePageTitle: freshUsePageTitle } = await import('./usePageTitle')
        const { setLang } = await import('../i18n/lang')
        function FreshTitled({ title }: { title: string }) {
            freshUsePageTitle(title)
            return null
        }
        render(<FreshTitled title="Rules" />)
        expect(document.documentElement.lang).toBe('en')
        expect(meta.content).toBe('Stiglja: Belot for four, online.')
        act(() => setLang('hr'))
        expect(document.documentElement.lang).toBe('hr')
        expect(meta.content).toBe('Stiglja: bela za četvero, online.')
    })

    test("the document's language is the catalog's it shows: Croatian until English arrives (Ruling 64)", async () => {
        jsdomStorage.setItem('stiglja:lang', 'en')
        let arrive!: (catalog: unknown) => void
        // i18n/t.ts's loader (vitest.config.ts puts the .vitest stand-in in its place): English not here yet
        vi.doMock('../i18n/catalog/loadEn.vitest', () => ({ enNow: null, loadEn: () => new Promise((resolve) => { arrive = resolve }) }))
        try {
            const { usePageTitle: freshUsePageTitle } = await import('./usePageTitle')
            const { ensureCatalog } = await import('../i18n/t')
            const { getLang } = await import('../i18n/lang')
            const { en } = await import('../i18n/catalog/en')
            function FreshTitled({ title }: { title: string }) {
                freshUsePageTitle(title)
                return null
            }
            render(<FreshTitled title="Rules" />)
            // English is chosen, but the page reads Croatian until its catalog is here: so does the document
            expect(getLang()).toBe('en')
            expect(meta.content).toBe('Stiglja: bela za četvero, online.')
            expect(document.documentElement.lang).toBe('hr')
            const loaded = ensureCatalog('en')
            await act(async () => {
                arrive(en)
                await loaded
            })
            expect(document.documentElement.lang).toBe('en')
            expect(meta.content).toBe('Stiglja: Belot for four, online.')
        } finally {
            vi.doUnmock('../i18n/catalog/loadEn.vitest')
        }
    })
})
