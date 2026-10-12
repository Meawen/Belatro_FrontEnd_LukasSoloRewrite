import { describe, test, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** A file at the repo root (this file is src/test/fonts.test.ts). */
// Not new URL(…, import.meta.url): Vite rewrites that form into an import.
const repoFile = (path: string) => join(dirname(fileURLToPath(import.meta.url)), '..', '..', path)
const sha256 = (path: string) => createHash('sha256').update(readFileSync(repoFile(path))).digest('hex')

// From @fontsource/jersey-10 5.3.0 (Google Fonts' subsets of Jersey 10), checked when downloaded (Task 1.3)
const PINNED: Record<string, string> = {
    'src/assets/fonts/jersey-10-latin.woff2': 'a606eb9b440abe7386c0e8aa2c081fb40d4a241758e2b0e49fdd963741ac4590',
    'src/assets/fonts/jersey-10-latin-ext.woff2': '0c561e6128a15fceb1f9717fd76655c972d7b3cd52e590b3610b528545e5ef65',
    'src/assets/fonts/OFL.txt': '73d891f0c6636c8251e35c38d7fd4412304dfc74efb0f3cc4bbefadff8dc0e8e',
}

describe('the pixel face (spec §3.3; D-2, D-3)', () => {
    test('Jersey 10 lives in src/assets/fonts with its OFL licence beside it, byte for byte as pinned', () => {
        for (const [path, sum] of Object.entries(PINNED)) expect(sha256(path), path).toBe(sum)
        expect(readFileSync(repoFile('src/assets/fonts/OFL.txt'), 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1')
    })

    test('both subsets together stay within the 30 KB font budget (spec §3.8)', () => {
        const bytes = ['latin', 'latin-ext']
            .reduce((sum, subset) => sum + statSync(repoFile(`src/assets/fonts/jersey-10-${subset}.woff2`)).size, 0)
        expect(bytes).toBeLessThanOrEqual(30 * 1024)
    })

    test('index.css imports each subset relatively (hashed into /assets/), with font-display: swap and a unicode-range', () => {
        const css = readFileSync(repoFile('src/index.css'), 'utf8')
        const faces = css.match(/@font-face\s*\{[^}]*\}/g) ?? []
        expect(faces).toHaveLength(2)
        for (const subset of ['latin', 'latin-ext']) {
            const face = faces.find((rule) => rule.includes(`url("./assets/fonts/jersey-10-${subset}.woff2") format("woff2")`))
            expect(face, subset).toBeDefined()
            expect(face).toContain('font-family: "Jersey 10";')
            expect(face).toContain('font-display: swap;')
            expect(face).toMatch(/unicode-range: U\+/)
        }
        expect(css).toContain('--font-pix: "Jersey 10", var(--font-sys);')
    })
})
