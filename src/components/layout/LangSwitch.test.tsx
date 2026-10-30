import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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
})
