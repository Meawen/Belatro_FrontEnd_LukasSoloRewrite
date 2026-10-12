import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { FC } from 'react'
import { RulesPage } from './RulesPage'
import { PrivacyPage } from './PrivacyPage'
import { TermsPage } from './TermsPage'

// Tailwind's own colour scale and white/black: the design uses tokens only (spec §3.2)
const RAW_COLOUR = /\b(?:bg|text|border|from|to|via)-(?:(?:amber|emerald|slate|red|purple|gray|blue|yellow|green|orange|teal|lime|pink)-\d|white\b|black\b)/

// signed out: the frame's active-game banner asks nothing
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false, token: null }) }))

describe('Rules, Privacy and Terms (spec §4.15)', () => {
    test.each([
        ['Rules', RulesPage, 'Cards'],
        ['Privacy notice', PrivacyPage, 'Who runs Stiglja'],
        ['Terms of use', TermsPage, 'The service'],
    ] as [string, FC, string][])('%s: the display title, headline sections, token colours only', (title, Page, firstSection) => {
        const { container } = render(<Page />, { wrapper: MemoryRouter })
        expect(screen.getByRole('heading', { level: 1, name: title })).toHaveClass('t-display')
        const sections = screen.getAllByRole('heading', { level: 2 })
        expect(sections[0]).toHaveTextContent(firstSection)
        for (const heading of sections) expect(heading).toHaveClass('t-headline')
        expect(container.innerHTML).not.toMatch(RAW_COLOUR)
    })
})
