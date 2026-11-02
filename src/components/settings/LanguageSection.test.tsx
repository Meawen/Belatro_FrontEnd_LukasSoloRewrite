import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
    vi.doUnmock('../../i18n/catalog/loadEn.vitest')
})

async function renderSection() {
    const { LanguageSection } = await import('./LanguageSection')
    render(<LanguageSection />)
}

describe('Settings: Language (spec §1.1)', () => {
    test('Language, with Hrvatski and English, English picked under Vitest', async () => {
        await renderSection()
        const region = within(screen.getByRole('region', { name: 'Language' }))
        expect(region.getByText("The site's language. Kept on this device and on your account.")).toBeInTheDocument()
        expect(region.getAllByRole('button').map((b) => b.textContent)).toEqual(['Hrvatski', 'English'])
        expect(region.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
    })

    test('picking Hrvatski turns the section Croatian and keeps the pick', async () => {
        await renderSection()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Hrvatski' }))
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Jezik')
        expect(screen.getByRole('region', { name: 'Jezik' })).toBeInTheDocument()
        expect(screen.getByText('Jezik stranice. Pamtimo ga na ovom uređaju i na tvom računu.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Hrvatski' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'false')
        expect(jsdomStorage.getItem('stiglja:lang')).toBe('hr')
    })

    test('picking English on a Croatian page switches once the English catalog has arrived (it loads on demand)', async () => {
        jsdomStorage.setItem('stiglja:lang', 'hr')
        let arrive!: (catalog: unknown) => void
        const loadEn = vi.fn(() => new Promise((resolve) => { arrive = resolve }))
        // t.ts reaches the catalog through vitest.config.ts's stand-in for './catalog/loadEn'
        vi.doMock('../../i18n/catalog/loadEn.vitest', () => ({ enNow: null, loadEn }))
        const { en } = await import('../../i18n/catalog/en')
        await renderSection()
        await userEvent.setup().click(screen.getByRole('button', { name: 'English' }))
        expect(loadEn).toHaveBeenCalledTimes(1)
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Jezik')
        await act(async () => arrive(en))
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Language')
        expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
        expect(jsdomStorage.getItem('stiglja:lang')).toBe('en')
    })
})
