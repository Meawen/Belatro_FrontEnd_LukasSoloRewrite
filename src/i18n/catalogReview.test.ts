import { describe, test, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderReview } from '../../scripts/catalog-review.mjs'
import { en } from './catalog/en'
import { hr } from './catalog/hr'

/** The repo root (this file is src/i18n/catalogReview.test.ts). */
// Not new URL(…, import.meta.url): Vite rewrites that form into an import.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Every leaf of a catalog as [dotted.path, value], depth-first. */
function leaves(node: object, prefix = ''): [string, unknown][] {
    return Object.entries(node).flatMap(([key, value]): [string, unknown][] => {
        const path = prefix ? `${prefix}.${key}` : key
        return value !== null && typeof value === 'object' ? leaves(value, path) : [[path, value]]
    })
}

const escaped = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const headings = (html: string) => [...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((match) => match[1])

describe('the catalog review page (spec §1.2: the owner reads every string in context)', () => {
    test('the page lists every key with its Croatian and English text, grouped by top-level key', () => {
        const html = renderReview(en, hr)
        const hrLeaves = new Map(leaves(hr))
        for (const [path, value] of leaves(en)) {
            expect(html, path).toContain(`<code>${path}</code>`)
            expect(html, path).toContain(escaped(String(value)))
            expect(html, path).toContain(escaped(String(hrLeaves.get(path))))
        }
        expect(headings(html)).toEqual(Object.keys(en))
    })

    test('a function is shown for its samples: 1, 2 and 5 unless SAMPLES says otherwise', () => {
        const pair = { g: { n: (n: number) => `${n} x` } }
        const html = renderReview(pair, pair)
        for (const shown of ['1 x', '2 x', '5 x']) expect(html).toContain(shown)
        const sampled = renderReview(pair, pair, { 'g.n': [[7]] })
        expect(sampled).toContain('7 x')
        for (const hidden of ['1 x', '2 x', '5 x']) expect(sampled).not.toContain(hidden)
    })

    test('a function that throws on a sample fails the review, naming the key', () => {
        const pair = { g: { broken: () => { throw new Error('no') } } }
        expect(() => renderReview(pair, pair)).toThrow('g.broken')
    })

    test('text is escaped, and a key missing in hr says MISSING', () => {
        const html = renderReview(
            { a: { s: '<b>&"', f: (n: number) => `${n}`, t: 'there' } },
            { a: { f: 'not a function', t: 'tamo' } },
        )
        expect(html).toContain('&lt;b&gt;&amp;&quot;')
        expect(html).not.toContain('<b>&"')
        expect(html.match(/MISSING/g)).toHaveLength(2)
        expect(html).toContain('tamo')
    })

    test('the command writes the page', () => {
        const out = join(mkdtempSync(join(tmpdir(), 'catalog-review-')), 'review.html')
        const stdout = execFileSync(process.execPath, ['scripts/catalog-review.mjs', out], {
            cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
        })
        expect(stdout.trim()).toBe(`${leaves(en).length} keys → ${out}`)
        const page = readFileSync(out, 'utf8')
        for (const [path] of leaves(en)) expect(page, path).toContain(`<code>${path}</code>`)

        let status: number | null = null
        let stderr = ''
        try {
            execFileSync(process.execPath, ['scripts/catalog-review.mjs'], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
        } catch (error) {
            ({ status, stderr } = error as { status: number; stderr: string })
        }
        expect(status).toBe(2)
        expect(stderr.trim()).toBe('usage: node scripts/catalog-review.mjs <out.html>')
    }, 20_000)
})
