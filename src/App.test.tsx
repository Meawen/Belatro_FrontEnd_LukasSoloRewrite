import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JSDOM } from 'jsdom'
import App from './App'
import { useUser } from './hooks/useUser'
import { userService } from './services/userService'
import { captureConsole } from './test/captureConsole'

// One switch for every test: signed in (the default) or signed out, and the stored token.
const auth = vi.hoisted(() => ({ isAuthenticated: true, token: 'tok-1' }))
vi.mock('./hooks/useAuth', () => ({
    useAuth: () => ({
        user: auth.isAuthenticated ? { id: 'u1', username: 'ana' } : null,
        isAuthenticated: auth.isAuthenticated,
        isLoading: false,
        logout: vi.fn(),
        token: auth.isAuthenticated ? auth.token : null,
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
    auth.token = 'tok-1'
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

describe('Privacy and Terms (R-40)', () => {
    test('/privacy is readable signed out and names who runs the service', () => {
        auth.isAuthenticated = false
        renderAt('/privacy')
        expect(screen.getByRole('heading', { level: 1, name: 'Privacy notice' })).toBeInTheDocument()
        expect(screen.getByText('Stiglja is run by Lukas Miholić, Bregana, Croatia.')).toBeInTheDocument()
    })

    test('/terms is readable signed out', () => {
        auth.isAuthenticated = false
        renderAt('/terms')
        expect(screen.getByRole('heading', { level: 1, name: 'Terms of use' })).toBeInTheDocument()
    })

    test('every footer link leads to a routed page, and the footer names the support address', () => {
        renderAt('/dashboard')
        const hrefs = within(screen.getByRole('contentinfo')).getAllByRole('link').map((link) => link.getAttribute('href') ?? '')
        cleanup()
        expect(hrefs).toContain('mailto:support@stiglja.com')
        const internal = hrefs.filter((href) => href.startsWith('/'))
        expect(internal.length).toBeGreaterThan(0)
        for (const href of internal) {
            renderAt(href)
            expect(screen.queryByText('Page Not Found'), href).not.toBeInTheDocument()
            cleanup()
        }
    })
})

describe('Rules (R-41)', () => {
    test('/rules is readable signed out and says a challenge is per hand', () => {
        auth.isAuthenticated = false
        renderAt('/rules')
        expect(screen.getByRole('heading', { level: 1, name: 'Rules' })).toBeInTheDocument()
        expect(screen.getByText('Each player has one challenge per hand; a wrong challenge uses it up for that hand.')).toBeInTheDocument()
    })

    test('"Read Guide" on the dashboard opens the rules', async () => {
        renderAt('/dashboard')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Read Guide' }))
        expect(screen.getByRole('heading', { level: 1, name: 'Rules' })).toBeInTheDocument()
    })

    test('an expired stored token: /rules asks nothing, signs nobody out and stays readable', async () => {
        captureConsole()
        // a JWT whose exp passed an hour ago (the SPA reads exp without checking the signature)
        const claims = btoa(JSON.stringify({ sub: 'ana', exp: Math.floor(Date.now() / 1000) - 3600 })).replace(/=+$/, '')
        const expired = `eyJhbGciOiJIUzI1NiJ9.${claims}.signature`
        auth.token = expired
        jsdomStorage.setItem('authToken', expired)
        // what the backend answers that token
        const fetch = vi.fn(async () => new Response(JSON.stringify({ error: 'Session expired, please sign in again' }), { status: 401 }))
        vi.stubGlobal('fetch', fetch)
        renderAt('/rules')
        await act(async () => {})
        expect(fetch).not.toHaveBeenCalled()
        // a 401 would have signed the tab out: the token removed, then /login?reason=session-ended
        expect(jsdomStorage.getItem('authToken')).toBe(expired)
        expect(screen.getByRole('heading', { level: 1, name: 'Rules' })).toBeInTheDocument()
    })

    test('signed in with a game in progress, /rules offers the way back to it', async () => {
        vi.spyOn(userService, 'getActiveGame').mockResolvedValue('g9')
        renderAt('/rules')
        expect(await screen.findByRole('button', { name: 'Return to your game' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 1, name: 'Rules' })).toBeInTheDocument()
    })
})
