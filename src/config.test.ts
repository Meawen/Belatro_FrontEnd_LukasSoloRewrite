import { describe, test, expect, vi, afterEach } from 'vitest'
import { apiBaseForBuild } from './apiBase'

afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
})

describe('apiBaseForBuild (vite build, R-28)', () => {
    test('strips trailing slashes and spaces, so no request path starts with //', () => {
        expect(apiBaseForBuild('https://api.example.test/')).toBe('https://api.example.test')
        expect(apiBaseForBuild('https://api.example.test///')).toBe('https://api.example.test')
        expect(apiBaseForBuild('  https://api.stiglja.com  ')).toBe('https://api.stiglja.com')
    })

    test('refuses an unset, empty, blank or slash-only value with the build message', () => {
        for (const raw of [undefined, '', '   ', '/']) {
            expect(() => apiBaseForBuild(raw)).toThrow(
                'VITE_API_BASE_URL must be set for a production build (e.g. https://api.stiglja.com)')
        }
    })
})

describe('config (R-28)', () => {
    test('dev goes through the Vite proxy: REST under /backend, the socket at /ws', async () => {
        const config = await import('./config')
        expect(config.API_BASE_URL).toBe('/backend')
        expect(config.WS_URL).toBe('/ws')
    })

    test('a production bundle talks to VITE_API_BASE_URL, and SockJS to its /ws', async () => {
        vi.stubEnv('DEV', false)
        vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test')
        vi.resetModules()
        const config = await import('./config')
        expect(config.API_BASE_URL).toBe('https://api.example.test')
        expect(config.WS_URL).toBe('https://api.example.test/ws')
    })
})
