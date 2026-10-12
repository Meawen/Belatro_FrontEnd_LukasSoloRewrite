import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Avatar } from './Avatar'
import { Pager } from './Pager'

describe('Avatar (spec §3.7; X-12)', () => {
    test('the initial on a notched tile in the tone colour, hidden from assistive tech', () => {
        const { container } = render(<><Avatar initial="mira_z" tone="team-a" size="lg" /><Avatar initial="ivo" /></>)
        const [mira, ivo] = [...container.querySelectorAll('.ui-avatar')]
        expect(mira).toHaveTextContent(/^M$/)
        expect(mira).toHaveClass('notch', 'bg-team-a', 'text-ink', 'size-13')
        expect(mira).toHaveAttribute('aria-hidden', 'true')
        expect(ivo).toHaveTextContent(/^I$/)
        expect(ivo).toHaveClass('bg-surface-3', 'text-text', 'size-9')
    })
})

describe('Pager (spec §3.7)', () => {
    test('Previous and Next step one page; the ends are disabled', async () => {
        const onPage = vi.fn()
        const { rerender } = render(<Pager page={0} hasNext onPage={onPage} />)
        expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument()
        expect(screen.getByText('Page 1')).toHaveClass('t-score')
        expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
        await userEvent.click(screen.getByRole('button', { name: 'Next' }))
        expect(onPage).toHaveBeenLastCalledWith(1)
        rerender(<Pager page={2} hasNext={false} onPage={onPage} />)
        expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
        await userEvent.click(screen.getByRole('button', { name: 'Previous' }))
        expect(onPage).toHaveBeenLastCalledWith(1)
    })

    test('"Page n of N" when the count is known, a note, and both buttons off while a page loads', () => {
        render(<Pager page={1} hasNext pageCount={3} note="· 10 matches per page" disabled onPage={() => {}} />)
        expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
        expect(screen.getByText('· 10 matches per page')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    })
})
