import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import App from '../App'
import { shippedSources } from './sourceFiles'

// The R4 review's cheapest lever on the entry chunk: /admin (AdminDashboard with BetaPanel, StatTile, UserManagement) is
// its own chunk, fetched when an admin opens it, as the game page and Škola bele are (gameChunk, learnChunk)
vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'u1', username: 'ana' }, isAuthenticated: true, isLoading: false, logout: vi.fn(), token: 'tok-1' }),
}))

/** src/App.tsx as text (this file is src/test/adminChunk.test.tsx). Not new URL(…, import.meta.url): Vite rewrites it. */
const appSource = () => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'App.tsx'), 'utf8')

/** Every static import or re-export (not an import() call) of each shipped module: [importer, the module it names]. */
function staticImports(): [string, string][] {
    const statement = /^\s*(?:import(?!\s*\()|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm
    return shippedSources().flatMap(({ path, text }) => [...text.matchAll(statement)].map((match): [string, string] => {
        const spec = match[1] ?? match[2]
        return [path, spec.startsWith('.') ? posix.normalize(posix.join(posix.dirname(path), spec)) : spec]
    }))
}

/** The admin page and its parts. */
const isAdmin = (path: string) => /^src\/pages\/AdminPage(?:\.tsx)?$/.test(path) || path.startsWith('src/components/admin/')

// Node 26's own localStorage global is unusable here; borrow jsdom's (see api.test.ts)
const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

beforeEach(() => {
    vi.stubGlobal('localStorage', jsdomStorage)
    // the shell's own requests (GET /user/me, …) get an empty 204, never a network
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
})
afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    jsdomStorage.clear()
})

describe('the admin page loads on demand (R4 review, the entry chunk)', () => {
    test('App.tsx reaches the admin page only through import(), never a static import', () => {
        const source = appSource()
        expect(source).not.toMatch(/^import[^;]*['"]\.\/pages\/AdminPage['"]/m)
        expect(source).toContain("lazy(() => import('./pages/AdminPage')")
    })

    test('nothing outside the admin page imports it or its parts', () => {
        const imports = staticImports()
        // the check itself, so it can't pass by matching nothing
        expect(imports).toContainEqual(['src/pages/AdminPage.tsx', 'src/components/admin/AdminDashboard'])
        expect(imports).toContainEqual(['src/components/admin/BetaPanel.tsx', 'src/components/admin/StatTile'])
        const outside = imports.filter(([path, target]) => isAdmin(target) && !isAdmin(path))
        expect(outside).toEqual([])
    })

    test('/admin keeps the shell while its chunk loads, with the loading line, then shows the page', async () => {
        window.history.pushState({}, '', '/admin')
        render(<App />)
        expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
        expect(screen.getByText('Shuffling…')).toBeInTheDocument()
        expect(screen.queryByRole('heading', { level: 1, name: 'Admin' })).not.toBeInTheDocument()

        expect(await screen.findByRole('heading', { level: 1, name: 'Admin' })).toBeInTheDocument()
        expect(document.title).toBe('Admin · Stiglja')
    })
})
