import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JSDOM } from 'jsdom'

const KEY = 'stiglja:table-effects'

// Node 26's own localStorage global is unusable here; borrow jsdom's (see services/api.test.ts)
const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

beforeEach(() => {
    vi.stubGlobal('localStorage', jsdomStorage)
    jsdomStorage.clear()
    vi.resetModules()
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

const load = () => import('./tableEffects')

describe('Table effects preference (spec §4.13)', () => {
    test('Full until the player chooses; an unknown stored value reads as Full', async () => {
        const { readTableEffects } = await load()
        expect(readTableEffects()).toBe('full')
        localStorage.setItem(KEY, 'sparkly')
        expect(readTableEffects()).toBe('full')
    })

    test('the choice is stored per device and survives a reload', async () => {
        const first = await load()
        first.writeTableEffects('calm')
        expect(localStorage.getItem(KEY)).toBe('calm')
        vi.resetModules()
        const afterReload = await load()
        expect(afterReload.readTableEffects()).toBe('calm')
    })

    test('with storage switched off nothing throws, and the tab keeps the choice', async () => {
        vi.spyOn(jsdomStorage, 'getItem').mockImplementation(() => { throw new Error('SecurityError') })
        vi.spyOn(jsdomStorage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError') })
        const { readTableEffects, writeTableEffects } = await load()
        expect(readTableEffects()).toBe('full')
        expect(() => writeTableEffects('off')).not.toThrow()
        expect(readTableEffects()).toBe('off')
    })

    test('useTableEffects keeps every user in step, and follows another tab', async () => {
        const { useTableEffects } = await load()
        function Picker({ name }: { name: string }) {
            const [effects, setEffects] = useTableEffects()
            return <button onClick={() => setEffects('off')}>{`${name}: ${effects}`}</button>
        }
        render(<><Picker name="settings" /><Picker name="arena" /></>)
        expect(screen.getByRole('button', { name: 'arena: full' })).toBeInTheDocument()
        await userEvent.click(screen.getByRole('button', { name: 'settings: full' }))
        expect(screen.getByRole('button', { name: 'arena: off' })).toBeInTheDocument()
        localStorage.setItem(KEY, 'calm')
        act(() => { window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: 'calm' })) })
        expect(screen.getByRole('button', { name: 'arena: calm' })).toBeInTheDocument()
    })
})
