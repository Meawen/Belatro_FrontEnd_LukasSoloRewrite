import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClimbPanel } from './ClimbPanel'
import { useRatingHistory } from '../../hooks/useRatings'
import { ApiError } from '../../services/api'
import { LADDER, history, rank } from '../../test/fixtures/ranks'

vi.mock('../../hooks/useRatings', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../hooks/useRatings')>()),
    useRatingHistory: vi.fn(),
}))

const refetch = vi.fn().mockResolvedValue(undefined)

function answer(state: { data?: unknown; isLoading?: boolean; error?: unknown }) {
    vi.mocked(useRatingHistory).mockReturnValue({ data: null, isLoading: false, error: null, refetch, execute: vi.fn(), reset: vi.fn(), ...state } as never)
}

beforeEach(() => {
    vi.clearAllMocks()
    answer({ data: history({ rating: 1452, pace: 4.2, step: 31 }) })
})

// ranks spec §8: your climb on your own Profile
describe('ClimbPanel', () => {
    test('a section "Your climb" with the chart and the two lines (C-1)', () => {
        render(<ClimbPanel userId="u1" rank={rank('GOSPON')} ladder={LADDER} />)
        expect(screen.getByRole('heading', { level: 2, name: 'Your climb' })).toBeInTheDocument()
        expect(useRatingHistory).toHaveBeenCalledWith('u1')
        expect(screen.getByRole('group', { name: 'Your climb: rating over your ranked games' })).toBeInTheDocument()
        expect(screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'At this pace: Majster in about 36 games')).toBeInTheDocument()
        expect(screen.getByText('Majster', { selector: 'strong' })).toBeInTheDocument()
        expect(screen.getByText('Luck alone can move you about ±139 points over 20 games.')).toBeInTheDocument()
    })

    test('Kajkavac: "the top rank." and the forecast still drawn (C-4)', () => {
        answer({ data: history({ rating: 1846, pace: 3 }) })
        const { container } = render(<ClimbPanel userId="u1" rank={rank('KAJKAVAC')} ladder={LADDER} />)
        expect(screen.getByText('Kajkavac: the top rank.')).toBeInTheDocument()
        expect(container.querySelector('[data-forecast-line]')).toBeInTheDocument()
        expect(screen.queryByText(/At this pace/)).not.toBeInTheDocument()
    })

    test('placement: the count, three dots, no forecast and no luck line (C-5)', () => {
        answer({ data: history({ games: 3, rating: 1256, pace: null, paceGames: 0 }) })
        const { container } = render(<ClimbPanel userId="u1" rank={rank('CUCEK')} ladder={LADDER} />)
        expect(screen.getByText('Placement: 3 of 10 ranked games')).toBeInTheDocument()
        expect(container.querySelectorAll('[data-dot]')).toHaveLength(3)
        expect(container.querySelector('[data-forecast-line]')).toBeNull()
        expect(screen.queryByText(/^Luck alone/)).not.toBeInTheDocument()
    })

    test('no ranked games: one sentence, no chart (C-6)', () => {
        answer({ data: history({ games: 0, rating: 1200, pace: null, paceGames: 0 }) })
        render(<ClimbPanel userId="u1" rank={rank('CUCEK')} ladder={LADDER} />)
        expect(screen.getByText('Your climb starts with your first ranked game.')).toBeInTheDocument()
        expect(screen.queryByRole('group')).not.toBeInTheDocument()
    })

    test('without the ladder the bands fall back to your own rank, and the next name to "the next rank" (R-8)', () => {
        const { container } = render(<ClimbPanel userId="u1" rank={rank('GOSPON')} ladder={null} />)
        expect(container.querySelectorAll('[data-band]')).toHaveLength(1)
        expect(container.querySelector('[data-band="GOSPON"]')).toBeInTheDocument()
        expect(screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'At this pace: the next rank in about 36 games')).toBeInTheDocument()
    })

    test('loading: one line', () => {
        answer({ isLoading: true })
        render(<ClimbPanel userId="u1" rank={rank('GOSPON')} ladder={LADDER} />)
        expect(screen.getByText('Loading your climb…')).toBeInTheDocument()
    })

    test('a 404 (a backend before team Elo) renders nothing at all (C-7)', () => {
        answer({ error: new ApiError({ message: 'Not Found', status: 404 }) })
        const { container } = render(<ClimbPanel userId="u1" rank={rank('GOSPON')} ladder={LADDER} />)
        expect(container).toBeEmptyDOMElement()
    })

    test('any other failure: one quiet line and Try again (C-7)', async () => {
        answer({ error: new ApiError({ message: 'boom', status: 500 }) })
        render(<ClimbPanel userId="u1" rank={rank('GOSPON')} ladder={LADDER} />)
        expect(screen.getByText("Couldn't load your climb.")).toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
        expect(refetch).toHaveBeenCalledTimes(1)
    })
})
