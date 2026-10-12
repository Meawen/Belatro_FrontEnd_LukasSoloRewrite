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
