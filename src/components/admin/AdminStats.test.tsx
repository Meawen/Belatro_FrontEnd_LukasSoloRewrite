import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminStats } from './AdminStats'

vi.mock('../../hooks/useMatch', () => ({
    useAllMatches: () => ({ matches: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }], isLoading: false }),
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
        expect(screen.getByText('Active Lobbies').parentElement!).toHaveTextContent('2')
        expect(screen.getByText('Pending Deletions').parentElement!).toHaveTextContent('1')
        expect(screen.getByRole('heading', { level: 2, name: 'System Statistics' })).toBeInTheDocument()
    })
})
