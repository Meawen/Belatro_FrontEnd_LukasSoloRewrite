import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MatchDetails } from './MatchDetails'
import type { PlayerMatchHistoryDTO } from '../../types/user'

function historyItem(result: string): PlayerMatchHistoryDTO {
    return {
        yourResult: 'Win',
        history: {
            match: {
                id: 'm1', gameMode: 'RANKED', result, originLobby: null,
                teamA: [{ id: 'u1', username: 'ana' }, { id: 'u2', username: 'bob' }],
                teamB: [{ id: 'u3', username: 'cy' }, { id: 'u4', username: 'dan' }],
                startTime: '2026-10-01T18:00:00Z', endTime: '2026-10-01T18:40:00Z',
            },
            moves: [],
            structuredMoves: [{ handNo: 1, trumpCalls: [], tricks: [], challenges: [], handSummary: null }],
        },
    }
}

describe('MatchDetails final scores (R-36)', () => {
    test("shows each team's points from an en-dash result that Team B won", () => {
        render(<MatchDetails historyItem={historyItem('Team B wins 870–1001')} currentUserId="u1" onClose={vi.fn()} />)
        expect(screen.getByText('Team A Final').previousElementSibling).toHaveTextContent(/^870$/)
        expect(screen.getByText('Team B Final').previousElementSibling).toHaveTextContent(/^1001$/)
    })

    test('a forfeit shows "Won by forfeit" and no points', () => {
        render(<MatchDetails historyItem={historyItem('Team B wins by forfeit')} currentUserId="u1" onClose={vi.fn()} />)
        expect(screen.getByText('Won by forfeit')).toBeInTheDocument()
        expect(screen.queryByText('Team A Final')).not.toBeInTheDocument()
        expect(screen.queryByText('Team B Final')).not.toBeInTheDocument()
    })
})
