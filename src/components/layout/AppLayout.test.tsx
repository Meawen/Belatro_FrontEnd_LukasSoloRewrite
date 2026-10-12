import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppLayout } from './AppLayout'

vi.mock('./Sidebar', async () => {
    const { Link } = await import('react-router-dom')
    return { Sidebar: () => <nav aria-label="Main navigation">sidebar <Link to="/friends">Friends</Link></nav> }
})
vi.mock('./ActiveGameBanner', () => ({ ActiveGameBanner: () => null }))
vi.mock('./UnverifiedEmailBanner', () => ({ UnverifiedEmailBanner: () => null }))

/** A matchMedia that answers (max-width: Npx) queries for a window this wide. */
function viewport(width: number) {
    vi.stubGlobal('matchMedia', (query: string) => {
        const max = /max-width:\s*([\d.]+)px/.exec(query)
        return {
            matches: max !== null && width <= Number(max[1]),
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }
    })
}

function renderLayout() {
    render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <AppLayout showSidebar={true}><h1>Dashboard</h1></AppLayout>
        </MemoryRouter>,
    )
}

afterEach(() => vi.unstubAllGlobals())

describe('AppLayout on a phone (R-37)', () => {
    test('at 375 px the sidebar stays hidden until the menu button is pressed', async () => {
        viewport(375)
        renderLayout()
        expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument()
        const user = userEvent.setup()
        await user.click(screen.getByRole('button', { name: 'Menu' }))
        expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Close menu' }))
        expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument()
    })

    test('at 375 px following a link in the menu closes it', async () => {
        viewport(375)
        renderLayout()
        const user = userEvent.setup()
        await user.click(screen.getByRole('button', { name: 'Menu' }))
        await user.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: 'Friends' }))
        expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false')
    })

    test('at 1024 px the sidebar is in the page and there is no menu button', () => {
        viewport(1024)
        renderLayout()
        expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument()
    })
})
