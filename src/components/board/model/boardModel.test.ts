import { describe, test, expect } from 'vitest'
import { EMPTY_LOCAL, boardModel, secondsLeft, type BoardLocal } from './boardModel'
import type { BoardState } from './accept'
import { find, indexOf, playTable } from '../../../test/fixtures/views/table'
import type { GameCard, GamePhase, LastChallengeView, PrivateGameView, PublicGameView, ZvanjaView } from '../../../types/game'

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

    test('a bot is told by the server\'s flag on its seat; a false or missing flag is a person (casual bots spec §7)', () => {
        const flagged = seating.map((seat) => (seat.id === 'dave' ? { ...seat, bot: true } : seat.id === 'bob' ? { ...seat, bot: false } : seat))
        const m = model(state(view({ seatingOrder: flagged })))
        expect(m.seats.map((s) => [s.id, s.bot])).toEqual([['carol', false], ['dave', true], ['alice', false], ['bob', false]])
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

    test('the summary: one line per bid in today\'s format, and the declaration lines: each winning seat\'s values (zvanja), then bela', () => {
        const nothing = { said: null, kind: null, height: null, declarations: [], cards: [] }
        const zvanja: ZvanjaView = {
            seats: [
                { playerId: 'alice', said: 50, kind: null, height: null, cards: [],
                    declarations: [{ kind: 'RUN', points: 50, suit: 'HERC', top: 'AS' }, { kind: 'RUN', points: 20, suit: 'PIK', top: 'BABA' }] },
                { ...nothing, playerId: 'bob', said: 20 },
                { ...nothing, playerId: 'carol' },
                { ...nothing, playerId: 'dave' },
            ],
            winnerTeam: 'A', total: 70, decidedBy: 'VALUE', belot: null, playOpensAt: null,
        }
        // the older `declarations` field no longer makes lines
        const old = { alice: { bela: false, sequencesBySuit: { HERC: 50 }, fourOfAKindPoints: 0, bestSequencePoints: 50 } }
        const m = model(state(view({
            gameState: 'PLAYING',
            bids: [{ playerId: 'alice', action: 'PASS', selectedTrump: null }, { playerId: 'bob', action: 'CALL_TRUMP', selectedTrump: 'HERC' }],
            declarations: old,
            zvanja,
            belaDeclaredByPlayer: { bob: true },
        })))
        expect(m.summary.bids).toEqual(['alice: Pass', 'bob: Herc'])
        expect(m.summary.declarations).toEqual(['alice: 50 + 20', 'bob: bela 20'])
        expect(model(state(view({ gameState: 'PLAYING', declarations: old, belaDeclaredByPlayer: { bob: true } }))).summary.declarations).toEqual(['bob: bela 20'])
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

    test('the bela marker at the seats (the zvanja chips come from summaryChips: Board.declarations.test)', () => {
        const m = model(state(view({ gameState: 'PLAYING', belaDeclaredByPlayer: { dave: true } })))
        expect(m.seats.filter((s) => s.bela).map((s) => s.id)).toEqual(['dave'])
        expect(m.seats[0]).not.toHaveProperty('zvanja')
    })

    test('Challenge from the hand\'s first card while playing, and in HAND_COMPLETE; greyed in place once used (gameplay rules §6, R-2)', () => {
        const firstCard = { leadPlayerId: 'alice', trump: 'HERC' as const, plays: { alice: c('PIK', 'AS') } }
        // the trump call: no card down yet
        expect(model(state(view({ gameState: 'PLAYING', currentTrick: { leadPlayerId: 'alice', trump: 'HERC', plays: {} } }))).challenge).toBe('hidden')
        expect(model(state(view({ gameState: 'PLAYING', currentTrick: firstCard }))).challenge).toBe('available')
        expect(model(state(view({ gameState: 'HAND_COMPLETE' }))).challenge).toBe('available')
        expect(model(state(view({ gameState: 'PLAYING', currentTrick: firstCard }), false, { challengeUsed: true }))).toMatchObject({ challenge: 'used', challengeUsed: true })
        expect(model(state(view({ gameState: 'HAND_COMPLETE' }), false, { challengeUsed: true }))).toMatchObject({ challenge: 'used', challengeUsed: true })
        const seats = model(state(view({ gameState: 'PLAYING', challengeUsedByPlayer: { bob: true } }))).seats
        expect(seats.filter((s) => s.challengeUsed).map((s) => s.id)).toEqual(['bob'])
        expect(model(state(view())).challenge).toBe('hidden')
        expect(model(state(view({ gameState: 'COMPLETED' }))).challenge).toBe('hidden')
        // not seated: no private view, no Challenge
        expect(model({ ...state(view({ gameState: 'HAND_COMPLETE' })), privateView: null }).challenge).toBe('hidden')
    })

    test('a card down this hand is a card in the trick, a completed trick, or a trick on a pile', () => {
        const table = playTable({ pauseMs: 0 })
        const challengeAt = (label: string, change: (pub: PublicGameView) => void = () => {}) => {
            const priv = structuredClone(find(table, label).private.carol)
            change(priv.publicPart)
            return model({ publicView: priv.publicPart, privateView: priv, receivedAt: 0, skew: 0, source: 'live' }).challenge
        }
        expect(challengeAt('call:')).toBe('hidden')
        expect(challengeAt('play:')).toBe('available')
        // between tricks: the next lead hasn't played, and the view shows no trick
        const between = (pub: PublicGameView) => { pub.currentTrick = { leadPlayerId: pub.lastTrick!.winnerId, trump: 'HERC', plays: {} } }
        const fourth = indexOf(table, 'play:', indexOf(table, 'call:')) + 6
        expect(table[fourth].public.lastTrick).not.toBeNull()
        expect(challengeAt(table[fourth].label, between)).toBe('available')
        // an older backend without lastTrick: the piles count it
        expect(challengeAt(table[fourth].label, (pub) => { between(pub); pub.lastTrick = null })).toBe('available')
        expect(challengeAt(table[fourth].label, (pub) => { between(pub); pub.lastTrick = null; pub.tricksWonA = 0; pub.tricksWonB = 0 })).toBe('hidden')
    })

    test('no Challenge in a window a right challenge decided (R-3); a wrong one, or one from an earlier hand, leaves it', () => {
        const decided = (lastChallenge: LastChallengeView) => model(state(view({ gameState: 'HAND_COMPLETE', lastChallenge }))).challenge
        const right: LastChallengeView = { number: 1, playerId: 'alice', team: 'A', foulFound: true, thisHand: true }
        expect(decided(right)).toBe('hidden')
        expect(decided({ ...right, foulFound: false })).toBe('available')
        expect(decided({ ...right, thisHand: false })).toBe('available')
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

describe('boardModel: the declarations and the last challenge (gameplay rules §4, §5)', () => {
    const zvanja: ZvanjaView = {
        seats: [
            { playerId: 'alice', said: 20, kind: 'RUN', height: 'AS', declarations: [{ kind: 'RUN', points: 20, suit: 'KARA', top: 'AS' }], cards: [c('KARA', 'BABA'), c('KARA', 'KRALJ'), c('KARA', 'AS')] },
            { playerId: 'bob', said: 20, kind: 'RUN', height: 'AS', declarations: [], cards: [] },
            { playerId: 'carol', said: null, kind: null, height: null, declarations: [], cards: [] },
            { playerId: 'dave', said: null, kind: null, height: null, declarations: [], cards: [] },
        ],
        winnerTeam: 'A', total: 20, decidedBy: 'ORDER', belot: null, playOpensAt: 40_000,
    }
    const lastChallenge: LastChallengeView = { number: 2, playerId: 'bob', team: 'B', foulFound: false, thisHand: true }

    test('zvanja, lastChallenge and playOpensAt pass through while PLAYING', () => {
        const m = model(state(view({ gameState: 'PLAYING', zvanja, lastChallenge })))
        expect(m.zvanja).toEqual(zvanja)
        expect(m.lastChallenge).toEqual(lastChallenge)
        expect(m.playOpensAt).toBe(40_000)
    })

    test('playOpensAt is null outside PLAYING; zvanja and lastChallenge still pass through', () => {
        for (const phase of ['BIDDING', 'HAND_COMPLETE', 'COMPLETED', 'CANCELLED'] as GamePhase[]) {
            const m = model(state(view({ gameState: phase, zvanja, lastChallenge })))
            expect([phase, m.playOpensAt]).toEqual([phase, null])
            expect(m).toMatchObject({ zvanja, lastChallenge })
        }
        expect(model(state(view({ gameState: 'PLAYING', zvanja: { ...zvanja, playOpensAt: null } }))).playOpensAt).toBeNull()
    })

    test('an older view (no zvanja, no lastChallenge) gives nulls, and the board is as today', () => {
        const old = view({ gameState: 'PLAYING', currentPlayerId: 'carol', turnExpiresAt: 31_000 })
        const m = model(state(old, true))
        expect(m).toMatchObject({ zvanja: null, lastChallenge: null, playOpensAt: null, canPlay: true })
        expect(m.hand.every((h) => h.enabled)).toBe(true)
        expect(m.tellsChallenges).toBe(false)
        // a newer backend says null: the same board, except that it tells its challenges (diffBoard's Challenged)
        expect(model(state({ ...old, zvanja: null, lastChallenge: null }, true))).toEqual({ ...m, tellsChallenges: true })
    })

    test('a real hand: the call carries zvanja with playOpensAt; an older backend\'s table has neither', () => {
        const call = find(playTable(), 'call:')
        const m = model({ publicView: call.public, privateView: call.private.carol, receivedAt: call.at, skew: 0, source: 'live' })
        expect(m.zvanja).toEqual(call.public.zvanja)
        expect(m.playOpensAt).toBe(call.public.zvanja!.playOpensAt)
        expect(m.playOpensAt).not.toBeNull()
        const old = find(playTable({ fields: false }), 'call:')
        expect(model({ publicView: old.public, privateView: old.private.carol, receivedAt: old.at, skew: 0, source: 'live' }))
            .toMatchObject({ zvanja: null, lastChallenge: null, playOpensAt: null })
    })

    test('a belot ends the game: Game over, "Team A wins by belot", and who held all eight of which suit', () => {
        const t = playTable({ belot: { player: 'carol', suit: 'PIK' } })
        const last = t[t.length - 1]
        const m = model({ publicView: last.public, privateView: last.private.carol, receivedAt: last.at, skew: 0, source: 'live' })
        expect(m.end).toEqual({ title: 'Game over', winnerLine: 'Team A wins by belot', reason: 'carol held all eight Pik', declined: false, rematchOffered: true })
        expect(m).toMatchObject({ playOpensAt: null, zvanja: { belot: { playerId: 'carol', suit: 'PIK' } } })
    })

    test('a belot after an earlier hand shows no trick, though its view still carries the last hand\'s (backend review B3)', () => {
        // the server's final view keeps the previous hand's trick 8 as currentTrick; lastTrick too, should it ever
        const played = playTable()
        const stale = find(played, 'next-deal').public.currentTrick!
        const lastTrick = find(played, 'window-open').public.lastTrick!
        expect(Object.keys(stale.plays)).toHaveLength(4)
        const t = playTable({ belot: { player: 'carol', suit: 'PIK' } })
        const end = t[t.length - 1]
        const edited = { ...end.public, currentTrick: stale, lastTrick }
        const m = model({ publicView: edited, privateView: { ...end.private.carol, publicPart: edited }, receivedAt: end.at, skew: 0, source: 'live' })
        expect(m).toMatchObject({ trick: null, lastTrick: null })
        expect(m.hand).toHaveLength(8)
        // only a belot: the same view of a game played out shows its trick
        const playedOut = { ...edited, endReason: null }
        const shown = model({ publicView: playedOut, privateView: { ...end.private.carol, publicPart: playedOut }, receivedAt: end.at, skew: 0, source: 'live' })
        expect(shown.trick?.plays).toHaveLength(4)
        expect(shown.lastTrick?.plays).toHaveLength(4)
    })
})
