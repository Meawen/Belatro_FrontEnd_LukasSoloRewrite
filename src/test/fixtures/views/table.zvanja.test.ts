import { describe, test, expect } from 'vitest'
import { find, indexOf, playTable, type FanOut } from './table'
import { cardId } from '../../../components/board/model/rules'
import type { GameCard, PublicGameView } from '../../../types/game'

// The seeds below deal hand 1 (dave deals, alice first) as the comments say.
const ids = (cards: readonly GameCard[]) => cards.map(cardId).sort()
const seatsOf = (view: PublicGameView) => view.zvanja!.seats.map((s) => [s.playerId, s.said, s.kind, s.height])
const added = (view: PublicGameView) => {
    const bela = Object.values(view.belaDeclaredByPlayer).filter(Boolean).length
    const capot = view.tricksWonA === 8 || view.tricksWonB === 8 ? 90 : 0
    return view.teamAScore + view.teamBScore - 162 - 20 * bela - capot
}

describe('playTable: the declarations at the trump call (gameplay rules §2, §5)', () => {
    test('seed 1254: seats in turn order; the winners score every declaration, a card in a run and a four shown once; the losers show nothing', () => {
        // alice 20 (Herc 8-10), bob 20, carol four Asovi and 20 (Karo Baba-As), dave 20: carol's 100 wins for team A
        const t = playTable({ seed: 1254 })
        const call = find(t, 'call:')
        const z = call.public.zvanja!
        expect(seatsOf(call.public)).toEqual([['alice', 20, null, null], ['bob', 20, null, null], ['carol', 100, null, null], ['dave', 20, null, null]])
        expect(z).toMatchObject({ winnerTeam: 'A', total: 140, decidedBy: 'VALUE', belot: null })
        const [alice, bob, carol, dave] = z.seats
        expect(carol.declarations).toEqual([{ kind: 'FOUR', points: 100, suit: null, top: 'AS' }, { kind: 'RUN', points: 20, suit: 'KARA', top: 'AS' }])
        expect(ids(carol.cards)).toEqual(['HERC-AS', 'KARA-AS', 'KARA-BABA', 'KARA-KRALJ', 'PIK-AS', 'TREF-AS'])
        expect(alice.declarations).toEqual([{ kind: 'RUN', points: 20, suit: 'HERC', top: 'DESETKA' }])
        expect(ids(alice.cards)).toEqual(['HERC-DESETKA', 'HERC-DEVETKA', 'HERC-OSMICA'])
        for (const loser of [bob, dave]) expect([loser.declarations, loser.cards]).toEqual([[], []])
        for (const seat of z.seats) for (const card of seat.cards) expect(call.private[seat.playerId].hand).toContainEqual(card)
        // the older field, from the same contest: each scorer's best run and best four
        expect(call.public.declarations).toEqual({
            alice: { bela: false, sequencesBySuit: { HERC: 20 }, fourOfAKindPoints: 0, bestSequencePoints: 20 },
            carol: { bela: false, sequencesBySuit: { KARA: 20 }, fourOfAKindPoints: 100, bestSequencePoints: 20 },
        })
        expect(added(find(t, 'hand-complete').public)).toBe(140)
    })

    test('seed 234: two runs in one suit both count; heights on every seat at the top value; the partner is the one beaten (HEIGHT)', () => {
        // alice Karo 8-10 and Baba-As, bob Tref up to Decko, carol Herc up to Baba
        const t = playTable({ seed: 234 })
        const call = find(t, 'call:')
        expect(seatsOf(call.public)).toEqual([['alice', 20, 'RUN', 'AS'], ['bob', 20, 'RUN', 'DECKO'], ['carol', 20, 'RUN', 'BABA'], ['dave', null, null, null]])
        expect(call.public.zvanja).toMatchObject({ winnerTeam: 'A', total: 60, decidedBy: 'HEIGHT' })
        expect(call.public.zvanja!.seats[0].declarations).toEqual([
            { kind: 'RUN', points: 20, suit: 'KARA', top: 'AS' }, { kind: 'RUN', points: 20, suit: 'KARA', top: 'DESETKA' },
        ])
        expect(ids(call.public.zvanja!.seats[0].cards)).toEqual(['KARA-AS', 'KARA-BABA', 'KARA-DESETKA', 'KARA-DEVETKA', 'KARA-KRALJ', 'KARA-OSMICA'])
        expect(call.public.zvanja!.seats[1]).toMatchObject({ declarations: [], cards: [] })
        expect(added(find(t, 'hand-complete').public)).toBe(60)
    })

    test('seed 113: two 20s up to As tie fully: the first in turn order wins (ORDER), heights on the two tied seats', () => {
        const call = find(playTable({ seed: 113 }), 'call:')
        expect(seatsOf(call.public)).toEqual([['alice', 20, 'RUN', 'AS'], ['bob', 20, 'RUN', 'AS'], ['carol', null, null, null], ['dave', null, null, null]])
        expect(call.public.zvanja).toMatchObject({ winnerTeam: 'A', total: 20, decidedBy: 'ORDER' })
        expect(call.public.zvanja!.seats.map((s) => s.declarations.length)).toEqual([1, 0, 0, 0])
        expect(ids(call.public.zvanja!.seats[0].cards)).toEqual(['KARA-AS', 'KARA-BABA', 'KARA-KRALJ'])
    })

    test('a four beats an equal run (FOUR); a lone declarer (decidedBy null); nobody declared', () => {
        const four = find(playTable({ seed: 1101 }), 'call:').public
        expect(seatsOf(four)).toEqual([['alice', 100, 'FOUR', 'AS'], ['bob', null, null, null], ['carol', null, null, null], ['dave', 100, 'RUN', 'BABA']])
        expect(four.zvanja).toMatchObject({ winnerTeam: 'A', total: 100, decidedBy: 'FOUR' })
        const lone = find(playTable(), 'call:').public
        expect(seatsOf(lone)).toEqual([['alice', null, null, null], ['bob', null, null, null], ['carol', null, null, null], ['dave', 20, null, null]])
        expect(lone.zvanja).toMatchObject({ winnerTeam: 'B', total: 20, decidedBy: null })
        const nobody = find(playTable({ seed: 3 }), 'call:').public
        expect(nobody.zvanja).toMatchObject({ winnerTeam: null, total: 0, decidedBy: null, belot: null, playOpensAt: null })
        expect(nobody.zvanja!.seats.every((s) => s.said === null && s.declarations.length === 0 && s.cards.length === 0)).toBe(true)
        expect(nobody.declarations).toEqual({})
    })

    test('null while bidding, the same from the call to the end of the hand, null again at the next deal; lastChallenge always null', () => {
        const t = playTable({ hands: 2 })
        const call = indexOf(t, 'call:')
        const next = indexOf(t, 'next-deal')
        const secondCall = indexOf(t, 'call:', next)
        for (const [i, f] of t.slice(0, secondCall).entries()) {
            const expected = i >= call && i < next ? t[call].public.zvanja : null
            expect([f.label, f.public.zvanja, f.private.bob.publicPart.zvanja]).toEqual([f.label, expected, expected])
        }
        expect(t[secondCall].public.zvanja).toMatchObject({ winnerTeam: null, playOpensAt: null })
        expect(t.every((f) => f.public.lastChallenge === null && f.private.carol.publicPart.lastChallenge === null)).toBe(true)
    })
})

