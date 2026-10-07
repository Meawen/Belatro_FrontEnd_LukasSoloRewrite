import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { JSDOM } from 'jsdom'
import App from './App'
import { useUser } from './hooks/useUser'
import { captureConsole } from './test/captureConsole'

// One switch for every test: signed in (the default) or signed out.
const auth = vi.hoisted(() => ({ isAuthenticated: true }))
vi.mock('./hooks/useAuth', () => ({
    useAuth: () => ({
        user: auth.isAuthenticated ? { id: 'u1', username: 'ana' } : null,
        isAuthenticated: auth.isAuthenticated,
        isLoading: false,
        logout: vi.fn(),
        token: auth.isAuthenticated ? 'tok-1' : null,
    }),
}))
// The dashboard's numbers come from GET /user/{id} through useUser.
vi.mock('./hooks/useUser', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./hooks/useUser')>()),
    useUser: vi.fn(),
}))
// A page whose render throws, like a payload shape the code does not expect.
vi.mock('./components/match/MatchHistory', () => ({
    MatchHistory: () => {
        throw new Error('render failed')
    },
}))

// Node 26's own localStorage global is unusable here; borrow jsdom's (see api.test.ts)
const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

/** App owns its BrowserRouter, so the route comes from the window's location. */
function renderAt(path: string) {
    window.history.pushState({}, '', path)
    return render(<App />)
}

beforeEach(() => {
    auth.isAuthenticated = true
    vi.mocked(useUser).mockReturnValue({ user: null, isLoading: false, error: null, refetch: vi.fn() } as never)
    vi.stubGlobal('localStorage', jsdomStorage)
    // The shell's own requests (GET /user/me, …) get an empty 204, never a network
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
})
afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    jsdomStorage.clear()
})

describe('App error boundary (R-29)', () => {
    test('a page that throws shows the fallback with Reload and Go to dashboard, not a blank page', () => {
        // React reports the caught error on the console
        const logs = captureConsole()
        renderAt('/matches')
        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
        expect(screen.getByText('Reload')).toBeInTheDocument()
        expect(screen.getByText('Go to dashboard')).toBeInTheDocument()
        expect(logs.text()).toContain('render failed')
    })
})

describe('Dashboard tiles (R-34)', () => {
    test("show the player's own Elo and games, and level 0 as 1", () => {
        vi.mocked(useUser).mockReturnValue({
            user: { id: 'u1', username: 'ana', eloRating: 1450, level: 0, gamesPlayed: 42 },
            isLoading: false, error: null, refetch: vi.fn(),
        } as never)
        renderAt('/dashboard')
        expect(vi.mocked(useUser)).toHaveBeenCalledWith('u1')
        expect(screen.getByTestId('dashboard-elo')).toHaveTextContent(/^1450$/)
        expect(screen.getByTestId('dashboard-games')).toHaveTextContent(/^42$/)
        expect(screen.getByTestId('dashboard-level')).toHaveTextContent(/^1$/)
    })

    test('show — where the API gives nothing', () => {
        renderAt('/dashboard')
        for (const tile of ['dashboard-elo', 'dashboard-games', 'dashboard-level', 'dashboard-win-rate']) {
            expect(screen.getByTestId(tile)).toHaveTextContent(/^—$/)
        }
    })
})
