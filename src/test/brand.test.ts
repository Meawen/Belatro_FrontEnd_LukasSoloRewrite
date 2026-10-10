import { describe, test, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { shippedSources } from './sourceFiles'

// R-39: players see "Stiglja". "Belatro" may stay inside identifiers (useBelatroGame,
// Belatro_FrontEnd…); a standalone word "Belatro" in shipped source (JSX text, a string
// literal, a comment) counts as user-visible. Tests and src/test/ are not shipped.
const STANDALONE_BELATRO = /(?<![\w.])Belatro(?!\w)/

/** A file at the repo root (this file is src/test/brand.test.ts). */
// Not new URL(…, import.meta.url): Vite rewrites that form into an import.
const repoFile = (path: string) => join(dirname(fileURLToPath(import.meta.url)), '..', '..', path)

describe('brand (R-39)', () => {
    test('no shipped source shows "Belatro"', () => {
        const hits = shippedSources()
            .flatMap(({ path, text }) => text.split('\n').map((line, index) => ({ where: `${path}:${index + 1}`, line })))
            .filter(({ line }) => STANDALONE_BELATRO.test(line))
            .map(({ where, line }) => `${where}: ${line.trim()}`)
        expect(hits).toEqual([])
    })

    test('index.html names the site, its language, a description and the favicon', () => {
        const html = readFileSync(repoFile('index.html'), 'utf8')
        expect(html).toContain('<html lang="en">')
        expect(html).toContain('<title>Stiglja</title>')
        expect(html).toMatch(/<meta name="description" content="[^"]+" \/>/)
        expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />')
        expect(existsSync(repoFile('public/favicon.svg'))).toBe(true)
    })
})
