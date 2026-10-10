import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** src/index.css as written (this file is src/test/css.ts). */
// Not new URL(…, import.meta.url): Vite rewrites that form into an import.
export const indexCss = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.css'), 'utf8')

const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '')

/** The ui component styles: index.css between its two marker comments. */
export function uiCss(): string {
    const start = indexCss.indexOf('/* The ui components (src/components/ui)')
    const end = indexCss.indexOf('/* end of the ui component styles */')
    if (start < 0 || end < start) throw new Error('the ui component block is not in src/index.css')
    return indexCss.slice(start, end)
}

/** The inner text of every `{…}` that follows an occurrence of `marker` (nested blocks included), joined. */
export function blocks(marker: string, text: string): string {
    const found: string[] = []
    for (let at = text.indexOf(marker); at >= 0; at = text.indexOf(marker, at + 1)) {
        const open = text.indexOf('{', at)
        let depth = 0
        let close = open
        for (; close < text.length; close++) {
            if (text[close] === '{') depth++
            if (text[close] === '}' && --depth === 0) break
        }
        found.push(text.slice(open + 1, close))
    }
    return found.join('\n')
}

/** The declarations of the first rule written exactly `selector { … }`, or '' when there is none. */
export function rule(selector: string, text: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = new RegExp(`(?:^|[\\s;{}])${escaped}\\s*\\{([^{}]*)\\}`).exec(withoutComments(text))
    return match ? match[1] : ''
}

/** Every rule without nested blocks, as { selector, body }, comments stripped. */
export function rules(text: string): { selector: string; body: string }[] {
    return [...withoutComments(text).matchAll(/([^{};]+)\{([^{}]*)\}/g)]
        .map((match) => ({ selector: match[1].trim(), body: match[2] }))
}
