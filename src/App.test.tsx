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
// The game page's table opens the game socket; here a stand-in (GamePageConnected's own tests cover it).
vi.mock('./components/game/GamePageConnected', () => ({ default: () => <h1>The table</h1> }))

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
        // the root fallback sits in the minimal wordmark frame (spec §4.1)
        expect(screen.getByText('Stiglja')).toBeInTheDocument()
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
        for (const tile of ['dashboard-elo', 'dashboard-games', 'dashboard-level']) {
            expect(screen.getByTestId(tile)).toHaveTextContent(/^—$/)
        }
        // the Win Rate tile goes: Home is a launcher, and no number is shown that the API does not give (D-26)
        expect(screen.queryByTestId('dashboard-win-rate')).not.toBeInTheDocument()
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
            // the 404's title is "Page not found" (spec §4.16)
            expect(screen.queryByText('Page not found'), href).not.toBeInTheDocument()
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

describe('The shell (spec §4.1)', () => {
    const unverified = { id: 'u1', username: 'ana', email: null, pendingEmail: 'ana@example.com', emailVerified: false, roles: ['ROLE_USER'], deletionRequested: false }

    test('a signed-out visit to a page in the shell goes to sign-in, carrying the page (D-20)', () => {
        auth.isAuthenticated = false
        renderAt('/lobby/abc?seat=b')
        expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
        expect(window.location.pathname).toBe('/login')
        expect((window.history.state as { usr?: { from?: string } } | null)?.usr?.from).toBe('/lobby/abc?seat=b')
    })

    test('Settings is in the nav and leads to Settings (AC 5, R-34 amended)', async () => {
        renderAt('/dashboard')
        const nav = screen.getByRole('navigation', { name: 'Main navigation' })
        await userEvent.setup().click(within(nav).getByRole('link', { name: 'Settings' }))
        expect(window.location.pathname).toBe('/settings')
        expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
        expect(document.title).toBe('Settings · Stiglja')
    })

    test('the game page has no shell: no navigation, banners or footer (X-8, R-40)', async () => {
        vi.spyOn(userService, 'getActiveGame').mockResolvedValue('g1')
        vi.spyOn(userService, 'getMe').mockResolvedValue(unverified as never)
        renderAt('/game/g1')
        await act(async () => {})
        expect(screen.getByRole('heading', { name: 'The table' })).toBeInTheDocument()
        expect(document.title).toBe('Game · Stiglja')
        expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument()
        expect(screen.queryByRole('region', { name: 'Game in progress' })).not.toBeInTheDocument()
        expect(screen.queryByRole('region', { name: 'Email confirmation' })).not.toBeInTheDocument()
        expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
    })

    test('on any other page the same player sees both banners, and the footer', async () => {
        vi.spyOn(userService, 'getActiveGame').mockResolvedValue('g1')
        vi.spyOn(userService, 'getMe').mockResolvedValue(unverified as never)
        renderAt('/settings')
        expect(await screen.findByRole('region', { name: 'Game in progress' })).toBeInTheDocument()
        expect(await screen.findByRole('region', { name: 'Email confirmation' })).toBeInTheDocument()
        expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    })

    test.each([true, false])('an unknown path shows Not found, in the shell only when signed in (signed in: %s)', (signedIn) => {
        auth.isAuthenticated = signedIn
        renderAt('/no/such/page')
        expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
        expect(screen.queryAllByRole('navigation', { name: 'Main navigation' })).toHaveLength(signedIn ? 1 : 0)
    })

    test('signed out, /users shows its prompt in the public frame (M-13)', () => {
        auth.isAuthenticated = false
        renderAt('/users')
        expect(screen.getByText('Please log in to view the user leaderboard.')).toBeInTheDocument()
        expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument()
    })
})
