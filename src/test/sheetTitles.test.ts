import { describe, test, expect } from 'vitest'
import { shippedSources } from './sourceFiles'

// spec §7.2, §3.7: a Sheet is a dialog (or a region) named by its title, so every call site gives one.

/** Each `<Sheet …>` opening tag in `text`, from `<Sheet` to its closing `>` (braces and strings skipped), with its line. */
function sheetTags(text: string): { line: number; tag: string }[] {
    const tags: { line: number; tag: string }[] = []
    for (const match of text.matchAll(/<Sheet(?=[\s>])/g)) {
        let depth = 0
        let quote: string | null = null
        let end = match.index! + '<Sheet'.length
        for (; end < text.length; end++) {
            const char = text[end]
            if (quote) {
                if (char === quote) quote = null
            } else if (char === '"' || char === "'" || char === '`') quote = char
            else if (char === '{') depth++
            else if (char === '}') depth--
            else if (char === '>' && depth === 0) break
        }
        tags.push({ line: text.slice(0, match.index).split('\n').length, tag: text.slice(match.index, end + 1) })
    }
    return tags
}

describe('every Sheet is labelled (spec §7.2)', () => {
    test('every <Sheet> call site in shipped source has a non-empty title', () => {
        const sites = shippedSources().flatMap(({ path, text }) => sheetTags(text).map((site) => ({ path, ...site })))
        const unlabelled = sites
            .filter(({ tag }) => !/\stitle=(\{|"[^"]+"|'[^']+')/.test(tag))
            .map(({ path, line, tag }) => `${path}:${line}: ${tag.replace(/\s+/g, ' ').slice(0, 120)}`)
        expect(unlabelled).toEqual([])
        expect(sites.length).toBeGreaterThanOrEqual(15)
    })
})
