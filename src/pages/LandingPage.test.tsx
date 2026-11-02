import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { LandingPage } from './LandingPage'
import { authService } from '../services/authService'
import { userService } from '../services/userService'
import { ApiError } from '../services/api'
import { setLang } from '../i18n/lang'
import { LONG_NAMES } from '../dev/devTable'

// One switch per test: signed out (the default) or a guest, the guest's name and its stored token
const auth = vi.hoisted(() => ({ signedIn: 'out' as 'out' | 'guest', username: 'gost_4821', token: 'tok-g' }))
vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({
        user: auth.signedIn === 'guest' ? { id: 'g1', username: auth.username, guest: true } : null,
        isAuthenticated: auth.signedIn === 'guest',
        isGuest: auth.signedIn === 'guest',
        isLoading: false,
        token: auth.signedIn === 'guest' ? auth.token : null,
    }),
}))
// The one-click bot game (spec §6): its request is botGame.test's; here a stub
const bots = vi.hoisted(() => ({ startBotGame: vi.fn() }))
vi.mock('../services/botGame', () => ({ startBotGame: bots.startBotGame }))

const GUEST = { id: 'g1', username: 'gost_4821', guest: true }

/** A guest whose token (stored, as S8's startGuest stores it) is the switch's. */
function asGuest(token = auth.token) {
    auth.signedIn = 'guest'
    auth.token = token
    localStorage.setItem('authToken', token)
    localStorage.setItem('user', JSON.stringify({ ...GUEST, username: auth.username }))
}

/** Where a door or a button led. */
function Where() {
    const { pathname, search } = useLocation()
    return <p>at {pathname + search}</p>
}

function renderLanding(path = '/') {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/learn" element={<Where />} />
                <Route path="/signup" element={<Where />} />
                <Route path="/login" element={<Where />} />
                <Route path="/game/:gameId" element={<Where />} />
            </Routes>
        </MemoryRouter>,
    )
}

/** Lets pending answers land. */
async function settle() {
    await act(async () => {})
}

const unavailable = () => new ApiError({ status: 503, message: 'Service Unavailable' })

beforeEach(() => {
    auth.signedIn = 'out'
    auth.username = 'gost_4821'
    auth.token = 'tok-g'
    bots.startBotGame.mockReset()
    // as S8's: the guest's token and user are stored before it answers
    vi.spyOn(authService, 'startGuest').mockImplementation(async () => {
        localStorage.setItem('authToken', 'g-new')
        localStorage.setItem('user', JSON.stringify(GUEST))
        return { token: 'g-new', user: GUEST, message: null }
    })
    vi.spyOn(authService, 'renameGuest').mockResolvedValue({ token: 'n', user: GUEST, message: null })
    vi.spyOn(userService, 'getMe').mockImplementation(async () => ({
        id: 'g1', username: auth.username, email: null, pendingEmail: null, emailVerified: false, roles: ['ROLE_GUEST'], deletionRequested: false, guest: true,
    }) as never)
    vi.spyOn(userService, 'getActiveGame').mockResolvedValue(null)
    vi.spyOn(userService, 'getUserById').mockRejectedValue(new ApiError({ status: 403, message: 'Forbidden' }))
})
afterEach(() => {
    vi.restoreAllMocks()
    setLang('en')
})

