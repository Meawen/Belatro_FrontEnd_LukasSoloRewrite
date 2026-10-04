import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminStats } from './AdminStats'

vi.mock('../../hooks/useMatch', () => ({
    useAllMatches: () => ({ matches: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }], isLoading: false }),
}))
vi.mock('../../hooks/useAdmin', () => ({
    useAdmin: () => ({ users: [{ id: 'u1', deletionRequested: true }, { id: 'u2', deletionRequested: false }], isLoading: false }),
}))
vi.mock('../../hooks/useLobby', () => ({ useLobbies: () => ({ lobbies: [], isLoading: false }) }))

describe('AdminStats', () => {
    test('Total Matches counts the matches themselves', () => {
        render(<AdminStats />)
        const tile = screen.getByText('Total Matches').parentElement!
        expect(tile).toHaveTextContent('3')
        expect(screen.getByText('Total Users').parentElement!).toHaveTextContent('2')
    })
})
