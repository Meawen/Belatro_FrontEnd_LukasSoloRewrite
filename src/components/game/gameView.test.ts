import { describe, test, expect } from 'vitest'
import { cardLabel, declarationLines, endSentence, isBelaCard, seatsFromMe, trumpOf } from './gameView'
import type { GameCard, PublicGameView, ZvanjaSeatView, ZvanjaView } from '../../types/game'

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
    test("in PLAYING the trick's own trump wins when present", () => {
        const view = {
            ...base,
            gameState: 'PLAYING',
            currentTrick: { leadPlayerId: 'alice', trump: 'TREF', plays: {} },
        } as PublicGameView
        expect(trumpOf(view)).toBe('TREF')
    })
    test("while bidding there is no trump, though the last hand's trick is still on the view", () => {
        // The backend keeps the previous hand's last trick, trump included, until the next hand's first play.
        const view = {
            ...base,
            gameState: 'BIDDING',
            bids: [],
            currentTrick: {
                leadPlayerId: 'alice',
                trump: 'HERC',
                plays: {
                    alice: { boja: 'HERC', rank: 'DEVETKA' },
                    bob: { boja: 'HERC', rank: 'KRALJ' },
                    carol: { boja: 'HERC', rank: 'BABA' },
                    dave: { boja: 'HERC', rank: 'OSMICA' },
                },
            },
        } as PublicGameView
        expect(trumpOf(view)).toBeNull()
    })
})

describe('cardLabel', () => {
    test('uses the Croatian names the card art uses', () => {
        expect(cardLabel({ boja: 'KARA', rank: 'DESETKA' })).toBe('10 Karo')
        expect(cardLabel({ boja: 'HERC', rank: 'AS' })).toBe('As Herc')
    })
})

describe('declarationLines (R-31, gameplay rules §6)', () => {
    const seat = (playerId: string, points: number[] = []): ZvanjaSeatView => ({
        playerId, said: points[0] ?? null, kind: null, height: null, cards: [],
        declarations: points.map((p) => ({ kind: 'RUN', points: p, suit: 'HERC', top: 'AS' })),
    })
    const base = { declarations: {}, belaDeclaredByPlayer: {} } as unknown as PublicGameView

    test('one line per winning seat with all its values, in turn order; then bela', () => {
        const zvanja: ZvanjaView = {
            seats: [seat('ivo', [50, 20]), seat('mara'), seat('lana', [20]), seat('me')],
            winnerTeam: 'B', total: 90, decidedBy: 'VALUE', belot: null, playOpensAt: null,
        }
        expect(declarationLines({ ...base, zvanja, belaDeclaredByPlayer: { mara: true, me: false } })).toEqual(['ivo: 50 + 20', 'lana: 20', 'mara: bela 20'])
    })

    test('nobody declared, no zvanja yet, or an older view: only bela; the older declarations field makes none', () => {
        const old = { ivo: { bela: false, sequencesBySuit: { KARA: 100 }, fourOfAKindPoints: 200, bestSequencePoints: 100 } }
        expect(declarationLines({ ...base, declarations: old })).toEqual([])
        expect(declarationLines({ ...base, zvanja: null, belaDeclaredByPlayer: { ivo: true } })).toEqual(['ivo: bela 20'])
        const nobody: ZvanjaView = { seats: [seat('ivo'), seat('mara')], winnerTeam: null, total: 0, decidedBy: null, belot: null, playOpensAt: null }
        expect(declarationLines({ ...base, zvanja: nobody })).toEqual([])
    })
})

describe('endSentence for a belot (gameplay rules §3)', () => {
    const ended = { gameState: 'COMPLETED', winnerTeamId: 'B', endReason: 'BELOT', forfeitTeamId: null } as unknown as PublicGameView
    const belot: ZvanjaView = { seats: [], winnerTeam: 'B', total: 0, decidedBy: null, belot: { playerId: 'ivo', suit: 'PIK' }, playOpensAt: null }

    test('who held all eight of which suit', () => {
        expect(endSentence({ ...ended, zvanja: belot })).toBe('ivo held all eight Pik')
        expect(endSentence({ ...ended, zvanja: { ...belot, belot: { playerId: 'mara', suit: 'KARA' } } })).toBe('mara held all eight Karo')
    })

    test('null without zvanja, or a zvanja without its belot', () => {
        expect(endSentence(ended)).toBeNull()
        expect(endSentence({ ...ended, zvanja: null })).toBeNull()
        expect(endSentence({ ...ended, zvanja: { ...belot, belot: null } })).toBeNull()
    })
})

describe('isBelaCard (R-32)', () => {
    test('only the trump K or Q while the other is still in hand', () => {
        const hand: GameCard[] = [{ boja: 'PIK', rank: 'KRALJ' }, { boja: 'PIK', rank: 'BABA' }, { boja: 'HERC', rank: 'BABA' }]
        expect(isBelaCard({ boja: 'PIK', rank: 'KRALJ' }, hand, 'PIK')).toBe(true)
        expect(isBelaCard({ boja: 'PIK', rank: 'BABA' }, hand, 'PIK')).toBe(true)
        // not trump; trump without its partner in hand; not a K or Q; no trump called yet
        expect(isBelaCard({ boja: 'HERC', rank: 'BABA' }, hand, 'PIK')).toBe(false)
        expect(isBelaCard({ boja: 'HERC', rank: 'BABA' }, hand, 'HERC')).toBe(false)
        expect(isBelaCard({ boja: 'PIK', rank: 'AS' }, hand, 'PIK')).toBe(false)
        expect(isBelaCard({ boja: 'PIK', rank: 'KRALJ' }, hand, null)).toBe(false)
    })
})
