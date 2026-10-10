import { describe, test, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { RecentForm, formLine, recentForm } from './RecentForm'
import type { PlayerMatchSummaryDTO } from '../../types/user'

// Tailwind's own colour scale (bg-emerald-900, text-red-300, …): the design uses tokens only (spec §3.2)
const RAW_PALETTE = /\b(?:bg|text|border|from|to|via)-(?:amber|emerald|slate|red|purple|gray|blue|yellow|green|orange|teal|pink)-\d/

/** One page of the summary, most recent first, as GET /user/{id}/history/summary lists it. */
const page = (...outcomes: (string | null)[]): PlayerMatchSummaryDTO[] =>
    outcomes.map((yourOutcome, i) => ({ matchId: `m${i}`, endTime: null, result: null, yourOutcome, gameMode: 'CASUAL' }))

describe('recentForm (spec §4.9 Recent form; §7.2)', () => {
    test('counts the page’s wins and losses and the run the most recent match starts', () => {
        expect(recentForm(page('LOSS', 'WIN', 'WIN', 'LOSS'))).toEqual({
            outcomes: ['loss', 'win', 'win', 'loss'], wins: 2, losses: 2, streak: { outcome: 'loss', count: 1 },
        })
        expect(recentForm(page('WIN', 'WIN', 'WIN', 'LOSS', 'WIN')).streak).toEqual({ outcome: 'win', count: 3 })
    })

    test('a draw counts as neither and starts no run; an unknown outcome is left out', () => {
        expect(recentForm(page('DRAW', 'WIN', null, 'ABANDONED'))).toEqual({ outcomes: ['draw', 'win'], wins: 1, losses: 0, streak: null })
    })

    test('the line: "{w} wins · {l} losses on this page", then "won/lost the last {k}", singular for one', () => {
        expect(formLine(recentForm(page('LOSS', 'WIN', 'WIN', 'LOSS')))).toBe('2 wins · 2 losses on this page · lost the last 1')
        expect(formLine(recentForm(page('WIN', 'WIN', 'LOSS')))).toBe('2 wins · 1 loss on this page · won the last 2')
        expect(formLine(recentForm(page('DRAW', 'WIN')))).toBe('1 win · 0 losses on this page')
    })
})

describe('RecentForm (spec §4.9; D-30)', () => {
    test('one square per match, most recent first: W green, L red, D yellow, each named', () => {
        const { container } = render(<RecentForm summaries={page('LOSS', 'WIN', 'DRAW', 'WIN')} />)
        const strip = screen.getByRole('region', { name: 'Recent form' })
        const squares = within(strip).getAllByRole('listitem')
        expect(squares.map((square) => square.textContent)).toEqual(['L', 'W', 'D', 'W'])
        expect(squares.map((square) => square.title)).toEqual(['Defeat', 'Victory', 'Draw', 'Victory'])
        expect(squares[0]).toHaveClass('bg-danger-fill', 'text-text')
        expect(squares[1]).toHaveClass('bg-success', 'text-ink')
        expect(squares[2]).toHaveClass('bg-accent', 'text-ink')
        expect(within(strip).getByText('2 wins · 1 loss on this page · lost the last 1')).toBeInTheDocument()
        expect(container.innerHTML).not.toMatch(RAW_PALETTE)
    })

    test('a page without a known outcome shows no strip', () => {
        const { container } = render(<RecentForm summaries={page(null)} />)
        expect(container).toBeEmptyDOMElement()
    })
})