describe('The landing page (spec §4, option C)', () => {
    test('signed out: a headline and its line, a small table of four cards, three doors, Teach me the one primary action (spec §4, §8)', async () => {
        renderLanding()
        await settle()
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
        expect(screen.getByRole('heading', { level: 1, name: 'Belot for four, online.' })).toBeInTheDocument()
        expect(screen.getByText('Your table is ready: three bots are waiting, or bring your crew.')).toBeInTheDocument()
        const table = screen.getByTestId('landing-table')
        expect(table).toHaveAttribute('aria-hidden', 'true')
        expect(table.querySelectorAll('.ui-card')).toHaveLength(4)
        expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Bela school', 'Bots', 'People'])
        const doors = screen.getByRole('region', { name: 'Ways to start' })
        const primary = doors.querySelectorAll('.ui-btn--primary')
        expect(primary).toHaveLength(1)
        expect(primary[0]).toHaveTextContent('Teach me')
        expect(screen.getByRole('group', { name: 'Site language' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
        const footer = screen.getByRole('contentinfo')
        for (const name of ['Rules', 'Privacy', 'Terms']) expect(within(footer).getByRole('link', { name })).toBeInTheDocument()
        expect(document.title).toBe('Belot for four, online · Stiglja')
    })

    test('Teach me opens /learn, Sign up opens /signup, Sign in opens /login', async () => {
        const user = userEvent.setup()
        for (const [name, role, path] of [
            ['Teach me', 'button', '/learn'],
            ['Sign up', 'button', '/signup'],
            ['Sign in', 'link', '/login'],
        ] as const) {
            const { unmount } = renderLanding()
            await user.click(screen.getByRole(role, { name }))
            expect(screen.getByText(`at ${path}`), name).toBeInTheDocument()
            unmount()
        }
    })

    test("Play now makes this visitor a guest in the site's language, then starts a game against three bots and opens it (spec §6)", async () => {
        bots.startBotGame.mockResolvedValue({ gameId: 'g7', lobbyId: 'l7' })
        renderLanding()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Play now' }))
        expect(await screen.findByText('at /game/g7')).toBeInTheDocument()
        expect(authService.startGuest).toHaveBeenCalledTimes(1)
        expect(authService.startGuest).toHaveBeenCalledWith('en')
        expect(vi.mocked(authService.startGuest).mock.invocationCallOrder[0]).toBeLessThan(bots.startBotGame.mock.invocationCallOrder[0])
    })

    test("a game that can't start says why in the site's language, and the doors stay (spec §8)", async () => {
        const user = userEvent.setup()
        vi.mocked(authService.startGuest).mockRejectedValueOnce(
            new ApiError({ status: 429, message: 'Too many requests, try again later', code: 'RATE_LIMITED' }),
        )
        bots.startBotGame.mockRejectedValue(unavailable())
        renderLanding()
        await user.click(screen.getByRole('button', { name: 'Play now' }))
        expect(await screen.findByText('Too many tries. Wait a little, then try again.')).toBeInTheDocument()
        expect(bots.startBotGame).not.toHaveBeenCalled()

        await user.click(screen.getByRole('button', { name: 'Play now' }))
        expect(await screen.findByText("Bots aren't available right now. Try again later.")).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Play now' })).toBeEnabled()
        expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(expect.arrayContaining(['Bela school', 'Bots', 'People']))
        expect(within(screen.getByRole('region', { name: 'Ways to start' })).getAllByRole('listitem')).toHaveLength(3)

        act(() => setLang('hr'))
        await user.click(screen.getByRole('button', { name: 'Igraj odmah' }))
        expect(await screen.findByText('Botovi trenutno nisu dostupni. Pokušaj malo kasnije.')).toBeInTheDocument()
    })

    test("a new guest's panel waits until the game fails to start: no flash above the doors while it starts (Ruling 48)", async () => {
        let answer: (started: { gameId: string; lobbyId: string }) => void = () => {}
        bots.startBotGame.mockImplementation(() => new Promise((resolve) => (answer = resolve)))
        renderLanding()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Play now' }))
        await vi.waitFor(() => expect(bots.startBotGame).toHaveBeenCalledTimes(1))
        await settle()
        expect(authService.startGuest).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('region', { name: 'Continue as gost_4821' })).not.toBeInTheDocument()
        await act(async () => answer({ gameId: 'g7', lobbyId: 'l7' }))
        expect(await screen.findByText('at /game/g7')).toBeInTheDocument()
    })

    test('a visitor made a guest whose game then failed is not made a guest again', async () => {
        const user = userEvent.setup()
        bots.startBotGame.mockRejectedValueOnce(unavailable()).mockResolvedValueOnce({ gameId: 'g7', lobbyId: 'l7' })
        renderLanding()
        await user.click(screen.getByRole('button', { name: 'Play now' }))
        expect(await screen.findByRole('heading', { level: 2, name: 'Continue as gost_4821' })).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Play now' }))
        expect(await screen.findByText('at /game/g7')).toBeInTheDocument()
        expect(authService.startGuest).toHaveBeenCalledTimes(1)
        expect(bots.startBotGame).toHaveBeenCalledTimes(2)
    })

    test('a returning guest: Continue as their name, and Play now plays as them, no new guest (spec §4)', async () => {
        asGuest()
        bots.startBotGame.mockResolvedValue({ gameId: 'g7', lobbyId: 'l7' })
        renderLanding()
        expect(await screen.findByRole('heading', { level: 2, name: 'Continue as gost_4821' })).toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Play now' }))
        expect(await screen.findByText('at /game/g7')).toBeInTheDocument()
        expect(authService.startGuest).not.toHaveBeenCalled()
        expect(bots.startBotGame).toHaveBeenCalledTimes(1)
    })

    test("a returning guest with a game running gets Return to your game, the panel's one primary action", async () => {
        asGuest()
        vi.mocked(userService.getActiveGame).mockResolvedValue('g3')
        renderLanding()
        const panel = await screen.findByRole('region', { name: 'Continue as gost_4821' })
        expect(await within(panel).findByRole('button', { name: 'Return to your game' })).toBeInTheDocument()
        const primary = panel.querySelectorAll('.ui-btn--primary')
        expect(primary).toHaveLength(1)
        expect(primary[0]).toHaveTextContent('Return to your game')
        expect(panel).toHaveTextContent('You have a game in progress.')
        await userEvent.setup().click(within(panel).getByRole('button', { name: 'Return to your game' }))
        expect(screen.getByText('at /game/g3')).toBeInTheDocument()
    })

    test("the rename sheet changes the guest's name, checked first by the username rule (Ruling 35: as NFC)", async () => {
        asGuest()
        vi.mocked(authService.renameGuest).mockResolvedValue({ token: 'n', user: { id: 'g1', username: 'matič', guest: true }, message: null })
        const user = userEvent.setup()
        renderLanding()
        await settle()
        await user.click(screen.getByRole('button', { name: 'Change name' }))
        const dialog = screen.getByRole('dialog', { name: 'Change your guest name' })
        const field = within(dialog).getByLabelText('Username')
        expect(field).toHaveValue('gost_4821')

        await user.clear(field)
        await user.type(field, 'ab')
        await user.click(within(dialog).getByRole('button', { name: 'Save' }))
        expect(within(dialog).getByText('Username must be 3–20 characters: letters (including č ć š ž đ), digits or _')).toBeInTheDocument()
        expect(authService.renameGuest).not.toHaveBeenCalled()

        // a decomposed č: c followed by a combining caron
        await user.clear(field)
        await user.click(field)
        await user.paste('Matic\u030C')
        expect(field).toHaveValue('Matic\u030C')
        await user.click(within(dialog).getByRole('button', { name: 'Save' }))
        expect(authService.renameGuest).toHaveBeenCalledWith('Mati\u010D')
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Change your guest name' })).not.toBeInTheDocument())
        expect(screen.getByRole('heading', { level: 2, name: 'Continue as matič' })).toBeInTheDocument()
    })

    test('a refused rename says why and keeps the sheet open', async () => {
        asGuest()
        vi.mocked(authService.renameGuest)
            .mockRejectedValueOnce(new ApiError({ status: 409, message: "You can't change your name while at a table or in a game", code: 'IN_GAME' }))
            .mockRejectedValueOnce(new ApiError({ status: 409, message: 'Username is already taken', code: 'USERNAME_TAKEN' }))
            .mockRejectedValueOnce(unavailable())
        const user = userEvent.setup()
        renderLanding()
        await settle()
        await user.click(screen.getByRole('button', { name: 'Change name' }))
        const dialog = screen.getByRole('dialog', { name: 'Change your guest name' })
        const field = within(dialog).getByLabelText('Username')
        await user.clear(field)
        await user.type(field, 'jura_k')
        for (const line of [
            "You can't change your name while you're at a table or in a game. Leave the table or finish the game, then try again.",
            'Username is already taken. Names that differ only in capitals or in the marks on č ć š ž đ count as the same name. Choose another one.',
            "Your name wasn't changed. Try again in a moment.",
        ]) {
            await user.click(within(dialog).getByRole('button', { name: 'Save' }))
            expect(await within(dialog).findByText(line)).toBeInTheDocument()
            expect(screen.getByRole('dialog', { name: 'Change your guest name' })).toBeInTheDocument()
        }
        expect(authService.renameGuest).toHaveBeenCalledTimes(3)
    })

    test('Ruling 7: after a guest session ended, a line above the doors says so', async () => {
        const { unmount } = renderLanding('/?reason=guest-ended')
        await settle()
        const ended = screen.getByRole('region', { name: 'Guest session ended' })
        expect(ended).toHaveTextContent('Your guest session has ended. Choose below how to start again.')
        const doors = screen.getByRole('region', { name: 'Ways to start' })
        expect(ended.compareDocumentPosition(doors) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        unmount()
        renderLanding()
        await settle()
        expect(screen.queryByRole('region', { name: 'Guest session ended' })).not.toBeInTheDocument()
    })

    test("an expired guest token: the landing sends nothing with it (S8's resume goes first)", async () => {
        // a JWT whose exp passed an hour ago (the SPA reads exp without checking the signature)
        const claims = btoa(JSON.stringify({ sub: 'gost_4821', exp: Math.floor(Date.now() / 1000) - 3600 })).replace(/=+$/, '')
        asGuest(`eyJhbGciOiJIUzI1NiJ9.${claims}.signature`)
        renderLanding()
        await settle()
        expect(userService.getMe).not.toHaveBeenCalled()
        expect(userService.getActiveGame).not.toHaveBeenCalled()
        expect(screen.getByRole('heading', { level: 2, name: 'Continue as gost_4821' })).toBeInTheDocument()
    })

    test("a returning guest's landing asks GET /user/me, never GET /user/{own id} (B4)", async () => {
        asGuest()
        renderLanding()
        await settle()
        expect(userService.getMe).toHaveBeenCalled()
        expect(userService.getUserById).not.toHaveBeenCalled()
    })

    test('in Croatian (§1.4)', async () => {
        setLang('hr')
        const { unmount } = renderLanding('/?reason=guest-ended')
        await settle()
        expect(screen.getByRole('heading', { level: 1, name: 'Bela za četvero, online.' })).toBeInTheDocument()
        expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Škola bele', 'Botovi', 'Ljudi'])
        const doors = screen.getByRole('region', { name: 'Kako početi' })
        expect(within(doors).getAllByRole('button').map((b) => b.textContent)).toEqual(['Navči me', 'Igraj odmah', 'Registriraj se'])
        expect(screen.getByRole('link', { name: 'Prijava' })).toHaveAttribute('href', '/login')
        expect(screen.getByRole('region', { name: 'Sesija gosta je završila' })).toHaveTextContent(
            'Tvoja sesija gosta je završila. Odaberi ispod kako ćeš krenuti ispočetka.',
        )
        expect(document.title).toBe('Bela za četvero, online · Stiglja')
        unmount()

        asGuest()
        renderLanding()
        expect(await screen.findByRole('heading', { level: 2, name: 'Nastavi kao gost_4821' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Promijeni ime' })).toBeInTheDocument()
    })

    test('a 20-character name wraps instead of widening the panel (long names fit)', async () => {
        auth.username = LONG_NAMES.dave
        asGuest()
        renderLanding()
        const heading = await screen.findByRole('heading', { level: 2, name: `Continue as ${LONG_NAMES.dave}` })
        expect(heading).toHaveClass('break-words')
        expect(heading.parentElement).toHaveClass('min-w-0')
    })

    test("Play now refused by the bot game's own limit (429) or with no answer: the line, and Play now again (spec §8)", async () => {
        const user = userEvent.setup()
        asGuest()
        bots.startBotGame
            .mockRejectedValueOnce(new ApiError({ status: 429, message: 'Too many requests, try again later', code: 'RATE_LIMITED' }))
            .mockRejectedValueOnce(new ApiError({ status: 0, message: 'Failed to fetch' }))
        renderLanding()
        await settle()
        for (const line of ['Too many tries. Wait a little, then try again.', "Bots aren't available right now. Try again later."]) {
            await user.click(screen.getByRole('button', { name: 'Play now' }))
            expect(await screen.findByText(line)).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Play now' })).toBeEnabled()
        }
        expect(authService.startGuest).not.toHaveBeenCalled()
    })

    test('Play now refused with ALREADY_IN_GAME says so and looks for the running game at once', async () => {
        asGuest()
        vi.mocked(userService.getActiveGame).mockResolvedValueOnce(null).mockResolvedValue('g4')
        bots.startBotGame.mockRejectedValue(new ApiError({ status: 409, message: 'You already have a game in progress', code: 'ALREADY_IN_GAME' }))
        renderLanding()
        await settle()
        expect(screen.queryByRole('button', { name: 'Return to your game' })).not.toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Play now' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('You already have a game in progress. Go back to it first.')
        expect(await screen.findByRole('button', { name: 'Return to your game' })).toBeInTheDocument()
        expect(userService.getActiveGame).toHaveBeenCalledTimes(2)
    })
})
