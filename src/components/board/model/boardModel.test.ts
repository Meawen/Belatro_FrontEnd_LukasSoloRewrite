import { describe, test, expect } from 'vitest'
import { EMPTY_LOCAL, boardModel, secondsLeft, type BoardLocal } from './boardModel'
import type { BoardState } from './accept'
import { find, indexOf, playTable } from '../../../test/fixtures/views/table'
import type { GameCard, GamePhase, PrivateGameView, PublicGameView } from '../../../types/game'

const seating = ['alice', 'bob', 'carol', 'dave'].map((id) => ({ id, cardsLeft: 6 }))
const c = (boja: GameCard['boja'], rank: GameCard['rank']): GameCard => ({ boja, rank })

function view(overrides: Partial<PublicGameView> = {}): PublicGameView {
    return {
        gameId: 'g1', gameState: 'BIDDING', bids: [], currentTrick: { leadPlayerId: '_NO_LEAD_', trump: null, plays: {} },
        teamAScore: 0, teamBScore: 0, teamA: [seating[0], seating[2]], teamB: [seating[1], seating[3]],
        challengeUsedByPlayer: {}, winnerTeamId: null, tieBreaker: false, seatingOrder: seating, declarations: {},
        belaDeclaredByPlayer: {}, challengeWindowExpiresAt: null, currentPlayerId: null, turnExpiresAt: null,
        endReason: null, forfeitTeamId: null, ...overrides,
    }
}

const myCards = [c('HERC', 'AS'), c('HERC', 'SEDMICA'), c('KARA', 'DESETKA'), c('PIK', 'KRALJ'), c('TREF', 'BABA'), c('TREF', 'DECKO')]

function state(publicView: PublicGameView, yourTurn = false, extra: Partial<PrivateGameView> = {}, skew = 0): BoardState {
    return { publicView, privateView: { publicPart: publicView, hand: myCards, yourTurn, challengeUsed: false, ...extra }, receivedAt: 1000, skew, source: 'live' }
}
const card = (cardId: string, lifted = true) => ({ pending: { kind: 'card' as const, cardId, at: 0, lifted, version: null, receivedAt: 0 }, belaCardId: null })
const model = (s: BoardState, me = 'carol', local: BoardLocal = EMPTY_LOCAL) => boardModel(s, me, local)

describe('boardModel: seats (spec §5.3.2, §5.3.3)', () => {
    test('me at the bottom, then right, partner, left in turn order; teams, cards left, the seat to act', () => {
        const m = model(state(view({ currentPlayerId: 'alice' })))
        expect(m.seats.map((s) => [s.id, s.position, s.team, s.isMe])).toEqual([
            ['carol', 'me', 'A', true], ['dave', 'right', 'B', false], ['alice', 'partner', 'A', false], ['bob', 'left', 'B', false],
        ])
        expect(m.seats.find((s) => s.id === 'dave')!.cardsLeft).toBe(6)
        expect(m.seats.filter((s) => s.current).map((s) => s.id)).toEqual(['alice'])
        expect(m).toMatchObject({ seated: true, myTeam: 'A' })
    })

    test('positions stay with the player when the server rotates seatingOrder after a trick', () => {
        const rotated = model(state(view({ gameState: 'PLAYING', seatingOrder: [seating[3], seating[0], seating[1], seating[2]] })))
        expect(rotated.seats.map((s) => [s.id, s.position])).toEqual([['carol', 'me'], ['dave', 'right'], ['alice', 'partner'], ['bob', 'left']])
        expect(rotated.turnOrder).toEqual(['dave', 'alice', 'bob', 'carol'])
    })

    test('someone not seated is not seated', () => {
        expect(model(state(view()), 'zoe')).toMatchObject({ seated: false, myTeam: null })
    })
})

