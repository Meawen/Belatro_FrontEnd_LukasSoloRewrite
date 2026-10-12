import { describe, test, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthFrame } from './AuthFrame'

function renderFrame() {
    return render(
        <MemoryRouter>
            <AuthFrame>
                <h1>Welcome Back</h1>
            </AuthFrame>
        </MemoryRouter>,
    )
}

/** The card art on the page, as file names, in document order. */
function artOf(container: HTMLElement) {
    return Array.from(container.querySelectorAll('img'), (img) => decodeURIComponent(img.src.split('/').pop() ?? ''))
}

describe('AuthFrame (spec §4.2, X-1)', () => {
    test('the pixel wordmark, a fan of Herc As, Karo As and Pik As from the card art, and the tagline, on a felt band', () => {
        const { container } = renderFrame()
        expect(screen.getByText('Stiglja')).toHaveClass('font-pix')
        expect(artOf(container)).toEqual(['Herc As.png', 'Karo As.png', 'Pik As.png'])
        expect(screen.getByText('Belot for four, online.')).toBeInTheDocument()
        expect(container.querySelector('.felt')).toHaveAttribute('aria-hidden', 'true')
    })

    test('the wordmark and the fan are decoration: no heading of their own, nothing announced', () => {
        renderFrame()
        // the page's only h1 is its panel title
        expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Welcome Back'])
        expect(screen.queryAllByRole('img')).toEqual([])
    })

    test('the footer links sit below the panel (R-40)', () => {
        renderFrame()
        const footer = screen.getByRole('contentinfo')
        expect(footer).toHaveTextContent(`© ${new Date().getFullYear()} Stiglja`)
        for (const [name, href] of [
            ['Rules', '/rules'],
            ['Privacy', '/privacy'],
            ['Terms', '/terms'],
            ['Contact: support@stiglja.com', 'mailto:support@stiglja.com'],
        ]) {
            expect(within(footer).getByRole('link', { name })).toHaveAttribute('href', href)
        }
    })
})
