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
