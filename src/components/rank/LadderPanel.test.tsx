import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LadderPanel } from './LadderPanel'
import { useLadder } from '../../hooks/useRatings'
import { useUser } from '../../hooks/useUser'
import { ApiError } from '../../services/api'
import { userService } from '../../services/userService'
import { act } from '@testing-library/react'
import { FEW_LADDER, LADDER, rankedUser } from '../../test/fixtures/ranks'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana_k' }, isAuthenticated: true }) }))
vi.mock('../../hooks/useUser', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../hooks/useUser')>()),
    useUser: vi.fn(),
}))
vi.mock('../../hooks/useRatings', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../hooks/useRatings')>()),
    useLadder: vi.fn(),
}))

const refetch = vi.fn().mockResolvedValue(undefined)

function ladder(state: { data?: unknown; isLoading?: boolean; error?: unknown }) {
    vi.mocked(useLadder).mockReturnValue({ data: null, isLoading: false, error: null, refetch, execute: vi.fn(), reset: vi.fn(), ...state } as never)
}

function me(user: unknown) {
    vi.mocked(useUser).mockReturnValue({ user, isLoading: false, error: null, refetch: vi.fn() } as never)
}

beforeEach(() => {
    vi.clearAllMocks()
    ladder({ data: LADDER })
    me(rankedUser({ key: 'PAJDAS', eloRating: 1290 }))
})

// ranks spec §7: the ladder panel above the leaderboard
describe('LadderPanel', () => {
    test('placed: the title, the count, the chart with you marked, your place and the legend (spec L-1)', () => {
        render(<LadderPanel />)
        expect(screen.getByRole('heading', { level: 2, name: 'The ladder' })).toBeInTheDocument()
        expect(screen.getByText('412 ranked players')).toBeInTheDocument()
        expect(screen.getByRole('group', { name: 'The ladder: players by rating' })).toBeInTheDocument()
        expect(screen.getByText('You')).toBeInTheDocument()
        expect(screen.getByText('Ahead of 49% of ranked players')).toBeInTheDocument()
        const legend = screen.getByRole('list', { name: 'Players per rank' })
        const items = within(legend).getAllByRole('listitem')
        expect(items.map((item) => item.textContent)).toEqual(['Dečec31', 'Fakin149', 'Pajdaš106', 'Gospon90', 'Majster36', 'Kajkavac0'])
        expect(within(items[3]).getByText('Gospon').closest('.ui-tag')).toHaveClass('bg-rank-gospon')
        expect(screen.getByText('37 players still placing')).toBeInTheDocument()
    })

    test.each([[3, 'Play 7 more ranked games to join the ladder.'], [9, 'Play 1 more ranked game to join the ladder.']])('in placement with %i ranked games: no marker, "%s"', (games, line) => {
        me(rankedUser({ key: 'CUCEK', eloRating: 1236, rankedGamesPlayed: games }))
        render(<LadderPanel />)
        expect(screen.queryByText('You')).not.toBeInTheDocument()
        expect(screen.getByText(line)).toBeInTheDocument()
        expect(screen.queryByText(/^Ahead of/)).not.toBeInTheDocument()
    })

    test('your profile without a rank (it has not loaded, or an old summary): no marker, no line', () => {
        me({ id: 'u1', username: 'ana_k', eloRating: 1290, level: 3, gamesPlayed: 42 })
        render(<LadderPanel />)
        expect(screen.queryByText('You')).not.toBeInTheDocument()
        expect(screen.queryByText(/^Ahead of|^Play \d/)).not.toBeInTheDocument()
    })

    test('fewer than 5 placed players: the empty sentence, no chart (spec L-3)', () => {
        ladder({ data: FEW_LADDER })
        render(<LadderPanel />)
        expect(screen.getByText('The ladder fills in as players finish their first 10 ranked games.')).toBeInTheDocument()
        expect(screen.queryByRole('group')).not.toBeInTheDocument()
        expect(screen.getByText('4 ranked players')).toBeInTheDocument()
    })

    test('one of each reads in the singular', () => {
        ladder({ data: { ...FEW_LADDER, players: 1, ranks: FEW_LADDER.ranks.map((r) => ({ ...r, count: r.key === 'CUCEK' ? 1 : r.count })) } })
        render(<LadderPanel />)
        expect(screen.getByText('1 ranked player')).toBeInTheDocument()
    })

    test('"1 player still placing", and nothing when none are', () => {
        ladder({ data: { ...LADDER, ranks: LADDER.ranks.map((r) => (r.key === 'CUCEK' ? { ...r, count: 1 } : r)) } })
        const { unmount } = render(<LadderPanel />)
        expect(screen.getByText('1 player still placing')).toBeInTheDocument()
        unmount()
        ladder({ data: { ...LADDER, ranks: LADDER.ranks.map((r) => (r.key === 'CUCEK' ? { ...r, count: 0 } : r)) } })
        render(<LadderPanel />)
        expect(screen.queryByText(/still placing/)).not.toBeInTheDocument()
    })

    test('loading: one line', () => {
        ladder({ isLoading: true })
        render(<LadderPanel />)
        expect(screen.getByText('Loading the ladder…')).toBeInTheDocument()
    })

    test('a refetch keeps the chart, dimmed, until the answer lands (no skeleton)', () => {
        ladder({ data: LADDER, isLoading: true })
        render(<LadderPanel />)
        expect(screen.getByRole('group', { name: 'The ladder: players by rating' }).closest('[data-holding]')).toHaveClass('opacity-60')
    })

    test('a 404 (a backend before team Elo) renders nothing at all (spec L-4)', () => {
        ladder({ error: new ApiError({ message: 'Not Found', status: 404 }) })
        const { container } = render(<LadderPanel />)
        expect(container).toBeEmptyDOMElement()
    })

    test('any other failure: one quiet line and Try again, which asks again (spec L-4)', async () => {
        ladder({ error: new ApiError({ message: 'boom', status: 500 }) })
        render(<LadderPanel />)
        expect(screen.getByText("Couldn't load the ladder.")).toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
        expect(refetch).toHaveBeenCalledTimes(1)
    })
})

// Final review, Important 1, with the real hook: no flash of the panel when the tab comes back
describe('LadderPanel on a backend before team Elo', () => {
    test('stays empty when the tab comes back into view, and asks once', async () => {
        const actual = await vi.importActual<typeof import('../../hooks/useRatings')>('../../hooks/useRatings')
        vi.mocked(useLadder).mockImplementation(actual.useLadder)
        const getLadder = vi.spyOn(userService, 'getLadder').mockRejectedValue(new ApiError({ message: 'Not Found', status: 404 }))
        vi.useFakeTimers({ toFake: ['Date'] })
        try {
            const { container } = render(<LadderPanel />)
            await act(async () => {})
            expect(container).toBeEmptyDOMElement()
            vi.setSystemTime(Date.now() + actual.RATINGS_STALE_MS * 10)
            Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
            act(() => { document.dispatchEvent(new Event('visibilitychange')) })
            expect(container).toBeEmptyDOMElement()
            await act(async () => {})
            expect(container).toBeEmptyDOMElement()
            expect(getLadder).toHaveBeenCalledTimes(1)
        } finally {
            vi.useRealTimers()
            getLadder.mockRestore()
            delete (document as { visibilityState?: unknown }).visibilityState
        }
    })
})
