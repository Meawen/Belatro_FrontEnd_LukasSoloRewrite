// @vitest-environment node
// vite.config.ts loads Vite and its plugins (esbuild), which need Node's own TextEncoder, not jsdom's.
import { describe, test, expect, vi, afterEach } from 'vitest'

afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
})

describe('vite.config (P-4)', () => {
    test('vite build refuses to start without VITE_CARD_ART_BASE_URL', async () => {
        vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test')
        vi.stubEnv('VITE_CARD_ART_BASE_URL', '  /  ')
        const { default: viteConfig } = await import('../vite.config')
        expect(() => viteConfig({ command: 'build', mode: 'production' })).toThrow(
            'VITE_CARD_ART_BASE_URL must be set for a production build (e.g. https://cards.stiglja.com/v1)')
    })

    test('vite build bakes the card art origin in without trailing slashes; dev bakes nothing', async () => {
        vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test')
        vi.stubEnv('VITE_CARD_ART_BASE_URL', 'https://cards.example.test/v1/')
        const { default: viteConfig } = await import('../vite.config')
        const build = viteConfig({ command: 'build', mode: 'production' })
        expect(build.define['import.meta.env.VITE_CARD_ART_BASE_URL']).toBe('"https://cards.example.test/v1"')
        const serve = viteConfig({ command: 'serve', mode: 'development' })
        expect(serve.define).not.toHaveProperty('import.meta.env.VITE_CARD_ART_BASE_URL')
    })
})

describe('vite.config and Google sign-in', () => {
    test("vite preview sends the headers Cloudflare Pages sends every page: public/_headers' /* rule (P-3)", async () => {
        const { default: viteConfig } = await import('../vite.config')
        const preview = viteConfig({ command: 'serve', mode: 'production', isPreview: true })
        // the /* rule's lines as written (headers.test.ts holds the file to them), not parsed again here: a parser bug shows
        expect(preview.preview?.headers).toEqual({
            'X-Frame-Options': 'DENY',
            'Content-Security-Policy': "frame-ancestors 'none'",
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer',
        })
    })

    test('vite build runs without VITE_GOOGLE_CLIENT_ID (Google sign-in spec §6.3)', async () => {
        vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test')
        vi.stubEnv('VITE_CARD_ART_BASE_URL', 'https://cards.example.test/v1')
        vi.stubEnv('VITE_GOOGLE_CLIENT_ID', undefined)
        const { default: viteConfig } = await import('../vite.config')
        expect(() => viteConfig({ command: 'build', mode: 'production' })).not.toThrow()
    })
})