describe('playTable: the wait before the first card (gameplay rules §4)', () => {
    test('someone declared: play opens pauseMs after the call, the first lead\'s timer runs from then, the first card comes no earlier', () => {
        for (const [options, pause] of [[{}, 5000], [{ pauseMs: 2000 }, 2000]] as const) {
            const t = playTable(options)
            const i = indexOf(t, 'call:')
            const [gsc, ts, ctl] = t.slice(i, i + 3)
            const opens = gsc.at + pause
            expect([gsc.public.zvanja!.playOpensAt, ts.public.zvanja!.playOpensAt, ctl.public.zvanja!.playOpensAt]).toEqual([opens, opens, opens])
            expect([gsc.public.turnExpiresAt, ts.public.turnExpiresAt]).toEqual([null, opens + 30_000])
            expect(find(t, 'play:').at).toBeGreaterThanOrEqual(opens)
        }
    })

    test('nobody declared, or pauseMs 0: playOpensAt null, and the timing as before', () => {
        for (const t of [playTable({ seed: 3 }), playTable({ pauseMs: 0 })]) {
            const i = indexOf(t, 'call:')
            expect(t[i].public.zvanja!.playOpensAt).toBeNull()
            expect(t[i + 1].public.turnExpiresAt).toBe(t[i].at + 30_000)
            expect(find(t, 'play:').at).toBe(t[i].at + 800)
        }
    })

    test('the wait moves times only: every label, trigger and version as with pauseMs 0', () => {
        const strip = (t: FanOut[]) => t.map((f) => [f.label, f.trigger, f.version])
        expect(strip(playTable({ hands: 2 }))).toEqual(strip(playTable({ hands: 2, pauseMs: 0 })))
    })
})

