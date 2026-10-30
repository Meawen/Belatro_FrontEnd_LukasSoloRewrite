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
})
