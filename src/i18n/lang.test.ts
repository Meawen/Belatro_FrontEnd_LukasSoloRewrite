import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { JSDOM } from 'jsdom'
import { captureConsole } from '../test/captureConsole'

const KEY = 'stiglja:lang'

// Node 26's own localStorage global is unusable here; borrow jsdom's (see services/api.test.ts)
const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

function fakeResponse(status: number, body: unknown) {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: `status-${status}`,
        headers: { get: () => null },
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(body == null ? '' : JSON.stringify(body)),
    } as unknown as Response
}

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

const load = () => import('./lang')

describe('the site language (spec §1.1)', () => {
    test('English under Vitest, so the existing tests read as before', async () => {
        const { getLang, useLang } = await load()
        expect(getLang()).toBe('en')
        expect(renderHook(() => useLang()).result.current).toBe('en')
    })

    test('Croatian in a production build and on the dev server, whatever the browser says', async () => {
        vi.stubEnv('MODE', 'production')
        vi.resetModules()
        expect((await load()).getLang()).toBe('hr')

        vi.stubEnv('MODE', 'development')
        vi.resetModules()
        expect((await load()).getLang()).toBe('hr')

        vi.stubGlobal('navigator', { language: 'en-US', languages: ['en-US'] })
        vi.resetModules()
        expect((await load()).getLang()).toBe('hr')
    })

    test('an unknown stored value reads as the default', async () => {
        jsdomStorage.setItem(KEY, 'de')
        expect((await load()).getLang()).toBe('en')
    })

    test('the choice is stored per device and survives a reload', async () => {
        const first = await load()
        first.setLang('hr')
        expect(localStorage.getItem(KEY)).toBe('hr')
        vi.resetModules()
        const afterReload = await load()
        expect(afterReload.getLang()).toBe('hr')
    })

    test('with storage switched off nothing throws, and the tab keeps the choice', async () => {
        vi.spyOn(jsdomStorage, 'getItem').mockImplementation(() => { throw new Error('SecurityError') })
        vi.spyOn(jsdomStorage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError') })
        const { getLang, setLang } = await load()
        expect(getLang()).toBe('en')
        expect(() => setLang('hr')).not.toThrow()
        expect(getLang()).toBe('hr')
    })

    test('useLang keeps every user in step, and follows another tab', async () => {
        const { setLang, useLang } = await load()
        const header = renderHook(() => useLang())
        const settings = renderHook(() => useLang())
        expect([header.result.current, settings.result.current]).toEqual(['en', 'en'])
        act(() => setLang('hr'))
        expect([header.result.current, settings.result.current]).toEqual(['hr', 'hr'])
        localStorage.setItem(KEY, 'en')
        act(() => { window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: 'en' })) })
        expect([header.result.current, settings.result.current]).toEqual(['en', 'en'])
    })

    test('signed in, a choice is also saved on the account (PUT /user/me/language)', async () => {
        captureConsole()
        jsdomStorage.setItem('authToken', 'tok-1')
        const fetch = vi.fn().mockResolvedValue(fakeResponse(204, null))
        vi.stubGlobal('fetch', fetch)
        const { getLang, setLang } = await load()
        setLang('hr')
        expect(getLang()).toBe('hr')
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
        expect(fetch).toHaveBeenCalledWith('/backend/user/me/language', expect.objectContaining({
            method: 'PUT',
            body: '{"language":"hr"}',
            headers: expect.objectContaining({ Authorization: 'Bearer tok-1' }),
        }))
    })

    test('signed out, nothing is sent', async () => {
        const fetch = vi.fn().mockResolvedValue(fakeResponse(204, null))
        vi.stubGlobal('fetch', fetch)
        const { setLang } = await load()
        setLang('hr')
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(fetch).not.toHaveBeenCalled()
    })

    test('a failed save keeps the choice and throws nothing', async () => {
        captureConsole()
        jsdomStorage.setItem('authToken', 'tok-1')
        const fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
        vi.stubGlobal('fetch', fetch)
        const { getLang, setLang } = await load()
        expect(() => setLang('hr')).not.toThrow()
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(getLang()).toBe('hr')
        expect(localStorage.getItem(KEY)).toBe('hr')
    })

    test("adoptAccountLang takes the account's value and sends nothing back; anything else changes nothing", async () => {
        captureConsole()
        jsdomStorage.setItem('authToken', 'tok-1')
        const fetch = vi.fn().mockResolvedValue(fakeResponse(204, null))
        vi.stubGlobal('fetch', fetch)
        const { adoptAccountLang, getLang, setLang } = await load()
        setLang('hr')
        adoptAccountLang('en')
        expect(getLang()).toBe('en')
        expect(localStorage.getItem(KEY)).toBe('en')
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(fetch).toHaveBeenCalledTimes(1)
        for (const value of [undefined, null, 'de']) {
            adoptAccountLang(value)
            expect(getLang()).toBe('en')
            expect(localStorage.getItem(KEY)).toBe('en')
        }
        expect(fetch).toHaveBeenCalledTimes(1)
    })
})
