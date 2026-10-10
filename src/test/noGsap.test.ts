import { describe, test, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { shippedSources } from './sourceFiles'

/** A file at the repo root (this file is src/test/noGsap.test.ts). */
// Not new URL(…, import.meta.url): Vite rewrites that form into an import.
const repoFile = (path: string) => join(dirname(fileURLToPath(import.meta.url)), '..', '..', path)

const lines = () => shippedSources()
    .flatMap(({ path, text }) => text.split('\n').map((line, index) => ({ where: `${path}:${index + 1}`, line })))

describe('the motion engine (D-4) and the demo boards (D-27)', () => {
    test('no shipped source imports GSAP', () => {
        const hits = lines()
            .filter(({ line }) => /from\s+['"](gsap|@gsap\/react)['"/]|require\(\s*['"]gsap/.test(line))
            .map(({ where, line }) => `${where}: ${line.trim()}`)
        expect(hits).toEqual([])
    })

    test('package.json pins motion to exactly 13.4.4 and lists nothing of GSAP', () => {
        const pkg = JSON.parse(readFileSync(repoFile('package.json'), 'utf8'))
        const deps = { ...pkg.dependencies, ...pkg.devDependencies }
        expect(pkg.dependencies.motion).toBe('13.4.4')
        expect(Object.keys(deps).filter((name) => name.includes('gsap'))).toEqual([])
    })

    test('the demo boards are gone: no src/MockComponents, no /play/mock or /play/realistic, no useCards or cardService', () => {
        expect(existsSync(repoFile('src/MockComponents'))).toBe(false)
        const hits = lines()
            .filter(({ line }) => /\/play\/(mock|realistic)|MockComponents|useCards|cardService/.test(line))
            .map(({ where, line }) => `${where}: ${line.trim()}`)
        expect(hits).toEqual([])
    })
})