describe('boardModel: HUD', () => {
    test('phases in words with the raw phase; the flags', () => {
        const words: [GamePhase, string][] = [
            ['BIDDING', 'Bidding'], ['PLAYING', 'Playing'], ['HAND_COMPLETE', 'Hand finished'], ['COMPLETED', 'Game over'], ['CANCELLED', 'Cancelled'],
        ]
        for (const [phase, word] of words) expect(model(state(view({ gameState: phase })))).toMatchObject({ phase, phaseLabel: word })
        expect(model(state(view({ gameState: 'HAND_COMPLETE' })))).toMatchObject({ bidding: false, playing: false, handComplete: true, finished: false })
        expect(model(state(view({ gameState: 'CANCELLED' }))).finished).toBe(true)
    })

    test('the trump and its season with the caller; none while bidding, though the last trick still has one', () => {
        const bids = [{ playerId: 'alice', action: 'PASS' as const, selectedTrump: null }, { playerId: 'bob', action: 'CALL_TRUMP' as const, selectedTrump: 'KARA' as const }]
        const playing = model(state(view({ gameState: 'PLAYING', bids, currentTrick: { leadPlayerId: 'alice', trump: 'KARA', plays: {} } })))
        expect(playing.trump).toEqual({ suit: 'KARA', label: 'Karo', callerId: 'bob' })
        expect(playing.season).toBe('summer')
        const bidding = model(state(view({ currentTrick: { leadPlayerId: 'alice', trump: 'HERC', plays: { alice: c('HERC', 'AS') } } })))
        expect(bidding).toMatchObject({ trump: null, season: 'none' })
        expect(model(state(view({ gameState: 'COMPLETED', currentTrick: { leadPlayerId: 'alice', trump: 'TREF', plays: {} } }))).season).toBe('winter')
    })

    test('the scores, and my team in the summary', () => {
        expect(model(state(view({ teamAScore: 412, teamBScore: 388 }))).scores).toEqual({ a: 412, b: 388 })
        expect(model(state(view())).summary.yourTeam).toBe('Your team: A')
        expect(model(state(view()), 'dave').summary.yourTeam).toBe('Your team: B')
        expect(model(state(view()), 'zoe').summary.yourTeam).toBeNull()
    })

    test('the summary: one line per bid in today\'s format, and the declaration lines', () => {
        const m = model(state(view({
            gameState: 'PLAYING',
            bids: [{ playerId: 'alice', action: 'PASS', selectedTrump: null }, { playerId: 'bob', action: 'CALL_TRUMP', selectedTrump: 'HERC' }],
            declarations: { alice: { bela: false, sequencesBySuit: { HERC: 50 }, fourOfAKindPoints: 0, bestSequencePoints: 50 } },
            belaDeclaredByPlayer: { bob: true },
        })))
        expect(m.summary.bids).toEqual(['alice: Pass', 'bob: Herc'])
        expect(m.summary.declarations).toEqual(['alice: sequence 50 (Herc)', 'bob: bela 20'])
    })
})

describe('boardModel: turn, countdown, dealer', () => {
    test("whose turn and when it ends, with the acceptance rule's clock skew; the state's version", () => {
        const m = model(state(view({ gameState: 'PLAYING', currentPlayerId: 'alice', turnExpiresAt: 31_000, stateVersion: 12 }), false, {}, 500))
        expect(m.turn).toEqual({ playerId: 'alice', expiresAt: 31_000 })
        expect(m).toMatchObject({ skew: 500, version: 12, receivedAt: 1000 })
        expect(secondsLeft(31_000, m.skew, 500)).toBe(30)
        expect(secondsLeft(31_000, m.skew, 1_500)).toBe(29)
        expect(secondsLeft(31_000, 0, 40_000)).toBe(0)
        expect(model(state(view({ currentPlayerId: 'alice', turnExpiresAt: 31_000 }))).version).toBeNull()
        expect(model(state(view({ gameState: 'HAND_COMPLETE' }))).turn).toBeNull()
    })

    test('"Your turn" on my bid or play only, never in HAND_COMPLETE even when the private view says so', () => {
        expect(model(state(view(), true))).toMatchObject({ canBid: true, canPlay: false, yourTurn: true })
        expect(model(state(view({ gameState: 'PLAYING' }), true))).toMatchObject({ canBid: false, canPlay: true, yourTurn: true })
        expect(model(state(view({ gameState: 'HAND_COMPLETE' }), true))).toMatchObject({ canBid: false, canPlay: false, yourTurn: false })
        expect(model(state(view(), false)).yourTurn).toBe(false)
    })

    test('the dealer: dealerId; without it seatingOrder[3] while bidding, and none after', () => {
        expect(model(state(view({ gameState: 'PLAYING', dealerId: 'bob' }))).dealerId).toBe('bob')
        const fallback = model(state(view()))
        expect(fallback.dealerId).toBe('dave')
        expect(fallback.seats.filter((s) => s.dealer).map((s) => s.id)).toEqual(['dave'])
        expect(model(state(view({ gameState: 'PLAYING' }))).dealerId).toBeNull()
    })
})

