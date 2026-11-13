// @vitest-environment node
// vite.config.ts loads Vite and its plugins (esbuild), which need Node's own TextEncoder, not jsdom's.
import { describe, test, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

/** public/_headers' /* rule as name → value (this file is src/viteConfig.test.ts), parsed as headers.test.ts reads it. */
// Not new URL(…, import.meta.url): Vite rewrites that form into an import.
function everyPageHeaders(): Record<string, string> {
    const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', '_headers')
    const rule = readFileSync(file, 'utf8').trim().split(/\n\s*\n/).map((block) => block.split('\n')).find(([path]) => path === '/*')
    return Object.fromEntries(rule!.slice(1).map((line) => {
        const [name, ...value] = line.trim().split(': ')
        return [name, value.join(': ')]
    }))
}

describe('vite.config and Google sign-in', () => {
    test("vite preview sends the headers Cloudflare Pages sends every page: public/_headers' /* rule (P-3)", async () => {
        const { default: viteConfig } = await import('../vite.config')
        const preview = viteConfig({ command: 'serve', mode: 'production', isPreview: true })
        expect(everyPageHeaders()).toHaveProperty('Referrer-Policy', 'no-referrer')
        expect(preview.preview?.headers).toEqual(everyPageHeaders())
    })

    test('vite build runs without VITE_GOOGLE_CLIENT_ID (Google sign-in spec §6.3)', async () => {
        vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test')
        vi.stubEnv('VITE_CARD_ART_BASE_URL', 'https://cards.example.test/v1')
        vi.stubEnv('VITE_GOOGLE_CLIENT_ID', undefined)
        const { default: viteConfig } = await import('../vite.config')
        expect(() => viteConfig({ command: 'build', mode: 'production' })).not.toThrow()
    })
})
