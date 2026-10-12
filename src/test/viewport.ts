import { vi } from 'vitest'

/** Whether one media query (a comma means "or", "and" joins features) holds for a window this size. */
function holds(query: string, width: number, height: number): boolean {
    return query.split(',').some((part) =>
        part.split(/\band\b/).every((feature) => {
            const size = /\(\s*(min|max)-(width|height)\s*:\s*([\d.]+)px\s*\)/.exec(feature)
            if (size) {
                const value = size[2] === 'width' ? width : height
                return size[1] === 'min' ? value >= Number(size[3]) : value <= Number(size[3])
            }
            const orientation = /\(\s*orientation\s*:\s*(landscape|portrait)\s*\)/.exec(feature)
            if (orientation) return (orientation[1] === 'landscape') === width > height
            return false
        }),
    )
}

/**
 * A matchMedia for a window of `width` × `height` CSS px: it answers min/max width and height and the
 * orientation; any other feature (prefers-reduced-motion, …) does not match. Undo with vi.unstubAllGlobals().
 */
export function viewport(width: number, height: number) {
    vi.stubGlobal('matchMedia', (query: string) => ({
        matches: holds(query, width, height),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }))
}
