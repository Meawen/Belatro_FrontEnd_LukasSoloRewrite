import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JSDOM } from 'jsdom'
import App from './App'
import { useUser } from './hooks/useUser'
import { userService } from './services/userService'
import { captureConsole } from './test/captureConsole'
import { authService } from './services/authService'
import { lobbyService } from './services/lobbyService'

// One switch for every test: signed in (the default) or signed out, a member (the default) or a guest, and the stored token.
const auth = vi.hoisted(() => ({ isAuthenticated: true, guest: false, token: 'tok-1' }))
vi.mock('./hooks/useAuth', () => ({
    useAuth: () => ({
        user: !auth.isAuthenticated ? null : auth.guest ? { id: 'g1', username: 'gost_4821', guest: true } : { id: 'u1', username: 'ana' },
        isAuthenticated: auth.isAuthenticated,
        isGuest: auth.isAuthenticated && auth.guest,
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
// The one-click bot game (spec §6): its request is NeedsAccountPage's own test's; here a stub.
const bots = vi.hoisted(() => ({ startBotGame: vi.fn() }))
vi.mock('./services/botGame', () => ({ startBotGame: bots.startBotGame }))
// A table's room polls its lobby; here a stand-in that names the table it was given (and notes each table it showed).
const rooms = vi.hoisted(() => ({ shown: [] as string[] }))
vi.mock('./components/lobby/LobbyRoom', () => ({
    LobbyRoom: ({ lobbyId }: { lobbyId: string }) => {
        rooms.shown.push(lobbyId)
        return <h1>The room {lobbyId}</h1>
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
    auth.guest = false
    auth.token = 'tok-1'
    bots.startBotGame.mockReset()
    rooms.shown = []
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

describe('Home with a game in progress (spec §2.5 R-33)', () => {
    test("/dashboard shows the Return to your game card in the banner's place, and it leads to the game", async () => {
        vi.spyOn(userService, 'getActiveGame').mockResolvedValue('g1')
        renderAt('/dashboard')
        const card = await screen.findByRole('region', { name: 'Game in progress' })
        await act(async () => {})
        expect(card).toHaveClass('ui-panel--accent')
        expect(screen.getAllByRole('region', { name: 'Game in progress' })).toEqual([card])
        expect(screen.getAllByRole('button', { name: 'Return to your game' })).toHaveLength(1)
        await userEvent.setup().click(within(card).getByRole('button', { name: 'Return to your game' }))
        // the game page is its own chunk (O-5): it arrives a tick later
        expect(await screen.findByRole('heading', { name: 'The table' })).toBeInTheDocument()
    })
})

describe('Privacy and Terms (R-40)', () => {
    test('/privacy is readable signed out and names who runs the service', async () => {
        auth.isAuthenticated = false
        renderAt('/privacy')
        expect(screen.getByRole('heading', { level: 1, name: 'Privacy notice' })).toBeInTheDocument()
        expect(await screen.findByText('Stiglja is run by Lukas Miholić, Bregana, Croatia.')).toBeInTheDocument()
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

describe('The waitlist link (spec §2.2, B7)', () => {
    test("/waitlist/confirm opens signed out and signed in, and asks nothing before the click (B7's link)", async () => {
        for (const signedIn of [false, true]) {
            auth.isAuthenticated = signedIn
            const fetch = vi.fn(async () => new Response(null, { status: 204 }))
            vi.stubGlobal('fetch', fetch)
            renderAt('/waitlist/confirm?token=t1')
            expect(screen.getByRole('heading', { level: 1, name: 'Confirm your place on the waitlist' }), String(signedIn)).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Confirm my place' })).toBeEnabled()
            expect(document.title).toBe('Waitlist · Stiglja')
            await act(async () => {})
            const urls = fetch.mock.calls.map(([url]) => String(url))
            expect(urls.filter((url) => url.endsWith('/waitlist/confirm')), String(signedIn)).toEqual([])
            cleanup()
        }
    })
})

describe('Rules (R-41)', () => {
    test('/rules is readable signed out and says a challenge is per game (gameplay rules §1)', async () => {
        auth.isAuthenticated = false
        renderAt('/rules')
        expect(screen.getByRole('heading', { level: 1, name: 'Rules' })).toBeInTheDocument()
        expect(await screen.findByText('Each player has one challenge per game. A right challenge keeps it; a wrong one uses it up.')).toBeInTheDocument()
    })

    // owner 2026-10-11: Rules sits in the shell, with the sidebar, like every other signed-in page
    test('signed in: /rules is in the shell, with the navigation', async () => {
        renderAt('/rules')
        expect(screen.getByRole('heading', { level: 1, name: 'Rules' })).toBeInTheDocument()
        expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
        expect(await screen.findByRole('heading', { level: 2, name: 'How to play' })).toBeInTheDocument()
        expect(document.title).toBe('Rules · Stiglja')
    })

    test('signed out: /rules stays in the public frame, without the navigation', () => {
        auth.isAuthenticated = false
        renderAt('/rules')
        expect(screen.getByRole('heading', { level: 1, name: 'Rules' })).toBeInTheDocument()
        expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument()
    })

    test('"Bela school" on Doma opens Škola bele, the Rules until S13 (call 1)', async () => {
        renderAt('/dashboard')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Bela school' }))
        expect(screen.getByRole('heading', { level: 1, name: 'Rules' })).toBeInTheDocument()
        expect(window.location.pathname).toBe('/rules')
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
        expect(await screen.findByRole('heading', { name: 'The table' })).toBeInTheDocument()
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

describe('A guest (spec §3.2, §3.3)', () => {
    beforeEach(() => {
        auth.guest = true
    })

    test.each([
        ['/play', 'Ranked'],
        ['/lobbies', 'Tables'],
        ['/matches', 'Matches'],
        ['/matches/m1', 'Matches'],
        ['/friends', 'Friends'],
        ['/users', 'Leaderboard'],
        ['/profile', 'Profile'],
        ['/profile/u7', 'Profile'],
        ['/settings', 'Settings'],
    ])('%s: a guest sees what it is and how to unlock it, in the shell', (path, name) => {
        renderAt(path)
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(new RegExp(`^${name}$`))
        expect(screen.getByText('This needs an account')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Play against bots as a guest' })).toBeInTheDocument()
        expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
        expect(document.title).toBe(`${name} · Stiglja`)
    })

    test('Sign up leads to the sign-up form, not back here (PublicRoute and AuthPage let a guest through)', async () => {
        renderAt('/friends')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Sign up' }))
        expect(window.location.pathname).toBe('/signup')
        expect(await screen.findByRole('heading', { name: 'Create Account' })).toBeInTheDocument()
        expect((window.history.state as { usr?: { from?: string } } | null)?.usr?.from).toBe('/friends')
    })

    test('Play against bots as a guest opens the new game', async () => {
        bots.startBotGame.mockResolvedValue({ gameId: 'g7', lobbyId: 'l7' })
        renderAt('/play')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Play against bots as a guest' }))
        expect(await screen.findByRole('heading', { name: 'The table' })).toBeInTheDocument()
        expect(window.location.pathname).toBe('/game/g7')
    })

    test("a guest opens a friend's table and a game (spec §3.2)", async () => {
        renderAt('/lobby/abc')
        expect(screen.getByRole('heading', { name: 'The room abc' })).toBeInTheDocument()
        expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
        expect(screen.queryByText('This needs an account')).not.toBeInTheDocument()
        cleanup()
        renderAt('/game/g1')
        expect(await screen.findByRole('heading', { name: 'The table' })).toBeInTheDocument()
    })

    test('a guest sees no email banner, and from /dashboard (the landing page, call 3) still gets the way back to a running game', async () => {
        vi.spyOn(userService, 'getMe').mockResolvedValue({
            id: 'g1', username: 'gost_4821', email: null, pendingEmail: null, emailVerified: false, roles: ['ROLE_GUEST'], deletionRequested: false, guest: true,
        } as never)
        vi.spyOn(userService, 'getActiveGame').mockResolvedValue('g1')
        renderAt('/dashboard')
        expect(await screen.findByRole('button', { name: 'Return to your game' })).toBeInTheDocument()
        expect(window.location.pathname).toBe('/')
        await act(async () => {})
        expect(screen.queryByRole('region', { name: 'Email confirmation' })).not.toBeInTheDocument()
        cleanup()
        renderAt('/lobby/abc')
        await act(async () => {})
        expect(screen.queryByRole('region', { name: 'Email confirmation' })).not.toBeInTheDocument()
    })

    test('the shell asks nothing about the guest by id: GET /user/{id} refuses a guest (B4)', async () => {
        const fetch = vi.fn(async () => new Response(null, { status: 204 }))
        vi.stubGlobal('fetch', fetch)
        renderAt('/lobby/abc')
        await act(async () => {})
        expect(vi.mocked(useUser)).not.toHaveBeenCalledWith('g1')
        expect(fetch.mock.calls.map(([url]) => String(url))).not.toContainEqual(expect.stringMatching(/\/user\/g1/))
    })

    test('a member still gets the page itself', () => {
        auth.guest = false
        renderAt('/settings')
        expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
        expect(screen.queryByText('This needs an account')).not.toBeInTheDocument()
    })
})

describe('The landing page and Doma (spec §4, §5)', () => {
    const unverified = { id: 'u1', username: 'ana', email: null, pendingEmail: 'ana@example.com', emailVerified: false, roles: ['ROLE_USER'], deletionRequested: false }

    test('signed out, / is the landing page, and each door goes where it says', async () => {
        auth.isAuthenticated = false
        const user = userEvent.setup()
        renderAt('/')
        expect(screen.getByRole('heading', { level: 1, name: 'Belot for four, online.' })).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Teach me' }))
        // call 1: /learn opens the Rules until Škola bele's page lands (S13)
        expect(await screen.findByRole('heading', { level: 1, name: 'Rules' })).toBeInTheDocument()
        expect(window.location.pathname).toBe('/rules')
        cleanup()

        renderAt('/')
        await user.click(screen.getByRole('button', { name: 'Sign up' }))
        expect(window.location.pathname).toBe('/signup')
        expect(await screen.findByRole('heading', { name: 'Create Account' })).toBeInTheDocument()
        cleanup()

        // as S8's: the guest's token and user are stored before it answers, and from then on this is a guest
        const startGuest = vi.spyOn(authService, 'startGuest').mockImplementation(async () => {
            jsdomStorage.setItem('authToken', 'g-tok')
            jsdomStorage.setItem('user', JSON.stringify({ id: 'g1', username: 'gost_4821', guest: true }))
            auth.isAuthenticated = true
            auth.guest = true
            return { token: 'g-tok', user: { id: 'g1', username: 'gost_4821', guest: true }, message: null }
        })
        bots.startBotGame.mockResolvedValue({ gameId: 'g7', lobbyId: 'l7' })
        renderAt('/')
        await user.click(screen.getByRole('button', { name: 'Play now' }))
        expect(await screen.findByRole('heading', { name: 'The table' })).toBeInTheDocument()
        expect(window.location.pathname).toBe('/game/g7')
        expect(startGuest).toHaveBeenCalledTimes(1)
        expect(bots.startBotGame).toHaveBeenCalledTimes(1)
    })

    test('a member at / goes to Doma', () => {
        renderAt('/')
        expect(window.location.pathname).toBe('/dashboard')
        expect(screen.getByRole('heading', { level: 1, name: 'Hi, ana! What are we playing?' })).toBeInTheDocument()
    })

    test('a guest at / sees the landing page as themselves, and a guest at /dashboard goes there too (call 3)', async () => {
        auth.guest = true
        renderAt('/')
        expect(await screen.findByRole('heading', { level: 2, name: 'Continue as gost_4821' })).toBeInTheDocument()
        expect(window.location.pathname).toBe('/')
        cleanup()
        renderAt('/dashboard')
        expect(window.location.pathname).toBe('/')
        expect(await screen.findByRole('heading', { level: 2, name: 'Continue as gost_4821' })).toBeInTheDocument()
        expect(screen.queryByText('This needs an account')).not.toBeInTheDocument()
    })

    test('neither page asks GET /user/{own id} for a guest (B4)', async () => {
        auth.guest = true
        const fetch = vi.fn(async () => new Response(null, { status: 204 }))
        vi.stubGlobal('fetch', fetch)
        for (const path of ['/', '/dashboard']) {
            renderAt(path)
            await act(async () => {})
            cleanup()
        }
        expect(fetch).toHaveBeenCalled()
        expect(fetch.mock.calls.map(([url]) => String(url))).not.toContainEqual(expect.stringMatching(/\/user\/g1$/))
        expect(vi.mocked(useUser)).not.toHaveBeenCalledWith('g1')
    })

    test("an unverified member's Doma shows the ranked lock, not the shell's email banner (call 6)", async () => {
        vi.spyOn(userService, 'getMe').mockResolvedValue(unverified as never)
        renderAt('/dashboard')
        const people = screen.getByRole('region', { name: 'Against people' })
        expect(await within(people).findByRole('button', { name: 'Resend confirmation email' })).toBeInTheDocument()
        await act(async () => {})
        expect(screen.queryByRole('region', { name: 'Email confirmation' })).not.toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: 'Resend confirmation email' })).toHaveLength(1)
    })
})

// The plan's "one click → the game page, with no lobby screen in between"
describe('One click to a bot game (spec §6)', () => {
    let lobbyCalls: ReturnType<typeof vi.spyOn>[] = []
    beforeEach(() => {
        bots.startBotGame.mockResolvedValue({ gameId: 'g7', lobbyId: 'l7' })
        lobbyCalls = [vi.spyOn(lobbyService, 'createLobby'), vi.spyOn(lobbyService, 'startMatch'), vi.spyOn(lobbyService, 'fillBots')]
    })

    /** After the click: the game page, one step on in history, never the room, and no table made, filled or started. */
    async function expectTheGameAlone(before: number) {
        expect(await screen.findByRole('heading', { name: 'The table' })).toBeInTheDocument()
        expect(window.location.pathname).toBe('/game/g7')
        expect(window.history.length).toBe(before + 1)
        expect(rooms.shown).toEqual([])
        expect(screen.queryByRole('heading', { name: /^The room/ })).not.toBeInTheDocument()
        for (const call of lobbyCalls) expect(call).not.toHaveBeenCalled()
    }

    test('from Doma, Play now', async () => {
        renderAt('/dashboard')
        const button = within(screen.getByRole('region', { name: 'Against bots' })).getByRole('button', { name: 'Play now' })
        const before = window.history.length
        await userEvent.setup().click(button)
        await expectTheGameAlone(before)
    })

    test('from an empty Birtija, Play against bots', async () => {
        renderAt('/lobbies')
        const button = await screen.findByRole('button', { name: 'Play against bots' })
        const before = window.history.length
        await userEvent.setup().click(button)
        await expectTheGameAlone(before)
    })

    test("signed out, the landing page's Play now, as a new guest", async () => {
        auth.isAuthenticated = false
        // as S9's: the guest's token and user are stored before it answers, and from then on this is a guest
        const startGuest = vi.spyOn(authService, 'startGuest').mockImplementation(async () => {
            jsdomStorage.setItem('authToken', 'g-tok')
            jsdomStorage.setItem('user', JSON.stringify({ id: 'g1', username: 'gost_4821', guest: true }))
            auth.isAuthenticated = true
            auth.guest = true
            return { token: 'g-tok', user: { id: 'g1', username: 'gost_4821', guest: true }, message: null }
        })
        renderAt('/')
        const button = screen.getByRole('button', { name: 'Play now' })
        const before = window.history.length
        await userEvent.setup().click(button)
        await expectTheGameAlone(before)
        expect(startGuest).toHaveBeenCalledTimes(1)
        expect(startGuest.mock.invocationCallOrder[0]).toBeLessThan(bots.startBotGame.mock.invocationCallOrder[0])
    })
})
