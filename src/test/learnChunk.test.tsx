import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import App from '../App'
import { playHand1 } from '../guide/testing'
import { shippedSources } from './sourceFiles'

// Škola bele (open beta §7, §10): /learn and its recording are their own chunk, fetched when /learn opens, so none of
// it reaches the entry; and hand 1, signed out, asks the server nothing

vi.setConfig({ testTimeout: 60_000 })

/** src/App.tsx as text (this file is src/test/learnChunk.test.tsx). Not new URL(…, import.meta.url): Vite rewrites it. */
const appSource = () => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'App.tsx'), 'utf8')

/** Every static import or re-export (not an import() call) of each shipped module: [importer, the module it names]. */
function staticImports(): [string, string][] {
    const statement = /^\s*(?:import(?!\s*\()|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm
    return shippedSources().flatMap(({ path, text }) => [...text.matchAll(statement)].map((match): [string, string] => {
        const spec = match[1] ?? match[2]
        return [path, spec.startsWith('.') ? posix.normalize(posix.join(posix.dirname(path), spec)) : spec]
    }))
}

/** Inside Škola bele: the page, src/guide/ and src/components/guide/. */
const insideGuide = (path: string) => path === 'src/pages/LearnPage.tsx' || path.startsWith('src/guide/') || path.startsWith('src/components/guide/')

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
})
afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('Škola bele loads on demand (open beta §7, §10)', () => {
    test('App.tsx reaches the guide only through import()', () => {
        const source = appSource()
        expect(source).not.toMatch(/^import[^;]*['"]\.\/pages\/LearnPage['"]/m)
        expect(source).toContain("lazy(() => import('./pages/LearnPage')")
        // the Rules no longer stand in for it (S9's placeholder)
        expect(source).not.toContain('<Navigate to="/rules"')
    })

    test('only the lazy page imports the recording and the guide', () => {
        const imports = staticImports()
        // the check itself, so it can't pass by matching nothing
        expect(imports).toContainEqual(['src/pages/LearnPage.tsx', 'src/guide/hand1.recording.json'])
        expect(imports).toContainEqual(['src/pages/LearnPage.tsx', 'src/components/guide/LessonPanel'])
        expect(imports.filter(([, target]) => target.endsWith('hand1.recording.json')).map(([path]) => path)).toEqual(['src/pages/LearnPage.tsx'])
        const guide = ['src/pages/LearnPage', 'src/guide/useGuideReplay', 'src/guide/script', 'src/components/guide/LessonPanel']
        const outside = imports.filter(([path, target]) => guide.includes(target.replace(/\.tsx?$/, '')) && !insideGuide(path))
        expect(outside).toEqual([])
    })

    test("hand 2's guide mode rides in the game chunk", () => {
        const imports = staticImports()
        const hand2 = ['src/guide/hand2', 'src/guide/useHand2Coach', 'src/components/guide/Hand2Panel', 'src/components/guide/FoulWarning', 'src/components/guide/GuideEndSheet']
        const isHand2 = (path: string) => hand2.includes(path.replace(/\.tsx?$/, ''))
        // the check itself, so it can't pass by matching nothing
        expect(imports).toContainEqual(['src/components/game/GamePageConnected.tsx', 'src/guide/useHand2Coach'])
        expect(imports).toContainEqual(['src/components/game/GamePageConnected.tsx', 'src/components/guide/GuideEndSheet'])
        const outside = imports.filter(([path, target]) => isHand2(target) && path !== 'src/components/game/GamePageConnected.tsx' && !isHand2(path))
        expect(outside).toEqual([])
        // and the game page itself only from GamePage, which App.tsx reaches lazily (gameChunk.test.tsx)
        const connected = imports.filter(([, target]) => target === 'src/components/game/GamePageConnected')
        expect(connected).toContainEqual(['src/pages/GamePage.tsx', 'src/components/game/GamePageConnected'])
        expect(connected.map(([path]) => path)).toEqual(['src/pages/GamePage.tsx'])
    })

    test('/learn shows the first frame while its chunk loads, then the intro', async () => {
        window.history.pushState({}, '', '/learn')
        render(<App />)
        expect(screen.getByText('Shuffling…')).toBeInTheDocument()
        expect(await screen.findByRole('heading', { level: 1, name: 'Bela school' })).toBeInTheDocument()
        expect(screen.queryByText('Shuffling…')).not.toBeInTheDocument()
        expect(document.title).toBe('Bela school · Stiglja')
    })

    test('signed out, the whole of hand 1 asks the server nothing', async () => {
        // the real useAuth over empty storage: a visitor with no session
        localStorage.clear()
        window.history.pushState({}, '', '/learn')
        render(<App />)
        expect(await screen.findByRole('heading', { level: 1, name: 'Bela school' })).toBeInTheDocument()
        vi.useFakeTimers()
        await playHand1()
        expect(screen.getByRole('heading', { level: 1, name: 'Hand 1 done' })).toBeInTheDocument()
        // S15 allows exactly one request here: POST …/api/public/guide-events
        expect(fetch).not.toHaveBeenCalled()
    })
})
