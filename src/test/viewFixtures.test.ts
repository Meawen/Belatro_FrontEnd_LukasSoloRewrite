import { describe, test, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// spec §4.17: recorded view sequences keep only received MESSAGE bodies. A CONNECT frame carries the JWT in its
// Authorization header ("Bearer eyJ…"), so neither string may ever reach a fixture under src/test/fixtures/views/.
// Not new URL(…, import.meta.url): Vite rewrites that form into an import.
const VIEWS = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'views')

describe('the view fixtures (spec §4.17)', () => {
    test('no file under src/test/fixtures/views/ holds "Bearer" or a JWT ("eyJ")', () => {
        expect(existsSync(VIEWS)).toBe(true)
        const hits = readdirSync(VIEWS, { recursive: true, encoding: 'utf8' })
            .filter((relative) => !relative.endsWith('/') && /\.\w+$/.test(relative))
            .flatMap((relative) => readFileSync(join(VIEWS, relative), 'utf8').split('\n')
                .map((line, index) => ({ where: `src/test/fixtures/views/${relative}:${index + 1}`, line }))
                .filter(({ line }) => /Bearer|eyJ/.test(line))
                .map(({ where }) => where))
        expect(hits).toEqual([])
    })
})
