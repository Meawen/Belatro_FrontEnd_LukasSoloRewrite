import { describe, test, expect } from 'vitest'
import { indexCss, rules, uiCss } from '../../test/css'

describe('ui component styles (spec §3.1, §3.4, §3.9)', () => {
    test('no ui rule clips the element itself: notches sit on ::before, so the focus ring stays visible', () => {
        const clipped = rules(uiCss())
            .filter(({ body }) => /clip-path/.test(body))
            .filter(({ selector }) => !selector.split(',').every((part) => part.trim().endsWith('::before')))
            .map(({ selector }) => selector)
        expect(clipped).toEqual([])
    })

    test('no border-radius anywhere: corners are pixel notches', () => {
        expect(indexCss.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/border-radius/)
    })

    test('only transform and opacity animate in the ui components', () => {
        const animated = rules(uiCss())
            .flatMap(({ selector, body }) => [...body.matchAll(/transition:\s*([^;]+);/g)].map((match) => ({ selector, value: match[1] })))
            .filter(({ value }) => !value.split(',').every((part) => /^(transform|opacity)\b/.test(part.trim())))
            .map(({ selector, value }) => `${selector}: ${value}`)
        expect(animated).toEqual([])
    })
})
