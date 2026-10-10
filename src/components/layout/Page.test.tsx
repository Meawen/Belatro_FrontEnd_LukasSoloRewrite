import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Page } from './Page'

describe('Page (spec §4.1, §3.4)', () => {
    test('the title is the only h1 and names the document', () => {
        render(<MemoryRouter><Page title="Lobbies"><p>rows</p></Page></MemoryRouter>)
        expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Lobbies'])
        expect(screen.getByText('rows')).toBeInTheDocument()
        expect(document.title).toBe('Lobbies · Stiglja')
    })

    test('a back link above the title, a meta line under it and actions beside it', () => {
        render(
            <MemoryRouter>
                <Page title="Kod Mire" back={{ to: '/lobbies', label: 'Lobbies' }} meta="3 of 4 seated" actions={<button type="button">Copy invite link</button>}>
                    <p>table</p>
                </Page>
            </MemoryRouter>,
        )
        expect(screen.getByRole('link', { name: 'Lobbies' })).toHaveAttribute('href', '/lobbies')
        expect(screen.getByText('3 of 4 seated')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Copy invite link' })).toBeInTheDocument()
    })

    test('heading replaces the h1 text; null leaves the h1 to the content', () => {
        const { unmount } = render(<MemoryRouter><Page title="Home" heading="Hi, ana"><p>home</p></Page></MemoryRouter>)
        expect(screen.getByRole('heading', { level: 1, name: 'Hi, ana' })).toBeInTheDocument()
        expect(document.title).toBe('Home · Stiglja')
        unmount()
        render(<MemoryRouter><Page title="Match History" heading={null}><h1>Match History</h1></Page></MemoryRouter>)
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    })
})
