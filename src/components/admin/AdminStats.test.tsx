import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminStats } from './AdminStats'
import { setLang } from '../../i18n/lang'

const state = vi.hoisted(() => ({ matches: 3 }))

vi.mock('../../hooks/useMatch', () => ({
    useAllMatches: () => ({ matches: Array.from({ length: state.matches }, (_, i) => ({ id: `m${i + 1}` })), isLoading: false }),
}))
vi.mock('../../hooks/useAdmin', () => ({
    useAdmin: () => ({ users: [{ id: 'u1', deletionRequested: true }, { id: 'u2', deletionRequested: false }], isLoading: false }),
}))
// as the hook answers: the open lobbies (GET /lobbies/open) loaded, the all-lobbies query never run
vi.mock('../../hooks/useLobby', () => ({ useLobbies: () => ({ lobbies: null, openLobbies: [{ id: 'l1' }, { id: 'l2' }], isLoading: false }) }))

describe('AdminStats', () => {
    test('Total Matches counts the matches themselves', () => {
        render(<AdminStats />)
        const tile = screen.getByText('Total Matches').parentElement!
        expect(tile).toHaveTextContent('3')
        expect(screen.getByText('Total Users').parentElement!).toHaveTextContent('2')
    })

    // X-7: today's tile read the never-run all-lobbies query and always said 0
    test('Active Lobbies is the open-lobby count, Pending Deletions the flagged accounts', () => {
        render(<AdminStats />)
        expect(screen.getByText('Active Tables').parentElement!).toHaveTextContent('2')
        expect(screen.getByText('Pending Deletions').parentElement!).toHaveTextContent('1')
        expect(screen.getByRole('heading', { level: 2, name: 'System Statistics' })).toBeInTheDocument()
    })
})

describe('AdminStats in Croatian (open beta §1.1)', () => {
    afterEach(() => {
        state.matches = 3
        setLang('en')
    })

    test('statistics in Croatian, numbers in the language', () => {
        state.matches = 1234
        const { unmount } = render(<AdminStats />)
        expect(screen.getByText('Total Matches').parentElement!).toHaveTextContent('1,234')
        unmount()
        setLang('hr')
        render(<AdminStats />)
        expect(screen.getByRole('heading', { level: 2, name: 'Statistika sustava' })).toBeInTheDocument()
        expect(screen.getByText('Ukupno korisnika').parentElement!).toHaveTextContent('2')
        expect(screen.getByText('Ukupno partija').parentElement!).toHaveTextContent('1.234')
        expect(screen.getByText('Otvoreni stolovi').parentElement!).toHaveTextContent('2')
        expect(screen.getByText('Zahtjevi za brisanje').parentElement!).toHaveTextContent('1')
    })
})
