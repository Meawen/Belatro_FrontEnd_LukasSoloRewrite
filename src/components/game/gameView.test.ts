import { describe, test, expect } from 'vitest'
import { cardLabel, seatsFromMe, trumpOf } from './gameView'
import type { PublicGameView } from '../../types/game'

const seats = ['alice', 'bob', 'carol', 'dave'].map((id) => ({ id, cardsLeft: 8 }))

describe('seatsFromMe', () => {
    test('rotates so I come first and the turn order is kept', () => {
        expect(seatsFromMe(seats, 'carol').map((s) => s.id)).toEqual(['carol', 'dave', 'alice', 'bob'])
    })
    test('leaves the order alone when I am first or not seated', () => {
        expect(seatsFromMe(seats, 'alice').map((s) => s.id)).toEqual(['alice', 'bob', 'carol', 'dave'])
        expect(seatsFromMe(seats, 'zoe').map((s) => s.id)).toEqual(['alice', 'bob', 'carol', 'dave'])
    })
})

describe('trumpOf', () => {
    const base = {
        bids: [],
        currentTrick: { leadPlayerId: '_NO_LEAD_', trump: null, plays: {} },
    } as unknown as PublicGameView

    test('no trump before the call', () => {
        expect(trumpOf(base)).toBeNull()
    })
    test('the last trump call counts, passes do not', () => {
        const view = {
            ...base,
            bids: [
                { playerId: 'alice', action: 'PASS', selectedTrump: null },
                { playerId: 'bob', action: 'CALL_TRUMP', selectedTrump: 'PIK' },
            ],
        } as PublicGameView
        expect(trumpOf(view)).toBe('PIK')
    })
    test("the trick's own trump wins when present", () => {
        const view = { ...base, currentTrick: { leadPlayerId: 'alice', trump: 'TREF', plays: {} } } as PublicGameView
        expect(trumpOf(view)).toBe('TREF')
    })
})

describe('cardLabel', () => {
    test('uses the Croatian names the card art uses', () => {
        expect(cardLabel({ boja: 'KARA', rank: 'DESETKA' })).toBe('10 Karo')
        expect(cardLabel({ boja: 'HERC', rank: 'AS' })).toBe('As Herc')
    })
})
