import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** A file at the repo root (this file is src/test/headers.test.ts). */
// Not new URL(…, import.meta.url): Vite rewrites that form into an import.
const repoFile = (path: string) => join(dirname(fileURLToPath(import.meta.url)), '..', '..', path)

/**
 * The rules in public/_headers, in file order: a path line, then its header lines (kept with their
 * two-space indent). Rules are separated by blank lines. Cloudflare Pages applies every rule that matches.
 */
function rules(): [string, string[]][] {
    return readFileSync(repoFile('public/_headers'), 'utf8')
        .trim()
        .split(/\n\s*\n/)
        .map((block) => {
            const [path, ...headers] = block.split('\n')
            return [path, headers]
        })
}

describe('the headers Cloudflare Pages sends (public/_headers)', () => {
    test('every page gets the four security headers, under one /* rule', () => {
        expect(rules().filter(([path]) => path === '/*')).toEqual([
            ['/*', [
                '  X-Frame-Options: DENY',
                "  Content-Security-Policy: frame-ancestors 'none'",
                '  X-Content-Type-Options: nosniff',
                '  Referrer-Policy: no-referrer',
            ]],
        ])
    })

    test('the three caching rules stay as they were, and there are no others', () => {
        expect(rules().filter(([path]) => path !== '/*')).toEqual([
            ['/', ['  Cache-Control: no-cache']],
            ['/index.html', ['  Cache-Control: no-cache']],
            ['/assets/*', ['  Cache-Control: public, max-age=31536000, immutable']],
        ])
    })
})
