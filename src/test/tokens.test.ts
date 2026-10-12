import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Spec §3.2: the tokens live in src/index.css. The test reads them from there, so every number
// below is computed from the shipped values, never from a copy.
// Not new URL(…, import.meta.url): Vite rewrites that form into an import.
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.css'), 'utf8')

/** The custom properties declared inside the first `{…}` that follows `marker` (nested blocks included). */
function declarations(marker: string): Record<string, string> {
    const at = css.indexOf(marker)
    if (at < 0) throw new Error(`"${marker}" is not in src/index.css`)
    const open = css.indexOf('{', at)
    let depth = 0
    let close = open
    for (; close < css.length; close++) {
        if (css[close] === '{') depth++
        if (css[close] === '}' && --depth === 0) break
    }
    const body = css.slice(open + 1, close)
    return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
}

const tokens = declarations(':root {')

/** WCAG 2 relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
    const n = parseInt(hex.slice(1), 16)
    const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((c) => {
        const s = c / 255
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
}

/** [text token, background token, minimum ratio] */
type Pair = [string, string, number]

const BODY = 4.5
const SURFACES = ['--bg', '--surface', '--surface-2']

// Every pair the §3.2 table states (body-text threshold 4.5:1)
const SPEC_PAIRS: Pair[] = [
    ...['--text', '--text-2', '--text-3', '--accent', '--success', '--danger-text', '--team-a']
        .flatMap((fg) => SURFACES.map((bg): Pair => [fg, bg, BODY])),
    ['--ink', '--accent', BODY],
    ['--team-b', '--bg', BODY],
    ['--team-b', '--surface', BODY],
    ['--team-b-text', '--surface-2', BODY],
    ['--text', '--danger-fill', BODY],
    ['--text', '--warn-fill', BODY],
    ['--text', '--suit-herc', BODY],
    ['--text', '--suit-pik', BODY],
    ['--ink', '--suit-karo', BODY],
    ['--ink', '--suit-tref', BODY],
]

// The pairs the ui components add: Chip/Tag tones, Avatar tiles, the selected segment (--surface-3 takes
// --text or --text-2 only, §3.2), button labels
const UI_PAIRS: Pair[] = [
    ['--ink', '--team-a', BODY],
    ['--ink', '--team-b', BODY],
    ['--ink', '--success', BODY],
    ['--text', '--surface-3', BODY],
    ['--text-2', '--surface-3', BODY],
    ['--accent', '--surface-2', BODY],
]

function failing(pairs: Pair[], values: Record<string, string>): string[] {
    return pairs
        .map(([fg, bg, min]) => ({ fg, bg, min, ratio: contrast(values[fg], values[bg]) }))
        .filter(({ ratio, min }) => !(ratio >= min))
        .map(({ fg, bg, min, ratio }) => `${fg} on ${bg}: ${ratio.toFixed(2)} < ${min}`)
}

