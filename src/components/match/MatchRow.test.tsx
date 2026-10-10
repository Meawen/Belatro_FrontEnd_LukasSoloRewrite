import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { MatchRow } from './MatchRow'
import { matchOutcome, outcomeWord, relativeMatchDate } from './matchOutcome'
import type { PlayerMatchSummaryDTO } from '../../types/user'

// Tailwind's own colour scale (bg-emerald-900, text-red-300, …): the design uses tokens only (spec §3.2)
const RAW_PALETTE = /\b(?:bg|text|border|from|to|via)-(?:amber|emerald|slate|red|purple|gray|blue|yellow|green|orange|teal|pink)-\d/

// A Friday evening; every relative date below is counted back from it
const NOW = new Date(2026, 9, 9, 20, 0)
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString()

function summary(over: Partial<PlayerMatchSummaryDTO> = {}): PlayerMatchSummaryDTO {
    return {
        matchId: '6ac9061df0a9f70ffc4dfa74',
        endTime: hoursAgo(2) as never,
        result: 'Team A wins 1001–650',
        yourOutcome: 'WIN',
        gameMode: 'RANKED',
        ...over,
    }
}

function Details() {
    const { id } = useParams()
    const state = useLocation().state as unknown
    return <p>details of {id} with {JSON.stringify(state)}</p>
}

/** The row as a list renders it, with the details route behind it. */
function renderRow(row: PlayerMatchSummaryDTO, state?: unknown) {
    return render(
        <MemoryRouter initialEntries={['/matches']}>
            <Routes>
                <Route path="/matches" element={<MatchRow summary={row} state={state} />} />
                <Route path="/matches/:id" element={<Details />} />
            </Routes>
        </MemoryRouter>,
    )
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

describe('MatchRow (spec §4.9 rows)', () => {
    test('a won ranked match: the success stripe and tile, "Victory", RANKED in the accent, the date and #last6, the final score', () => {
        const { container } = renderRow(summary())
        const row = screen.getByRole('link', { name: /Victory/ })
        expect(row).toHaveAttribute('href', '/matches/6ac9061df0a9f70ffc4dfa74')
        expect(row).toHaveClass('ui-row', 'ui-row--target', 'ui-row--stripe-success')
        expect(screen.getByTestId('match-result-tile')).toHaveClass('bg-success/20', 'text-success')
        expect(screen.getByText('Victory')).toHaveClass('text-success')
        expect(screen.getByText('RANKED').closest('.ui-tag')).toHaveClass('text-accent')
        expect(row).toHaveTextContent(`${relativeMatchDate(hoursAgo(2))} · #4dfa74`)
        expect(screen.getByTestId('match-score')).toHaveTextContent(/^1001 : 650$/)
        expect(screen.getByText('TEAM A · TEAM B')).toBeInTheDocument()
        expect(container.innerHTML).not.toMatch(RAW_PALETTE)
    })

    test('a lost casual match reads "Defeat" on the danger stripe, CASUAL quietly; Team A’s points stay first', () => {
        renderRow(summary({ yourOutcome: 'LOSS', gameMode: 'CASUAL', result: 'Team B wins 870–1001' }))
        const row = screen.getByRole('link', { name: /Defeat/ })
        expect(row).toHaveClass('ui-row--stripe-danger')
        expect(screen.getByText('Defeat')).toHaveClass('text-danger-text')
        expect(screen.getByText('CASUAL').closest('.ui-tag')).toHaveClass('text-text-2')
        expect(screen.getByTestId('match-score')).toHaveTextContent(/^870 : 1001$/)
    })

    test('a forfeit shows "Forfeit" instead of points (R-36)', () => {
        renderRow(summary({ result: 'Team A wins by forfeit' }))
        expect(screen.getByText('Forfeit')).toBeInTheDocument()
        expect(screen.queryByTestId('match-score')).not.toBeInTheDocument()
        expect(screen.queryByText('TEAM A · TEAM B')).not.toBeInTheDocument()
    })

    test('the whole row opens the match and carries what the list gives for Back', async () => {
        renderRow(summary(), { page: 2 })
        await userEvent.setup().click(screen.getByRole('link', { name: /Victory/ }))
        expect(screen.getByText('details of 6ac9061df0a9f70ffc4dfa74 with {"page":2}')).toBeInTheDocument()
    })

    test('a row without an id is not a link, and says #N/A and Unknown', () => {
        renderRow(summary({ matchId: null, endTime: null, yourOutcome: null, gameMode: null, result: null }))
        expect(screen.queryByRole('link')).not.toBeInTheDocument()
        expect(screen.getByText('#N/A')).toBeInTheDocument()
        expect(screen.getAllByText('Unknown')).toHaveLength(3)
    })
})

describe('MatchRow words and dates (MatchSummaryCard’s rules, kept)', () => {
    test('the outcome words: Victory, Defeat, Draw, else the raw text, else Unknown', () => {
        expect(['WIN', 'LOSS', 'DRAW', 'ABANDONED', null].map(outcomeWord)).toEqual(['Victory', 'Defeat', 'Draw', 'ABANDONED', 'Unknown'])
        expect(['win', 'Loss', 'draw', 'ABANDONED', null].map(matchOutcome)).toEqual(['win', 'loss', 'draw', null, null])
    })

    test('the relative date: Today hh:mm, Yesterday, {d}d ago, then the day; Unknown without one', () => {
        const today = new Date(hoursAgo(2))
        expect(relativeMatchDate(hoursAgo(2))).toBe(`Today ${today.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)
        expect(relativeMatchDate(hoursAgo(30))).toBe('Yesterday')
        expect(relativeMatchDate(hoursAgo(3 * 24 + 1))).toBe('3d ago')
        const old = new Date(hoursAgo(10 * 24))
        expect(relativeMatchDate(hoursAgo(10 * 24))).toBe(old.toLocaleDateString([], { month: 'short', day: 'numeric' }))
        expect(relativeMatchDate(null)).toBe('Unknown')
    })
})
