import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { ActiveGameBanner, ACTIVE_GAME_POLL_MS } from './ActiveGameBanner'
import { userService } from '../../services/userService'

const auth = vi.hoisted(() => ({ isAuthenticated: true }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: auth.isAuthenticated }) }))
vi.mock('../../services/userService', () => ({ userService: { getActiveGame: vi.fn() } }))

function GamePage() {
    const { gameId } = useParams()
    return <><h1>Game {gameId}</h1><Link to="/dashboard">Dashboard</Link></>
}

/** The banner as AppLayout renders it: above whatever page the route shows. */
function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <ActiveGameBanner />
            <Routes>
                <Route path="/profile" element={<Link to="/friends">Friends</Link>} />
                <Route path="/friends" element={<h1>Friends page</h1>} />
                <Route path="/game/:gameId" element={<GamePage />} />
                <Route path="/dashboard" element={<h1>Dashboard page</h1>} />
            </Routes>
        </MemoryRouter>,
    )
}

/** Lets a pending getActiveGame answer land. */
async function settle() {
    await act(async () => {})
}

beforeEach(() => {
    vi.clearAllMocks()
    auth.isAuthenticated = true
})
afterEach(() => vi.useRealTimers())

describe('ActiveGameBanner (R-33)', () => {
    test('on /profile a seat in a running game shows the banner, and it leads to the game', async () => {
        vi.mocked(userService.getActiveGame).mockResolvedValue('g1')
        renderAt('/profile')
        await userEvent.setup().click(await screen.findByRole('button', { name: 'Return to your game' }))
        expect(screen.getByRole('heading', { name: 'Game g1' })).toBeInTheDocument()
        // the game page itself shows no banner
        expect(screen.queryByRole('button', { name: 'Return to your game' })).not.toBeInTheDocument()
    })

    test('signed out: no request and no banner', async () => {
        auth.isAuthenticated = false
        renderAt('/profile')
        await settle()
        expect(userService.getActiveGame).not.toHaveBeenCalled()
        expect(screen.queryByRole('region', { name: 'Game in progress' })).not.toBeInTheDocument()
    })

    test('a 204 on the next 30-s check hides the banner', async () => {
        vi.useFakeTimers()
        vi.mocked(userService.getActiveGame).mockResolvedValueOnce('g1').mockResolvedValue(null)
        renderAt('/profile')
        await settle()
        expect(screen.getByRole('button', { name: 'Return to your game' })).toBeInTheDocument()
        await act(async () => {
            await vi.advanceTimersByTimeAsync(ACTIVE_GAME_POLL_MS)
        })
        expect(userService.getActiveGame).toHaveBeenCalledTimes(2)
        expect(screen.queryByRole('button', { name: 'Return to your game' })).not.toBeInTheDocument()
    })

    test('checks again on every navigation', async () => {
        vi.mocked(userService.getActiveGame).mockResolvedValue(null)
        renderAt('/profile')
        await settle()
        await userEvent.setup().click(screen.getByRole('link', { name: 'Friends' }))
        await settle()
        expect(screen.getByRole('heading', { name: 'Friends page' })).toBeInTheDocument()
        expect(userService.getActiveGame).toHaveBeenCalledTimes(2)
    })

    test('leaving the game page shows no banner for that game until the next check answers', async () => {
        vi.mocked(userService.getActiveGame).mockResolvedValueOnce('g1').mockReturnValue(new Promise<string | null>(() => {}))
        renderAt('/profile')
        const user = userEvent.setup()
        await user.click(await screen.findByRole('button', { name: 'Return to your game' }))
        // the game ends; the player leaves for the dashboard, whose check has not answered yet
        await user.click(screen.getByRole('link', { name: 'Dashboard' }))
        await settle()
        expect(screen.getByRole('heading', { name: 'Dashboard page' })).toBeInTheDocument()
        expect(userService.getActiveGame).toHaveBeenCalledTimes(2)
        expect(screen.queryByRole('button', { name: 'Return to your game' })).not.toBeInTheDocument()
    })

    test('on the game page: no request', async () => {
        renderAt('/game/g1')
        await settle()
        expect(userService.getActiveGame).not.toHaveBeenCalled()
    })
})
