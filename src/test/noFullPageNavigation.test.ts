import { describe, test, expect } from 'vitest'
import { shippedSources } from './sourceFiles'

// R-37: assigning window.location.href reloads the whole SPA (on a phone it also re-opens the
// sidebar); internal links use the router. A deliberate full load uses window.location.assign
// or reload, which this test leaves alone.
const HREF_ASSIGNMENT = /window\.location\.href\s*=(?!=)/

describe('internal navigation (R-37)', () => {
    test('no shipped source file assigns window.location.href', () => {
        const offenders = shippedSources()
            .flatMap(({ path, text }) => text.split('\n').map((line, index) => ({ where: `${path}:${index + 1}`, line })))
            .filter(({ line }) => HREF_ASSIGNMENT.test(line))
            .map(({ where, line }) => `${where}: ${line.trim()}`)
        expect(offenders).toEqual([])
    })
})
