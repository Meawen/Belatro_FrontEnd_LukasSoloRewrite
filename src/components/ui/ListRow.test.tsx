import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ListRow } from './ListRow'
import { Panel } from './Panel'
import { blocks, rule, uiCss } from '../../test/css'

describe('ListRow (spec §3.7)', () => {
    test('as a button, the whole row is one target with press feedback and a decorative chevron', async () => {
        const onClick = vi.fn()
        render(<ListRow as="button" onClick={onClick} title="Kod Mire" meta="host mira_z" trailing="3/4" aria-label="Kod Mire, host mira_z, 3 of 4, private" />)
        const row = screen.getByRole('button', { name: 'Kod Mire, host mira_z, 3 of 4, private' })
        expect(row).toHaveClass('ui-row', 'ui-row--target')
        expect(row).toHaveAttribute('type', 'button')
        expect(row).toHaveTextContent('Kod Mirehost mira_z3/4')
        expect(row.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
        await userEvent.click(row)
        expect(onClick).toHaveBeenCalledTimes(1)
        expect(rule('.ui-row--target:active:not(:disabled)', uiCss())).toMatch(/transform:\s*translateY\(2px\);/)
        expect(rule('.ui-row', uiCss())).toMatch(/min-height:\s*56px;/)
        expect(rule('.ui-row:focus-visible', uiCss())).toMatch(/outline-offset:\s*-5px;/)
    })

    test('as a link, it navigates to its path', async () => {
        render(
            <MemoryRouter initialEntries={['/matches']}>
                <Routes>
                    <Route path="/matches" element={<ListRow as="link" to="/matches/abc123" title="Victory" />} />
                    <Route path="/matches/:id" element={<p>details</p>} />
                </Routes>
            </MemoryRouter>,
        )
        const link = screen.getByRole('link', { name: 'Victory' })
        expect(link).toHaveAttribute('href', '/matches/abc123')
        await userEvent.click(link)
        expect(screen.getByText('details')).toBeInTheDocument()
    })

    test('a plain row is static: no role, no chevron, its trailing actions are its own buttons', () => {
        const { container } = render(<ListRow title="ana" trailing={<button>Accept</button>} />)
        expect(screen.getAllByRole('button')).toHaveLength(1)
        expect(container.querySelector('.ui-row')).not.toHaveClass('ui-row--target')
        expect(container.querySelector('svg')).not.toBeInTheDocument()
    })

    test('a disabled button row takes no click; stripe and highlight are props', async () => {
        const onClick = vi.fn()
        render(<><ListRow as="button" disabled onClick={onClick} title="Full" /><ListRow as="button" onClick={onClick} stripe="success" highlight title="You" /></>)
        await userEvent.click(screen.getByRole('button', { name: 'Full' }))
        expect(onClick).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: 'You' })).toHaveClass('ui-row--stripe-success', 'ui-row--highlight')
    })
})

describe('Panel (spec §3.4, §3.7)', () => {
    test('a notched surface with the 3-px edge, as the element asked for', () => {
        render(<><Panel as="section" aria-label="Stats">x</Panel><Panel edge="accent" padding="lg">y</Panel></>)
        const section = screen.getByRole('region', { name: 'Stats' })
        expect(section).toHaveClass('ui-panel', 'notch', 'bg-surface', 'px-edge', 'p-4')
        expect(screen.getByText('y')).toHaveClass('notch', 'bg-surface', 'ui-panel--accent', 'p-6')
    })

    test('forced colours give panels and rows a 1-px border', () => {
        const forced = blocks('@media (forced-colors: active)', uiCss())
        expect(rule('.ui-panel', forced)).toMatch(/border:\s*1px solid;/)
        expect(rule('.ui-row', forced)).toMatch(/border:\s*1px solid;/)
    })
})
