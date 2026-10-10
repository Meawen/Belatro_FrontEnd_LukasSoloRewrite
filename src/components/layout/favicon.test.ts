import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// public/favicon.svg (this file is src/components/layout/favicon.test.ts).
// Not new URL(…, import.meta.url): Vite rewrites that form into an import.
const favicon = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', 'favicon.svg'), 'utf8')

describe('favicon (X-16)', () => {
    test('a pixel "S": whole-pixel rects in the background and accent tokens, no curves or rounding', () => {
        const svg = new DOMParser().parseFromString(favicon, 'image/svg+xml').documentElement
        expect(svg.getAttribute('shape-rendering')).toBe('crispEdges')
        const shapes = [...svg.children]
        expect(shapes.length).toBeGreaterThan(2)
        expect(new Set(shapes.map((shape) => shape.tagName))).toEqual(new Set(['rect']))
        for (const rect of shapes) {
            for (const attribute of ['x', 'y', 'width', 'height']) {
                expect(Number.isInteger(Number(rect.getAttribute(attribute))), `${attribute} of ${rect.outerHTML}`).toBe(true)
            }
            expect(rect.hasAttribute('rx')).toBe(false)
        }
        expect(new Set(shapes.map((shape) => shape.getAttribute('fill')))).toEqual(new Set(['#0a1916', '#fbf236']))
    })
})