describe('boardModel: my hand', () => {
    test('in hand order, labelled, enabled only on my playing turn with nothing in flight; no illegal-card dimming', () => {
        const m = model(state(view({ gameState: 'PLAYING', currentTrick: { leadPlayerId: 'bob', trump: 'PIK', plays: { bob: c('KARA', 'AS') } } }), true))
        expect(m.hand.map((h) => h.id)).toHaveLength(6)
        expect(m.hand.find((h) => h.id === 'HERC-AS')!.label).toBe('As Herc')
        expect(m.hand.every((h) => h.enabled)).toBe(true)
        expect(m.hand[m.hand.length - 1].card.boja).toBe('PIK')
        const pending = model(state(view({ gameState: 'PLAYING' }), true), 'carol', { ...EMPTY_LOCAL, input: card('HERC-AS') })
        expect(pending.hand.some((h) => h.enabled)).toBe(false)
        expect(pending.hand.filter((h) => h.pending).map((h) => h.id)).toEqual(['HERC-AS'])
        // after 2 s the card drops back, and the hand stays locked
        const dropped = model(state(view({ gameState: 'PLAYING' }), true), 'carol', { ...EMPTY_LOCAL, input: card('HERC-AS', false) })
        expect(dropped.hand.some((h) => h.enabled || h.pending)).toBe(false)
        expect(model(state(view(), true)).hand.some((h) => h.enabled)).toBe(false)
    })

    test('a card shown in the trick or in lastTrick is never in my hand (a public frame ahead of the private one)', () => {
        const m = model(state(view({
            gameState: 'PLAYING',
            currentTrick: { leadPlayerId: 'carol', trump: 'HERC', plays: { carol: c('HERC', 'AS') } },
            lastTrick: { leadPlayerId: 'bob', plays: { bob: c('PIK', 'AS'), carol: c('TREF', 'DECKO'), dave: c('PIK', 'SEDMICA'), alice: c('PIK', 'OSMICA') }, order: ['bob', 'carol', 'dave', 'alice'], winnerId: 'bob' },
        }), true))
        expect(m.hand.map((h) => h.id)).not.toContain('HERC-AS')
        expect(m.hand.map((h) => h.id)).not.toContain('TREF-DECKO')
        expect(m.hand).toHaveLength(4)
    })

    test('the frozen order is handed back for the next state, and kept while the server reshuffles', () => {
        const first = model(state(view()))
        const again = model(state(view(), false, { hand: [...myCards].reverse() }), 'carol', { ...EMPTY_LOCAL, order: first.order })
        expect(again.hand.map((h) => h.id)).toEqual(first.hand.map((h) => h.id))
    })

    test('bela: the trump K or Q with the other in hand opens the prompt (R-32)', () => {
        const hand = [c('HERC', 'KRALJ'), c('HERC', 'BABA'), c('KARA', 'AS')]
        const playing = view({ gameState: 'PLAYING', currentTrick: { leadPlayerId: 'carol', trump: 'HERC', plays: {} } })
        const m = model(state(playing, true, { hand }))
        expect(m.hand.filter((h) => h.bela).map((h) => h.id).sort()).toEqual(['HERC-BABA', 'HERC-KRALJ'])
        const asking = model(state(playing, true, { hand }), 'carol', { ...EMPTY_LOCAL, input: { pending: null, belaCardId: 'HERC-BABA' } })
        expect(asking.belaPrompt!.id).toBe('HERC-BABA')
        expect(model(state(playing, false, { hand }), 'carol', { ...EMPTY_LOCAL, input: { pending: null, belaCardId: 'HERC-BABA' } }).belaPrompt).toBeNull()
    })
})

describe('boardModel: trick and piles', () => {
    test('the trick by seat with its play order; hidden while bidding', () => {
        const m = model(state(view({ gameState: 'PLAYING', currentTrick: { leadPlayerId: 'dave', trump: 'HERC', plays: { dave: c('PIK', 'AS'), alice: c('PIK', 'SEDMICA') } } })))
        expect(m.trick!.plays.map((p) => [p.playerId, p.position, p.order])).toEqual([['dave', 'right', 0], ['alice', 'partner', 1]])
        expect(model(state(view({ currentTrick: { leadPlayerId: 'dave', trump: 'HERC', plays: { dave: c('PIK', 'AS') } } }))).trick).toBeNull()
    })

    test('piles from tricksWonA/B; without them the counted fallback, or none', () => {
        expect(model(state(view({ gameState: 'PLAYING', tricksWonA: 3, tricksWonB: 1 }))).piles).toEqual({ a: 3, b: 1 })
        expect(model(state(view({ gameState: 'PLAYING' })), 'carol', { ...EMPTY_LOCAL, counted: { a: 2, b: 0 } }).piles).toEqual({ a: 2, b: 0 })
        expect(model(state(view({ gameState: 'PLAYING' }))).piles).toBeNull()
    })

    test('a real hand: the 4-card view names the winner, and the hand holds 8 − tricks cards', () => {
        const table = playTable()
        const fourth = table[indexOf(table, 'call:') + 9]
        const m = model({ publicView: fourth.public, privateView: fourth.private.carol, receivedAt: fourth.at, skew: 0, source: 'live' })
        expect(m.trick!.complete).toBe(true)
        expect(m.trick!.winnerId).toBe(fourth.public.lastTrick!.winnerId)
        expect(m.hand).toHaveLength(7)
        expect(m.piles!.a + m.piles!.b).toBe(1)
        expect(m.skew).toBe(0)
    })
})

