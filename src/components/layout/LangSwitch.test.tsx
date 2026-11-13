import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JSDOM } from 'jsdom'

const KEY = 'stiglja:lang'

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
    vi.doUnmock('../../i18n/catalog/loadEn.vitest')
})

async function renderSwitch() {
    const { LangSwitch } = await import('./LangSwitch')
    const { useT } = await import('../../i18n/t')
    function Consumer() {
        return <p>{useT().titles.settings}</p>
    }
    render(<><LangSwitch /><Consumer /></>)
}

describe('the HR · EN switch (spec §1.1)', () => {
    test('a group named Site language with HR and EN; EN is pressed under Vitest', async () => {
        await renderSwitch()
        const group = within(screen.getByRole('group', { name: 'Site language' }))
        expect(group.getAllByRole('button').map((b) => b.textContent)).toEqual(['HR', 'EN'])
        expect(group.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true')
        expect(group.getByRole('button', { name: 'HR' })).toHaveAttribute('aria-pressed', 'false')
    })

    test('pressing HR switches the site: the pick is stored and every useT user re-renders', async () => {
        await renderSwitch()
        expect(screen.getByText('Settings')).toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole('button', { name: 'HR' }))
        expect(screen.getByRole('button', { name: 'HR' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'false')
        expect(jsdomStorage.getItem(KEY)).toBe('hr')
        expect(screen.getByText('Postavke')).toBeInTheDocument()
        expect(screen.getByRole('group', { name: 'Jezik stranice' })).toBeInTheDocument()
    })

    test('pressing the language already shown does nothing', async () => {
        jsdomStorage.setItem('authToken', 'tok-1')
        const fetch = vi.fn()
        vi.stubGlobal('fetch', fetch)
        const setItem = vi.spyOn(jsdomStorage, 'setItem')
        await renderSwitch()
        await userEvent.setup().click(screen.getByRole('button', { name: 'EN' }))
        expect(setItem).not.toHaveBeenCalled()
        expect(jsdomStorage.getItem(KEY)).toBeNull()
        expect(fetch).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true')
    })

    test('pressing EN on a Croatian page switches once the English catalog has arrived (it loads on demand)', async () => {
        jsdomStorage.setItem(KEY, 'hr')
        let arrive!: (catalog: unknown) => void
        const loadEn = vi.fn(() => new Promise((resolve) => { arrive = resolve }))
        // t.ts reaches the catalog through vitest.config.ts's stand-in for './catalog/loadEn'
        vi.doMock('../../i18n/catalog/loadEn.vitest', () => ({ enNow: null, loadEn }))
        const { en } = await import('../../i18n/catalog/en')
        await renderSwitch()
        expect(screen.getByText('Postavke')).toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole('button', { name: 'EN' }))
        expect(loadEn).toHaveBeenCalledTimes(1)
        // nothing switches until the words are here: no page half in English
        expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'false')
        expect(screen.getByText('Postavke')).toBeInTheDocument()
        await act(async () => arrive(en))
        expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByText('Settings')).toBeInTheDocument()
        expect(jsdomStorage.getItem(KEY)).toBe('en')
    })

    test('a device whose English failed to load: EN, still pressed, tries again, and the page turns English (Ruling 62)', async () => {
        jsdomStorage.setItem(KEY, 'en')
        const loadEn = vi.fn().mockRejectedValueOnce(new Error('Failed to fetch dynamically imported module'))
        vi.doMock('../../i18n/catalog/loadEn.vitest', () => ({ enNow: null, loadEn }))
        const { en } = await import('../../i18n/catalog/en')
        // main.tsx's first paint: English didn't arrive, so the page is Croatian under an EN choice
        await (await import('../../i18n/t')).catalogForFirstPaint()
        await renderSwitch()
        expect(screen.getByText('Postavke')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true')
        loadEn.mockResolvedValueOnce(en)
        await userEvent.setup().click(screen.getByRole('button', { name: 'EN' }))
        expect(await screen.findByText('Settings')).toBeInTheDocument()
        expect(loadEn).toHaveBeenCalledTimes(2)
        expect(jsdomStorage.getItem(KEY)).toBe('en')
    })

    test('each code is a 44-px target', async () => {
        await renderSwitch()
        for (const button of screen.getAllByRole('button')) expect(button.className).toMatch(/\bmin-w-11\b/)
    })
})
