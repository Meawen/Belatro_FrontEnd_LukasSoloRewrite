import { describe, test, expect } from 'vitest'
import { completedTrick, displayedTrick, type SeatPosition } from './trick'
import { find, indexOf, playTable } from '../../../test/fixtures/views/table'
import type { GameCard, PublicGameView } from '../../../types/game'

// carol's screen: carol at the bottom, dave on her right, alice at the top, bob on her left
const positions: Record<string, SeatPosition> = { carol: 'me', dave: 'right', alice: 'partner', bob: 'left' }
const seat = (id: string) => ({ id, cardsLeft: 5 })
const c = (boja: GameCard['boja'], rank: GameCard['rank']): GameCard => ({ boja, rank })

function view(overrides: Partial<PublicGameView>): PublicGameView {
    return {
        gameId: 'g1', gameState: 'PLAYING', bids: [], currentTrick: null, teamAScore: 0, teamBScore: 0,
        teamA: [seat('alice'), seat('carol')], teamB: [seat('bob'), seat('dave')], challengeUsedByPlayer: {},
        winnerTeamId: null, tieBreaker: false, seatingOrder: ['alice', 'bob', 'carol', 'dave'].map(seat),
        declarations: {}, belaDeclaredByPlayer: {}, challengeWindowExpiresAt: null, currentPlayerId: null,
        turnExpiresAt: null, endReason: null, forfeitTeamId: null, ...overrides,
    }
}

const fourCards = { dave: c('KARA', 'AS'), alice: c('KARA', 'SEDMICA'), bob: c('HERC', 'SEDMICA'), carol: c('KARA', 'DESETKA') }

describe('displayedTrick (spec §5.3.3 Trick, Trick winner)', () => {
    test('plays by seat, in the cyclic turn order from the lead, whatever the map order', () => {
        const trick = displayedTrick(view({
            currentTrick: { leadPlayerId: 'dave', trump: 'HERC', plays: { carol: c('KARA', 'DESETKA'), dave: c('KARA', 'AS'), alice: c('KARA', 'SEDMICA') } },
        }), positions)!
        expect(trick.plays.map((p) => [p.playerId, p.position, p.order, p.id])).toEqual([
            ['dave', 'right', 0, 'KARA-AS'], ['alice', 'partner', 1, 'KARA-SEDMICA'], ['carol', 'me', 2, 'KARA-DESETKA'],
        ])
        expect(trick).toMatchObject({ leadPlayerId: 'dave', complete: false, winnerId: null, winnerTeam: null })
    })

    test("hidden while bidding: the view still carries the last hand's trick", () => {
        expect(displayedTrick(view({ gameState: 'BIDDING', currentTrick: { leadPlayerId: 'dave', trump: 'HERC', plays: fourCards } }), positions)).toBeNull()
    })

    test('the winner of a complete trick: lastTrick.winnerId first', () => {
        const trick = displayedTrick(view({
            currentTrick: { leadPlayerId: 'dave', trump: 'HERC', plays: fourCards, winningCard: c('KARA', 'AS') },
            lastTrick: { leadPlayerId: 'dave', plays: fourCards, order: ['dave', 'alice', 'bob', 'carol'], winnerId: 'bob' },
        }), positions)!
        expect(trick).toMatchObject({ complete: true, winnerId: 'bob', winnerTeam: 'B' })
    })

    test('without lastTrick (an older backend): the play holding winningCard, else the game rule', () => {
        const byCard = view({ currentTrick: { leadPlayerId: 'dave', trump: 'HERC', plays: fourCards, winningCard: c('HERC', 'SEDMICA') } })
        expect(displayedTrick(byCard, positions)!.winnerId).toBe('bob')
        const byRule = view({ currentTrick: { leadPlayerId: 'dave', trump: null, plays: fourCards } })
        expect(displayedTrick(byRule, positions)).toMatchObject({ winnerId: 'dave', winnerTeam: 'B' })
        // a lastTrick of another trick doesn't count
        const otherLast = view({
            currentTrick: { leadPlayerId: 'dave', trump: 'HERC', plays: fourCards, winningCard: c('HERC', 'SEDMICA') },
            lastTrick: { leadPlayerId: 'alice', plays: fourCards, order: ['alice', 'bob', 'carol', 'dave'], winnerId: 'carol' },
        })
        expect(displayedTrick(otherLast, positions)!.winnerId).toBe('bob')
    })

    test("the server's 4-card views name the same winner as lastTrick", () => {
        const table = playTable()
        for (const fanOut of table.filter((f) => f.label.startsWith('play:') && f.trigger === 'TS')) {
            const trick = displayedTrick(fanOut.public, positions)!
            if (trick.complete) expect(trick.winnerId).toBe(fanOut.public.lastTrick!.winnerId)
        }
        const old = playTable({ fields: false })
        const i = indexOf(old, 'hand-complete')
        expect(displayedTrick(old[i].public, positions)!.winnerId).toBe(table[i].public.lastTrick!.winnerId)
    })
})

describe('completedTrick (§6.1 lastTrick)', () => {
    test('its order and winner; null when absent', () => {
        const table = playTable()
        const fourth = find(table, 'play:', indexOf(table, 'call:') + 13)
        const last = completedTrick(fourth.public, positions)!
        expect(last.plays.map((p) => p.playerId)).toEqual(fourth.public.lastTrick!.order)
        expect(last.winnerId).toBe(fourth.public.lastTrick!.winnerId)
        expect(completedTrick(view({}), positions)).toBeNull()
    })
})
