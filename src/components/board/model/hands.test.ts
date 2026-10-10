import { describe, test, expect } from 'vitest'
import { blokRows, endedHand, handIsComplete, handTricks, handTrump, parseMoveCard, peekTricks } from './hands'
import type { HandDTO, HandSummary, TrickDTO } from '../../../types/match'

const TEAM: Record<string, 'A' | 'B'> = { alice: 'A', carol: 'A', bob: 'B', dave: 'B' }
const teamOf = (id: string) => TEAM[id] ?? null

let order = 0
/** A stored trick: plays as [player, "RANK of BOJA"], in play order. */
function trick(trickNo: number, plays: [string, string][], winnerId?: string | null): TrickDTO {
    return { trickNo, winnerId, points: null, lastTrickBonus: trickNo === 8, moves: plays.map(([player, card]) => ({ order: ++order, player, card, legal: null })) }
}
const full = (trickNo: number, winnerId?: string | null) =>
    trick(trickNo, [['alice', 'SEDMICA of KARA'], ['bob', 'AS of KARA'], ['carol', 'OSMICA of KARA'], ['dave', 'DESETKA of KARA']], winnerId)
function summary(finalScoreA: number, finalScoreB: number, extra: Partial<HandSummary> = {}): HandSummary {
    return { teamAPoints: 0, teamBPoints: 0, teamADeclPoints: 0, teamBDeclPoints: 0, teamATricksWon: 4, teamBTricksWon: 4, padanje: false, capot: false, finalScoreA, finalScoreB, ...extra }
}
function hand(handNo: number, tricks: TrickDTO[], handSummary: HandSummary | null = null, caller = 'bob'): HandDTO {
    return { handNo, trumpCalls: [{ order: 0, player: 'alice', trump: 'PASS' }, { order: 1, player: caller, trump: 'HERC' }], tricks, challenges: [], handSummary }
}
const eight = (winner?: string | null) => Array.from({ length: 8 }, (_, i) => full(i + 1, winner))

describe('structured moves', () => {
    test('a stored card "RANK of BOJA" is a card; anything else is not', () => {
        expect(parseMoveCard('AS of HERC')).toEqual({ boja: 'HERC', rank: 'AS' })
        expect(parseMoveCard('QUEEN of SPADES')).toBeNull()
        expect(parseMoveCard(null)).toBeNull()
    })

    test("a hand's trump and its tricks in play order; a missing winner comes from the game rule (spec §6.3)", () => {
        const h = hand(1, [full(1, 'bob'), trick(2, [['dave', 'SEDMICA of PIK'], ['alice', 'AS of PIK'], ['bob', 'DEVETKA of HERC'], ['carol', 'KRALJ of PIK']], null)])
        expect(handTrump(h)).toBe('HERC')
        const [first, second] = handTricks(h)
        expect(first.plays.map((p) => p.playerId)).toEqual(['alice', 'bob', 'carol', 'dave'])
        expect(first.winnerId).toBe('bob')
        expect(second.plays[0]).toEqual({ playerId: 'dave', card: { boja: 'PIK', rank: 'SEDMICA' }, id: 'PIK-SEDMICA' })
        expect(second.winnerId).toBe('bob')
        expect(handTricks(hand(2, [trick(1, [['alice', 'AS of KARA']], null)]))[0].winnerId).toBeNull()
    })

    test('the hand just ended: its summary matches the view\'s scores and it has all 32 cards; null while the store lags', () => {
        const done = hand(2, eight('bob'), summary(300, 200))
        const lagging = hand(2, [...eight('bob').slice(0, 7), trick(8, [['alice', 'SEDMICA of TREF'], ['bob', 'AS of TREF'], ['carol', 'OSMICA of TREF']])], summary(300, 200))
        const first = hand(1, eight('alice'), summary(162, 0))
        expect(endedHand([first, done], { a: 300, b: 200 })).toBe(done)
        expect(endedHand([first, lagging], { a: 300, b: 200 })).toBeNull()
        expect(endedHand([first], { a: 300, b: 200 })).toBeNull()
        expect(endedHand(null, { a: 0, b: 0 })).toBeNull()
        expect(handIsComplete({ ...hand(3, [full(1)], summary(500, 200)), challenges: [{ order: 9, player: 'carol', success: true }] })).toBe(true)
    })
})

describe('blokRows (spec §5.3.3 Bela Blok)', () => {
    test('one row per hand from the change in finalScore, so rows add up; PAD for the caller\'s team, CAPOT for the team with 8 tricks', () => {
        const rows = blokRows([
            hand(1, eight(), summary(100, 62)),
            hand(2, eight(), summary(100, 244, { padanje: true }), 'carol'),
            hand(3, eight(), summary(352, 244, { capot: true, teamATricksWon: 8, teamBTricksWon: 0 })),
        ], teamOf)
        expect(rows).toEqual([
            { handNo: 1, a: 100, b: 62, padanje: null, capot: null },
            { handNo: 2, a: 0, b: 182, padanje: 'A', capot: null },
            { handNo: 3, a: 252, b: 0, padanje: null, capot: 'A' },
        ])
        expect(rows.reduce((sum, row) => sum + row.a, 0)).toBe(352)
    })

    test('deduplicated by handNo (the last summary counts); hands without a summary are skipped', () => {
        const rows = blokRows([
            hand(1, eight(), summary(100, 62)),
            hand(1, eight(), summary(100, 244)),
            hand(2, [], null),
        ], teamOf)
        expect(rows).toEqual([{ handNo: 1, a: 100, b: 244, padanje: null, capot: null }])
        expect(blokRows(null, teamOf)).toEqual([])
    })
})

describe('peekTricks (spec §5.3.3 Peek, D-11)', () => {
    const hands = [
        hand(1, eight('alice'), summary(162, 0)),
        hand(2, [full(1, 'alice'), full(2, 'bob'), full(3, null), trick(4, [['alice', 'SEDMICA of TREF']])]),
        { handNo: 3, trumpCalls: [], tricks: [], challenges: [], handSummary: null },
    ]

    test("my team's complete tricks of the current hand only (the last with a trump call)", () => {
        expect(peekTricks(hands, 'PLAYING', 'A', teamOf).map((t) => t.trickNo)).toEqual([1])
        expect(peekTricks(hands, 'PLAYING', 'B', teamOf).map((t) => t.trickNo)).toEqual([2, 3])
        expect(peekTricks(hands, 'HAND_COMPLETE', 'A', teamOf)).toHaveLength(1)
    })

    test('none while bidding, after the game, or for someone without a team', () => {
        expect(peekTricks(hands, 'BIDDING', 'A', teamOf)).toEqual([])
        expect(peekTricks(hands, 'COMPLETED', 'A', teamOf)).toEqual([])
        expect(peekTricks(hands, 'PLAYING', null, teamOf)).toEqual([])
        expect(peekTricks(null, 'PLAYING', 'A', teamOf)).toEqual([])
    })
})
