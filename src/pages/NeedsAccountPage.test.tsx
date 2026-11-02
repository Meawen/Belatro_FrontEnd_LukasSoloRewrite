import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { NeedsAccountPage, type LockedArea } from './NeedsAccountPage'
import { ApiError } from '../services/api'
import { setLang } from '../i18n/lang'

const bots = vi.hoisted(() => ({ startBotGame: vi.fn() }))
vi.mock('../services/botGame', () => ({ startBotGame: bots.startBotGame }))
// Ruling 6: the sign-up door's label reads GET /api/auth/signup-status; its request is betaService.test's
const beta = vi.hoisted(() => ({ signupStatus: vi.fn() }))
vi.mock('../services/betaService', () => ({ betaService: beta }))

/** Where the router is, and the state it carries. */
function Where() {
    const { pathname, state } = useLocation()
    return <p data-testid="where">{`${pathname} ${JSON.stringify(state)}`}</p>
}

function renderArea(area: LockedArea, path = '/friends') {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path={path} element={<NeedsAccountPage area={area} />} />
                <Route path="/signup" element={<><h1>Sign-up form</h1><Where /></>} />
                <Route path="/game/:gameId" element={<><h1>The game</h1><Where /></>} />
            </Routes>
        </MemoryRouter>,
    )
}

beforeEach(() => {
    bots.startBotGame.mockReset()
    beta.signupStatus.mockReset()
    // still asking: the door reads Sign up, as when signup is open; a test that needs an answer sets one
    beta.signupStatus.mockReturnValue(new Promise(() => {}))
})
afterEach(() => setLang('en'))

describe('NeedsAccountPage (spec §3.3, §8)', () => {
    test('names the area, says what it is and that a free account unlocks it, with one primary action (spec §8)', () => {
        const { container } = renderArea('friends')
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Friends$/)
        expect(screen.getByText('This needs an account')).toBeInTheDocument()
        const body = screen.getByText(/The players you add as friends/)
        expect(body).toHaveTextContent('The players you add as friends, and the requests they send you.')
        expect(body).toHaveTextContent("A free account unlocks it. As a guest you can already play against bots, or sit at a friend's table from the link they send you.")
        expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Sign up', 'Play against bots as a guest'])
        const primary = container.querySelectorAll('.ui-btn--primary')
        expect(primary).toHaveLength(1)
        expect(primary[0]).toHaveTextContent('Sign up')
        expect(document.title).toBe('Friends · Stiglja')
    })

    test('in Croatian (§1.4, §7.4)', () => {
        setLang('hr')
        renderArea('ranked', '/play')
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Rangirano$/)
        expect(screen.getByText('Za ovo ti treba račun')).toBeInTheDocument()
        expect(screen.getByText(/Rangirane partije protiv ljudi, s rejtingom i rangom koji rastu kad pobjeđuješ\./)).toBeInTheDocument()
        expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Registriraj se', 'Igraj protiv botova kao gost'])
        expect(document.title).toBe('Rangirano · Stiglja')
    })

    test('Settings keeps its language section, which a guest may use (spec §3.3)', () => {
        const { unmount } = renderArea('settings', '/settings')
        expect(screen.getByRole('heading', { level: 2, name: 'Language' })).toBeInTheDocument()
        unmount()
        renderArea('friends')
        expect(screen.queryByRole('heading', { level: 2, name: 'Language' })).not.toBeInTheDocument()
    })

    test('Sign up goes to /signup, carrying this page so signing up comes back to it', async () => {
        renderArea('friends')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Sign up' }))
        expect(screen.getByRole('heading', { name: 'Sign-up form' })).toBeInTheDocument()
        expect(screen.getByTestId('where')).toHaveTextContent('/signup {"from":"/friends"}')
    })

    test('while signup is full the door reads Waitlist, and still opens /signup (Ruling 6)', async () => {
        beta.signupStatus.mockResolvedValueOnce({ open: true })
        const open = renderArea('friends')
        await act(async () => {})
        expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument()
        open.unmount()

        beta.signupStatus.mockResolvedValue({ open: false })
        const { container, unmount } = renderArea('friends')
        expect(await screen.findByRole('button', { name: 'Waitlist' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Sign up' })).not.toBeInTheDocument()
        const primary = container.querySelectorAll('.ui-btn--primary')
        expect(primary).toHaveLength(1)
        expect(primary[0]).toHaveTextContent('Waitlist')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Waitlist' }))
        expect(screen.getByRole('heading', { name: 'Sign-up form' })).toBeInTheDocument()
        expect(screen.getByTestId('where')).toHaveTextContent('/signup {"from":"/friends"}')
        // once per mount: the open page's and this one's
        expect(beta.signupStatus).toHaveBeenCalledTimes(2)
        unmount()

        setLang('hr')
        const hr = renderArea('friends')
        expect(await screen.findByRole('button', { name: 'Red za stol' })).toBeInTheDocument()
        // gone before the language is reset after the test
        hr.unmount()
    })

    test('the bot button starts a game against three bots and opens it (spec §6)', async () => {
        bots.startBotGame.mockResolvedValue({ gameId: 'g7', lobbyId: 'l7' })
        renderArea('tables', '/lobbies')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Play against bots as a guest' }))
        expect(await screen.findByRole('heading', { name: 'The game' })).toBeInTheDocument()
        expect(screen.getByTestId('where')).toHaveTextContent(/^\/game\/g7 /)
        expect(bots.startBotGame).toHaveBeenCalledTimes(1)
    })

    test("a bot game that can't start says why and what to do, in the site's language (spec §8)", async () => {
        const user = userEvent.setup()
        const button = () => screen.getByRole('button', { name: /Play against bots as a guest|Igraj protiv botova kao gost/ })

        bots.startBotGame.mockRejectedValueOnce(new ApiError({ message: 'Too many requests, try again later', status: 429, code: 'RATE_LIMITED' }))
        const { unmount } = renderArea('friends')
        await user.click(button())
        expect(await screen.findByRole('alert')).toHaveTextContent('Too many tries. Wait a little, then try again.')
        expect(button()).toBeEnabled()

        bots.startBotGame.mockRejectedValueOnce(new ApiError({ message: 'Service Unavailable', status: 503 }))
        await user.click(button())
        expect(await screen.findByText("Bots aren't available right now. Try again later.")).toBeInTheDocument()
        expect(button()).toBeEnabled()
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Friends$/)
        unmount()

        setLang('hr')
        bots.startBotGame.mockRejectedValueOnce(new ApiError({ message: 'Service Unavailable', status: 503 }))
        renderArea('friends')
        await user.click(button())
        expect(within(await screen.findByRole('alert')).getByText('Botovi trenutno nisu dostupni. Pokušaj malo kasnije.')).toBeInTheDocument()
        expect(button()).toBeEnabled()
    })

    test("a bot game refused with ALREADY_IN_GAME, or with no answer, says so; the way back to the game is the shell's banner", async () => {
        const user = userEvent.setup()
        const button = () => screen.getByRole('button', { name: 'Play against bots as a guest' })
        bots.startBotGame
            .mockRejectedValueOnce(new ApiError({ message: 'You already have a game in progress', status: 409, code: 'ALREADY_IN_GAME' }))
            .mockRejectedValueOnce(new ApiError({ message: 'Failed to fetch', status: 0 }))
        renderArea('friends')
        for (const line of ['You already have a game in progress. Go back to it first.', "Bots aren't available right now. Try again later."]) {
            await user.click(button())
            expect(await screen.findByText(line)).toBeInTheDocument()
            expect(button()).toBeEnabled()
        }
    })
})
