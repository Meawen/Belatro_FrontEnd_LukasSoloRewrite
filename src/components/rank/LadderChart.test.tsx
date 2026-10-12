import { describe, test, expect, vi, afterEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LadderChart } from './LadderChart'
import { LADDER } from '../../test/fixtures/ranks'

afterEach(() => vi.unstubAllGlobals())

const group = () => screen.getByRole('group', { name: 'The ladder: players by rating' })
const tooltip = () => screen.queryByTestId('chart-tooltip')

// ranks spec §7.3–7.6: bars by rank, you marked, a tooltip by pointer or keyboard, a table for screen readers
describe('LadderChart', () => {
    test('one bar per bin, each in its rank colour; the drawing is hidden from screen readers', () => {
        const { container } = render(<LadderChart ladder={LADDER} you={1290} />)
        const bars = container.querySelectorAll('[data-bar]')
        expect(bars).toHaveLength(9)
        expect(container.querySelector('[data-bar="1400"]')).toHaveStyle({ fill: 'var(--rank-gospon)' })
        expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    })

    test('a "You" tag marks your Elo; none without a placed you', () => {
        const { rerender } = render(<LadderChart ladder={LADDER} you={1290} />)
        expect(within(group()).getByText('You').closest('.ui-tag')).toHaveClass('bg-accent')
        rerender(<LadderChart ladder={LADDER} you={null} />)
        expect(within(group()).queryByText('You')).not.toBeInTheDocument()
    })

    test('keyboard: one tab stop; arrows walk the bars with a tooltip and a live region; Escape clears', async () => {
        const user = userEvent.setup()
        render(<LadderChart ladder={LADDER} you={1290} />)
        await user.tab()
        expect(group()).toHaveFocus()
        expect(tooltip()).toBeNull()
        await user.keyboard('{ArrowRight}')
        expect(tooltip()).toHaveTextContent('31 players')
        expect(tooltip()).toHaveTextContent('900–999')
        expect(screen.getByTestId('chart-live')).toHaveTextContent('900–999: 31 players')
        await user.keyboard('{ArrowRight}')
        expect(tooltip()).toHaveTextContent('1000–1099')
        await user.keyboard('{End}')
        expect(tooltip()).toHaveTextContent('1700–1799')
        await user.keyboard('{Home}')
        expect(tooltip()).toHaveTextContent('900–999')
        await user.keyboard('{ArrowLeft}')
        expect(tooltip()).toHaveTextContent('900–999')
        await user.keyboard('{Escape}')
        expect(tooltip()).toBeNull()
    })

    test('pointer: hovering a slot shows its bar; leaving clears it; the hovered bar stays full, the rest dim', () => {
        const { container } = render(<LadderChart ladder={LADDER} you={null} />)
        fireEvent.pointerMove(container.querySelector('[data-slot="1200"]')!)
        expect(tooltip()).toHaveTextContent('40 players')
        expect(container.querySelector('[data-bar="1200"]')).toHaveAttribute('fill-opacity', '1')
        expect(container.querySelector('[data-bar="900"]')).toHaveAttribute('fill-opacity', '0.55')
        fireEvent.pointerLeave(group())
        expect(tooltip()).toBeNull()
    })

    test('a single player reads "1 player"', async () => {
        const user = userEvent.setup()
        render(<LadderChart ladder={{ ...LADDER, bins: [{ from: 1200, count: 1 }] }} you={null} />)
        await user.tab()
        await user.keyboard('{ArrowRight}')
        expect(tooltip()).toHaveTextContent('1 player')
        expect(tooltip()).not.toHaveTextContent('1 players')
    })

    test('the hidden tables carry every bin and every rank (spec L-7)', () => {
        render(<LadderChart ladder={LADDER} you={null} />)
        const byRating = screen.getByRole('table', { name: 'Players by rating' })
        expect(within(byRating).getAllByRole('row')).toHaveLength(1 + 9)
        expect(within(byRating).getByRole('row', { name: '1200–1299 40' })).toBeInTheDocument()
        const byRank = screen.getByRole('table', { name: 'Players by rank' })
        expect(within(byRank).getAllByRole('row')).toHaveLength(1 + 7)
        expect(within(byRank).getByRole('row', { name: 'Cucek 37' })).toBeInTheDocument()
    })
})
