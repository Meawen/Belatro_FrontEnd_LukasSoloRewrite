import { describe, test, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// spec §3.2: components use the colour tokens only. A Tailwind palette class (emerald-600, slate-400, white, …)
// paints a colour the design system doesn't have. Tests are not shipped: several name one in the regex that
// asserts its absence.
const PALETTE = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black'
const UTILITY = 'bg|text|border(?:-[trblxy])?|ring|ring-offset|outline|from|via|to|fill|stroke|divide|placeholder|shadow|accent|caret|decoration'
const RAW_CLASS = new RegExp(`(?<![\\w-])(?:[a-z-]+:)*(?:${UTILITY})-(?:${PALETTE})(?:-\\d{2,3})?(?:/\\d+)?(?![\\w-])`, 'g')

/** src/ (this file is src/test/noRawPalette.test.ts). */
// Not new URL(…, import.meta.url): Vite rewrites that form into an import.
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')

/** The shipped .ts/.tsx/.css files under src/components and src/pages, and src/index.css. */
function styledFiles(): { path: string; text: string }[] {
    const under = (folder: string) => readdirSync(join(SRC, folder), { recursive: true, encoding: 'utf8' })
        .map((relative) => `${folder}/${relative.split('\\').join('/')}`)
        .filter((path) => /\.(tsx?|css)$/.test(path) && !/\.test\.tsx?$/.test(path))
    return [...under('components'), ...under('pages'), 'index.css']
        .map((path) => ({ path: `src/${path}`, text: readFileSync(join(SRC, path), 'utf8') }))
}

describe('colour tokens only (spec §3.2)', () => {
    test('no raw palette class in src/components, src/pages or index.css', () => {
        const hits = styledFiles().flatMap(({ path, text }) => text.split('\n').flatMap((line, index) =>
            [...line.matchAll(RAW_CLASS)].map((match) => `${path}:${index + 1}: ${match[0]}`)))
        expect(hits).toEqual([])
    })
})
