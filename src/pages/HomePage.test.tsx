import { describe, test, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { HomePage } from './HomePage'
import { useUser } from '../hooks/useUser'

// Tailwind's own colour scale (bg-amber-600, text-emerald-950, …): the design uses tokens only (spec §3.2)
const RAW_PALETTE = /\b(?:bg|text|border|from|to|via)-(?:amber|emerald|slate|red|purple|gray|blue|yellow|green|orange|teal|lime|pink)-\d/

vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'u1', username: 'ana' }, isAuthenticated: true, isLoading: false, token: 'tok-1' }),
}))
// The player's numbers come from GET /user/{id} through useUser
vi.mock('../hooks/useUser', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../hooks/useUser')>()),
    useUser: vi.fn(),
}))

/** Where a button or link led. */
function Where() {
    const { pathname, search } = useLocation()
    return <p>at {pathname + search}</p>
}

function renderHome() {
    return render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
                <Route path="/dashboard" element={<HomePage />} />
                <Route path="*" element={<Where />} />
            </Routes>
        </MemoryRouter>,
    )
}

/** Lets pending answers land. */
async function settle() {
    await act(async () => {})
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useUser).mockReturnValue({
        user: { id: 'u1', username: 'ana', eloRating: 1450, level: 0, gamesPlayed: 42 },
        isLoading: false, error: null, refetch: vi.fn(),
    } as never)
})

describe('Home (spec §4.4; D-26)', () => {
    test('greets the player in the page’s only h1, and the tab is titled Home', async () => {
        renderHome()
        await settle()
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
        expect(screen.getByRole('heading', { level: 1, name: 'Hi, ana' })).toBeInTheDocument()
        expect(document.title).toBe('Home · Stiglja')
    })

    test('"Play ranked" shows the player’s Elo and leads to /play', async () => {
        renderHome()
        await settle()
        const play = screen.getByRole('button', { name: 'Play ranked' })
        expect(within(play.closest('section') as HTMLElement).getByText('1450')).toBeInTheDocument()
        await userEvent.setup().click(play)
        expect(screen.getByText('at /play')).toBeInTheDocument()
    })

    test('Lobbies: "Open lobbies" leads to /lobbies, "Create lobby" opens the create sheet there', async () => {
        const user = userEvent.setup()
        const { unmount } = renderHome()
        await settle()
        await user.click(screen.getByRole('button', { name: 'Open lobbies' }))
        expect(screen.getByText('at /lobbies')).toBeInTheDocument()
        unmount()
        renderHome()
        await settle()
        await user.click(screen.getByRole('button', { name: 'Create lobby' }))
        expect(screen.getByText('at /lobbies?create=1')).toBeInTheDocument()
    })

    test('the stats strip is Elo, Games and Level; nothing on Home uses the raw palette', async () => {
        const { container } = renderHome()
        await settle()
        const strip = screen.getByTestId('dashboard-elo').closest('dl') as HTMLElement
        expect(within(strip).getAllByRole('term').map((term) => term.textContent)).toEqual(['Elo', 'Games', 'Level'])
        expect(container.innerHTML).not.toMatch(RAW_PALETTE)
    })
})
