import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PublicFrame } from './PublicFrame'
import { userService } from '../../services/userService'

const auth = vi.hoisted(() => ({ isAuthenticated: false }))
vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ isAuthenticated: auth.isAuthenticated, token: auth.isAuthenticated ? 'tok-1' : null }),
}))
vi.mock('../../services/userService', () => ({ userService: { getActiveGame: vi.fn() } }))

function renderFrame() {
    render(
        <MemoryRouter>
            <PublicFrame title="Rules">
                <p>Belot for four players.</p>
            </PublicFrame>
        </MemoryRouter>,
    )
}

beforeEach(() => {
    vi.clearAllMocks()
    auth.isAuthenticated = false
})

describe('PublicFrame (spec §4.15)', () => {
    test('the way home, the title as the only h1, the text and the footer with its routed links', () => {
        renderFrame()
        expect(screen.getByRole('link', { name: 'Stiglja' })).toHaveAttribute('href', '/')
        expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Rules'])
        expect(screen.getByText('Belot for four players.')).toBeInTheDocument()
        const footer = screen.getByRole('contentinfo')
        expect(footer).toHaveTextContent(`© ${new Date().getFullYear()} Stiglja`)
        expect(within(footer).getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
        expect(document.title).toBe('Rules · Stiglja')
        // signed out: no banner and no request
        expect(screen.queryByRole('region', { name: 'Game in progress' })).not.toBeInTheDocument()
        expect(userService.getActiveGame).not.toHaveBeenCalled()
    })

    test('signed in with a game in progress, it offers the way back to it (R-33)', async () => {
        auth.isAuthenticated = true
        vi.mocked(userService.getActiveGame).mockResolvedValue('g9')
        renderFrame()
        expect(await screen.findByRole('button', { name: 'Return to your game' })).toBeInTheDocument()
    })
})