describe('boardModel: bidding controls, declarations, challenge, window, end', () => {
    const passes = ['alice', 'bob', 'carol'].map((playerId) => ({ playerId, action: 'PASS' as const, selectedTrump: null }))

    test('bid chips at the seats while bidding, gone after the call', () => {
        const m = model(state(view({ bids: [passes[0], { playerId: 'bob', action: 'CALL_TRUMP', selectedTrump: 'PIK' }] })))
        expect(m.seats.map((s) => [s.id, s.bid])).toEqual([['carol', null], ['dave', null], ['alice', 'PASS'], ['bob', 'PIK']])
        expect(model(state(view({ gameState: 'PLAYING', bids: passes }))).seats.every((s) => s.bid === null)).toBe(true)
    })

    test('the bid panel: the dealer must call after three passes; one bid in flight (R-23, spec §5.3.5)', () => {
        expect(model(state(view({ bids: passes }), true), 'dave')).toMatchObject({ dealerMustCall: true, bidsEnabled: true, passEnabled: false })
        expect(model(state(view({ bids: passes.slice(0, 2) }), true))).toMatchObject({ dealerMustCall: false, passEnabled: true })
        const inFlight = model(state(view(), true), 'carol', { ...EMPTY_LOCAL, input: { pending: { kind: 'bid', at: 0, version: null, receivedAt: 0 }, belaCardId: null } })
        expect(inFlight).toMatchObject({ canBid: true, bidsEnabled: false, passEnabled: false })
    })

    test('zvanja chips and the bela marker at the seats', () => {
        const m = model(state(view({
            gameState: 'PLAYING',
            declarations: { carol: { bela: false, sequencesBySuit: {}, fourOfAKindPoints: 100, bestSequencePoints: 0 } },
            belaDeclaredByPlayer: { dave: true },
        })))
        expect(m.seats.find((s) => s.id === 'carol')!.zvanja).toEqual(['four of a kind 100'])
        expect(m.seats.filter((s) => s.bela).map((s) => s.id)).toEqual(['dave'])
    })

    test('Challenge while playing and in HAND_COMPLETE, until it is used', () => {
        expect(model(state(view({ gameState: 'PLAYING' }))).canChallenge).toBe(true)
        expect(model(state(view({ gameState: 'HAND_COMPLETE' }))).canChallenge).toBe(true)
        expect(model(state(view({ gameState: 'HAND_COMPLETE' }), false, { challengeUsed: true }))).toMatchObject({ canChallenge: false, challengeUsed: true })
        const seats = model(state(view({ gameState: 'PLAYING', challengeUsedByPlayer: { bob: true } }))).seats
        expect(seats.filter((s) => s.challengeUsed).map((s) => s.id)).toEqual(['bob'])
        expect(model(state(view())).canChallenge).toBe(false)
    })

    test('the window only in HAND_COMPLETE: null first, then set; the stale value of later phases is ignored', () => {
        const table = playTable()
        const at = (label: string) => {
            const f = find(table, label)
            return model({ publicView: f.public, privateView: f.private.carol, receivedAt: f.at, skew: 0, source: 'live' })
        }
        expect(at('hand-complete').window).toBeNull()
        expect(at('window-open').window).toEqual({ expiresAt: find(table, 'window-open').public.challengeWindowExpiresAt })
        const next = find(table, 'next-deal')
        expect(next.public.challengeWindowExpiresAt).not.toBeNull()
        expect(at('next-deal').window).toBeNull()
    })

    test('the end: Game over with the winner; a forfeit is Game over; a cancel is Match cancelled; declined; rematch', () => {
        expect(model(state(view({ gameState: 'COMPLETED', winnerTeamId: 'A' }))).end).toEqual({
            title: 'Game over', winnerLine: 'Team A wins', reason: null, declined: false, rematchOffered: true,
        })
        expect(model(state(view({ gameState: 'CANCELLED', endReason: 'FORFEIT', forfeitTeamId: 'B' }))).end).toMatchObject({
            title: 'Game over', winnerLine: null, reason: 'Team B forfeited — Team A wins', rematchOffered: true,
        })
        expect(model(state(view({ gameState: 'CANCELLED', endReason: 'CANCELLED' }))).end).toMatchObject({ title: 'Match cancelled', rematchOffered: false })
        expect(model(state(view({ gameState: 'CANCELLED', endReason: 'DECLINED' }))).end!.declined).toBe(true)
        expect(model(state(view({ gameState: 'PLAYING' }))).end).toBeNull()
    })
})
