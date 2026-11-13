import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Avatar } from './Avatar'
import { Pager } from './Pager'
import { setLang } from '../../i18n/lang'

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

    test('an icon in place of the initial (a bot\'s robot), sized to the tile', () => {
        const { container } = render(<><Avatar initial="Bot-Ana" icon="robot" tone="team-b" size="lg" /><Avatar initial="Bot-Tin" icon="robot" size="sm" /></>)
        const [lg, sm] = [...container.querySelectorAll('.ui-avatar')]
        expect(lg).toHaveTextContent(/^$/)
        expect(lg).toHaveClass('notch', 'bg-team-b', 'text-ink', 'size-13')
        expect(lg).toHaveAttribute('aria-hidden', 'true')
        expect(lg.querySelector('svg')).toHaveAttribute('width', '27')
        expect(sm.querySelector('svg')).toHaveAttribute('width', '18')
    })

    test('a Croatian first letter shows as its capital (spec §1.5)', () => {
        const { container } = render(<><Avatar initial="šime" /><Avatar initial="đuro" /><Avatar initial="čiko" /></>)
        expect([...container.querySelectorAll('.ui-avatar')].map((tile) => tile.textContent)).toEqual(['Š', 'Đ', 'Č'])
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

    test('in Croatian (open beta §1.2)', () => {
        setLang('hr')
        try {
            const { rerender } = render(<Pager page={1} hasNext pageCount={3} onPage={() => {}} />)
            expect(screen.getByRole('navigation', { name: 'Stranice popisa' })).toBeInTheDocument()
            expect(screen.getByText('Stranica 2 od 3')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Prethodna' })).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Sljedeća' })).toBeInTheDocument()
            rerender(<Pager page={1} hasNext onPage={() => {}} />)
            expect(screen.getByText('Stranica 2')).toBeInTheDocument()
        } finally {
            setLang('en')
        }
    })
})