describe('playTable: belot (gameplay rules §3)', () => {
    const PIK = ['SEDMICA', 'OSMICA', 'DEVETKA', 'DESETKA', 'DECKO', 'BABA', 'KRALJ', 'AS'].map((rank) => `PIK-${rank}`).sort()

    test('the option deals the player all eight of the suit, six in hand and two in the talon; the rest stays seeded', () => {
        const t = playTable({ belot: { player: 'carol', suit: 'PIK' } })
        expect(t[0].private.carol.hand.map((c) => c.boja)).toEqual(Array(6).fill('PIK'))
        const call = find(t, 'call:')
        expect(ids(call.private.carol.hand)).toEqual(PIK)
        const seeded = find(playTable(), 'call:')
        for (const id of ['alice', 'bob', 'dave']) {
            for (const card of seeded.private[id].hand.filter((c) => c.boja !== 'PIK')) expect(call.private[id].hand).toContainEqual(card)
        }
    })

    test('at the trump call the game ends: COMPLETED, the belot team at 1001, the other unchanged, endReason BELOT; nothing follows', () => {
        const t = playTable({ belot: { player: 'carol', suit: 'PIK' }, scores: [420, 380], hands: 2 })
        const i = indexOf(t, 'call:')
        expect(t.slice(i).map((f) => `${f.label} ${f.trigger}`)).toEqual(['call:dave:HERC GSC', 'call:dave:HERC TS', 'call:dave:HERC CTL'])
        for (const f of t.slice(i)) {
            expect(f.public).toMatchObject({
                gameState: 'COMPLETED', teamAScore: 1001, teamBScore: 380, winnerTeamId: 'A', endReason: 'BELOT',
                currentPlayerId: null, turnExpiresAt: null, declarations: {},
            })
            expect(Object.values(f.private).some((p) => p.yourTurn)).toBe(false)
        }
        const z = t[i].public.zvanja!
        expect(z).toMatchObject({ belot: { playerId: 'carol', suit: 'PIK' }, winnerTeam: 'A', total: 0, decidedBy: null, playOpensAt: null })
        expect(z.seats.every((s) => s.said === null && s.kind === null && s.height === null)).toBe(true)
        expect(z.seats.map((s) => [s.playerId, s.declarations, ids(s.cards)])).toEqual([
            ['alice', [], []], ['bob', [], []], ['carol', [], PIK], ['dave', [], []],
        ])
    })

    test('the belot team goes one above the other when the other is past 1001 (R-7)', () => {
        const t = playTable({ belot: { player: 'bob', suit: 'KARA' }, scores: [1100, 1050] })
        expect(t[t.length - 1].public).toMatchObject({ teamAScore: 1100, teamBScore: 1101, winnerTeamId: 'B', endReason: 'BELOT' })
        expect(t[t.length - 1].public.zvanja).toMatchObject({ belot: { playerId: 'bob', suit: 'KARA' }, winnerTeam: 'B' })
    })
})
