import { describe, test, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthFrame } from './AuthFrame'
import { setLang } from '../../i18n/lang'

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

    test('the wordmark is the way to the landing page (/), named for it, and looks as before (review Minor 8)', () => {
        renderFrame()
        const link = screen.getByRole('link', { name: 'Stiglja, start page' })
        expect(link).toHaveAttribute('href', '/')
        // the same pixel wordmark inside, with no underline of its own
        expect(within(link).getByText('Stiglja')).toHaveClass('font-pix', 't-display', 'text-accent')
        expect(link.className).not.toMatch(/underline/)
    })

    test('the wordmark link in Croatian', () => {
        setLang('hr')
        const { unmount } = renderFrame()
        try {
            expect(screen.getByRole('link', { name: 'Stiglja, početna stranica' })).toHaveAttribute('href', '/')
        } finally {
            // gone before the language is reset
            unmount()
            setLang('en')
        }
    })

    // Ruling 80: a friend's table link lands a visitor on /login, and any visitor switches in one click (US-2)
    test('the compact HR · EN switch sits at the top, before the wordmark, as on the public pages, and it switches the site', async () => {
        renderFrame()
        const group = screen.getByRole('group', { name: 'Site language' })
        expect(group.compareDocumentPosition(screen.getByRole('link', { name: 'Stiglja, start page' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(within(group).getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true')
        try {
            await userEvent.setup().click(within(group).getByRole('button', { name: 'HR' }))
            expect(within(screen.getByRole('group', { name: 'Jezik stranice' })).getByRole('button', { name: 'HR' })).toHaveAttribute('aria-pressed', 'true')
            // the frame's own words follow: the tagline and the wordmark's name
            expect(screen.getByText('Bela za četvero, online.')).toBeInTheDocument()
            expect(screen.getByRole('link', { name: 'Stiglja, početna stranica' })).toHaveAttribute('href', '/')
        } finally {
            setLang('en')
        }
    })

    test('the footer links sit below the panel (R-40)', () => {
        renderFrame()
        const footer = screen.getByRole('contentinfo')
        expect(footer).toHaveTextContent(`© ${new Date().getFullYear()} Stiglja`)
        expect(footer).toHaveTextContent('Card art by Maks Markovic')
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
