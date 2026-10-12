import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Loader } from './Loader'
import { blocks, rule, uiCss } from '../../test/css'

describe('Loader (spec §3.7)', () => {
    test("keeps the page's own text; the square is decoration", () => {
        const { container } = render(<Loader text="Checking authentication..." />)
        expect(screen.getByText('Checking authentication...')).toBeInTheDocument()
        expect(container.querySelector('.ui-loader__square')).toHaveAttribute('aria-hidden', 'true')
    })

    test("takes no live-region role, so a page's own status line stays the only one", () => {
        render(<Loader text="Loading..." />)
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    test('lays out inline, as a block (default) or as the full guard screen', () => {
        const { container } = render(<><Loader /><Loader layout="inline" /><Loader layout="page" /></>)
        const [block, inline, page] = [...container.querySelectorAll('.ui-loader')]
        expect(block).toHaveClass('ui-loader--block')
        expect(inline).toHaveClass('ui-loader--inline')
        expect(page).toHaveClass('ui-loader--page')
    })

    test('a 12-px accent square blinking in two steps every second, static under reduced motion', () => {
        const square = rule('.ui-loader__square', uiCss())
        expect(square).toMatch(/width:\s*12px;/)
        expect(square).toMatch(/height:\s*12px;/)
        expect(square).toMatch(/background:\s*var\(--accent\);/)
        expect(square).toMatch(/animation:\s*ui-blink 1s steps\(2, jump-none\) infinite;/)
        expect(rule('.ui-loader__square', blocks('@media (prefers-reduced-motion: reduce)', uiCss()))).toMatch(/animation:\s*none;/)
    })
})