describe('design tokens (spec §3.2)', () => {
    test('every colour token has its value from the spec', () => {
        expect(tokens).toMatchObject({
            '--bg': '#0a1916', '--surface': '#11292a', '--surface-2': '#17363a', '--surface-3': '#1e4448',
            '--edge': '#2c5a52', '--edge-strong': '#6aa898', '--ink': '#222034',
            '--text': '#f2f0e6', '--text-2': '#9badb7', '--text-3': '#8aa2ad',
            '--accent': '#fbf236', '--accent-ledge': '#8f974a', '--success': '#99e550',
            '--danger': '#d95763', '--danger-text': '#f08a94', '--danger-fill': '#ac3232', '--warn-fill': '#8f563b',
            '--team-a': '#5fcde4', '--team-b': '#d77bba', '--team-b-text': '#e08ac6',
            '--suit-herc': '#ac3232', '--suit-karo': '#fbf236', '--suit-pik': '#4b692f', '--suit-tref': '#df7126',
            '--felt-a': '#1b6b4c', '--felt-b': '#1a6449', '--rim': '#663931', '--rim-hi': '#8f563b',
            '--felt-spring-a': '#2f8f4e', '--felt-spring-b': '#2b8448',
            '--felt-summer-a': '#9a7a1e', '--felt-summer-b': '#8f711b',
            '--felt-autumn-a': '#8a4a1f', '--felt-autumn-b': '#7f441c',
            '--felt-winter-a': '#1d2f52', '--felt-winter-b': '#1a2a4a',
        })
    })

    test('every text pair of the §3.2 table meets 4.5:1, computed from the shipped values', () => {
        expect(failing(SPEC_PAIRS, tokens)).toEqual([])
    })

    test('the pairs the ui components add meet 4.5:1 too', () => {
        expect(failing(UI_PAIRS, tokens)).toEqual([])
    })

    test('a control boundary (--edge-strong: Input, Select, Switch, the Segmented track) is ≥ 3:1 on every surface (O-4)', () => {
        const boundary = ['--bg', '--surface', '--surface-2'].map((bg): Pair => ['--edge-strong', bg, 3])
        expect(failing(boundary, tokens)).toEqual([])
    })

    test('Tailwind gets every colour token under its own name (bg-surface-2, text-text-2, border-edge, …)', () => {
        const theme = declarations('@theme inline')
        const colours = Object.keys(tokens).filter((name) => /^#[0-9a-f]{6}$/.test(tokens[name]) && !/^--felt-(spring|summer|autumn|winter)/.test(name))
        expect(colours.length).toBeGreaterThanOrEqual(28)
        for (const name of colours) expect(theme[`--color-${name.slice(2)}`]).toBe(`var(${name})`)
    })
})

describe('preferences (spec §3.4)', () => {
    test('more contrast: edges use --edge-strong, secondary and tertiary text lighten and stay readable', () => {
        const more = declarations('@media (prefers-contrast: more)')
        expect(more).toEqual({ '--edge': 'var(--edge-strong)', '--text-2': '#d8e1e5', '--text-3': '#b5c3ca' })
        const values = { ...tokens, ...more }
        expect(failing(['--text-2', '--text-3'].flatMap((fg) => SURFACES.map((bg): Pair => [fg, bg, BODY])), values)).toEqual([])
    })

    test('reduced transparency: both materials turn opaque and lose the blur', () => {
        expect(tokens).toMatchObject({
            '--material-bar': 'rgba(10, 25, 22, 0.86)',
            '--material-blur': 'blur(16px) saturate(140%)',
            '--material-ink': 'rgba(34, 32, 52, 0.88)',
        })
        expect(declarations('@media (prefers-reduced-transparency: reduce)')).toEqual({
            '--material-bar': 'var(--surface)', '--material-blur': 'none', '--material-ink': 'var(--ink)',
        })
    })

    test('every focusable element gets the 2-px accent ring; a notched one draws it inside the clip (spec §3.4, §3.9)', () => {
        expect(css).toMatch(/:focus-visible\s*\{\s*outline:\s*2px solid var\(--accent\);\s*outline-offset:\s*2px;/)
        expect(css).toMatch(/@utility focus-inside\s*\{\s*&:focus-visible\s*\{\s*outline-offset:\s*-5px;/)
    })
})

describe('layers and safe areas (spec §3.4, §4.1)', () => {
    test('the z-index tokens of the §3.4 table', () => {
        expect(tokens).toMatchObject({
            '--z-felt': '0', '--z-particles': '1', '--z-piles': '10', '--z-trick': '20', '--z-hand': '30',
            '--z-chips': '40', '--z-bar': '40', '--z-bid': '50', '--z-sweep': '60', '--z-sheet': '70',
            '--z-scrim': '80', '--z-modal': '90', '--z-toast': '100',
        })
    })

    test('the safe-area insets are real on iOS: viewport-fit=cover, read through --safe-*', () => {
        const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'index.html'), 'utf8')
        expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />')
        for (const side of ['top', 'right', 'bottom', 'left']) {
            expect(tokens[`--safe-${side}`]).toBe(`env(safe-area-inset-${side}, 0px)`)
        }
    })
})
