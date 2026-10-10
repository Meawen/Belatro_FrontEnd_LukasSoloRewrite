import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import App from '../App'

// spec §3.8 (O-5): the game page and /dev/board are their own chunks, loaded when a game opens
vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'u1', username: 'ana' }, isAuthenticated: true, isLoading: false, logout: vi.fn(), token: 'tok-1' }),
}))
// The table opens the game socket; a stand-in here (GamePageConnected's own tests cover it)
vi.mock('../components/game/GamePageConnected', () => ({ default: () => <h1>The table</h1> }))

/** src/App.tsx as text (this file is src/test/gameChunk.test.tsx). */
// Not new URL(…, import.meta.url): Vite rewrites that form into an import.
const appSource = () => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'App.tsx'), 'utf8')

// Node 26's own localStorage global is unusable here; borrow jsdom's (see api.test.ts)
const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

beforeEach(() => {
    vi.stubGlobal('localStorage', jsdomStorage)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
})
afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    jsdomStorage.clear()
})

describe('the game page loads on demand (spec §3.8, O-5)', () => {
    test('App.tsx reaches the game page and the dev board only through import(), never a static import', () => {
        const source = appSource()
        expect(source).not.toMatch(/^import[^;]*['"]\.\/pages\/GamePage['"]/m)
        expect(source).not.toMatch(/^import[^;]*['"]\.\/dev\/DevBoardPage['"]/m)
        expect(source).toContain("lazy(() => import('./pages/GamePage')")
        expect(source).toContain("lazy(() => import('./dev/DevBoardPage'))")
    })

    test('/game/:id shows the game page’s first frame while its chunk loads, then the page', async () => {
        window.history.pushState({}, '', '/game/g1')
        render(<App />)
        expect(screen.getByText('Connecting to game...')).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'The table' })).not.toBeInTheDocument()

        expect(await screen.findByRole('heading', { name: 'The table' })).toBeInTheDocument()
        expect(screen.queryByText('Connecting to game...')).not.toBeInTheDocument()
        expect(document.title).toBe('Game · Stiglja')
    })
})
