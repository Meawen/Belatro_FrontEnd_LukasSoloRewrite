import { describe, test, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { shippedSources } from './sourceFiles'

// D-36: no emoji anywhere in shipped UI, pixel icons only. Like brand.test.ts, tests and src/test/ are not shipped
// (a test may name an emoji to assert that it is gone). © ® ™ are pictographic in Unicode's eyes and allowed.
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u
const ALLOWED = new Set(['©', '®', '™'])

/** The repo root (this file is src/test/noEmoji.test.ts). */
// Not new URL(…, import.meta.url): Vite rewrites that form into an import.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** The stylesheets under src/ and index.html, as { path, text }. */
function shippedMarkup(): { path: string; text: string }[] {
    const styles = readdirSync(join(ROOT, 'src'), { recursive: true, encoding: 'utf8' })
        .map((relative) => relative.split('\\').join('/'))
        .filter((relative) => relative.endsWith('.css'))
        .map((relative) => ({ path: `src/${relative}`, text: readFileSync(join(ROOT, 'src', relative), 'utf8') }))
    return [...styles, { path: 'index.html', text: readFileSync(join(ROOT, 'index.html'), 'utf8') }]
}

function emojiIn(files: { path: string; text: string }[]): string[] {
    return files.flatMap(({ path, text }) => text.split('\n').flatMap((line, index) =>
        [...line]
            .filter((char) => PICTOGRAPHIC.test(char) && !ALLOWED.has(char))
            .map((char) => `${path}:${index + 1}: U+${char.codePointAt(0)!.toString(16).toUpperCase()} in ${line.trim()}`),
    ))
}

describe('no emoji (D-36)', () => {
    test('no shipped source file holds an emoji', () => {
        expect(emojiIn(shippedSources())).toEqual([])
    })

    test('no stylesheet under src/ and not index.html holds one either', () => {
        expect(emojiIn(shippedMarkup())).toEqual([])
    })
})
