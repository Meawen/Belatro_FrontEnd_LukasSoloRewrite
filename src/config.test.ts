import { describe, test, expect, vi, afterEach } from 'vitest'
import { apiBaseForBuild, cardArtBaseForBuild } from './apiBase'

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

describe('cardArtBaseForBuild (vite build, P-4)', () => {
    test('strips trailing slashes and spaces, so no art path starts with //', () => {
        expect(cardArtBaseForBuild('https://cards.example.test/v1/')).toBe('https://cards.example.test/v1')
        expect(cardArtBaseForBuild('  https://cards.stiglja.com/v1//  ')).toBe('https://cards.stiglja.com/v1')
    })

    test('refuses an unset, empty, blank or slash-only value with the build message', () => {
        for (const raw of [undefined, '', '   ', '/', '///']) {
            expect(() => cardArtBaseForBuild(raw)).toThrow(
                'VITE_CARD_ART_BASE_URL must be set for a production build (e.g. https://cards.stiglja.com/v1)')
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

describe('config: card art (spec §3.6; P-4)', () => {
    test('the dev server uses the r2.dev bucket unless VITE_CARD_ART_BASE_URL is set', async () => {
        vi.stubEnv('VITE_CARD_ART_BASE_URL', '')
        const unset = await import('./config')
        expect(unset.CARD_ART_BASE_URL).toBe('https://pub-35c6a55a85654bcaa462dcc5f31c7c71.r2.dev/v1')
        vi.stubEnv('VITE_CARD_ART_BASE_URL', 'http://localhost:4100/cards/')
        vi.resetModules()
        const set = await import('./config')
        expect(set.CARD_ART_BASE_URL).toBe('http://localhost:4100/cards')
    })

    test('a production bundle loads it from VITE_CARD_ART_BASE_URL', async () => {
        vi.stubEnv('DEV', false)
        vi.stubEnv('VITE_CARD_ART_BASE_URL', 'https://cards.example.test/v1')
        vi.resetModules()
        const config = await import('./config')
        expect(config.CARD_ART_BASE_URL).toBe('https://cards.example.test/v1')
    })
})
