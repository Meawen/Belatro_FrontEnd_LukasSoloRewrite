import { describe, test, expect } from 'vitest'
import { firstHandOver, gameOver, legalIds, mustCall, whyLine, whyMarked, type Why, type WhyKind } from './hand2'
import { en } from '../i18n/catalog/en'
import { hr } from '../i18n/catalog/hr'
import type { Boja, GameBid, GameCard, GamePhase, PrivateGameView, PublicGameView, Rank } from '../types/game'

// Škola bele's hand 2 (open beta §7.3): what the coach reads from the server's views. Carol's game; Herc is trump.

const card = (boja: Boja, rank: Rank): GameCard => ({ boja, rank })
const seating = ['alice', 'bob', 'carol', 'dave'].map((id) => ({ id, cardsLeft: 8 }))
const CALLED: GameBid[] = [{ playerId: 'alice', action: 'CALL_TRUMP', selectedTrump: 'HERC' }]

function pub(overrides: Partial<PublicGameView> = {}): PublicGameView {
    return {
        gameId: 'g1', gameState: 'PLAYING', bids: CALLED,
        currentTrick: { leadPlayerId: 'carol', trump: 'HERC', plays: {} },
        teamAScore: 0, teamBScore: 0, teamA: [seating[0], seating[2]], teamB: [seating[1], seating[3]],
        challengeUsedByPlayer: {}, winnerTeamId: null, tieBreaker: false, seatingOrder: seating, declarations: {},
        belaDeclaredByPlayer: {}, challengeWindowExpiresAt: null, currentPlayerId: 'carol', turnExpiresAt: null,
        endReason: null, forfeitTeamId: null,
        ...overrides,
    }
}

/** My turn while playing: the trick so far (lead first, as the seats play), my hand and the server's legal cards. */
function mine(trick: [string, GameCard][], hand: GameCard[], legalCards: GameCard[] | null | undefined, more: Partial<PublicGameView> = {}): PrivateGameView {
    const lead = trick[0]?.[0] ?? 'carol'
    const view: PrivateGameView = {
        publicPart: pub({ currentTrick: { leadPlayerId: lead, trump: 'HERC', plays: Object.fromEntries(trick) }, ...more }),
        hand, yourTurn: true, challengeUsed: false,
    }
    return legalCards === undefined ? view : { ...view, legalCards }
}

const T7 = card('TREF', 'SEDMICA')
const T9 = card('TREF', 'DEVETKA')
const TJ = card('TREF', 'DECKO')
const TQ = card('TREF', 'BABA')
const TA = card('TREF', 'AS')
const H7 = card('HERC', 'SEDMICA')
const H8 = card('HERC', 'OSMICA')
const HJ = card('HERC', 'DECKO')
const HK = card('HERC', 'KRALJ')
const HA = card('HERC', 'AS')
const KA = card('KARA', 'AS')
const KK = card('KARA', 'KRALJ')
const P7 = card('PIK', 'SEDMICA')

describe("hand 2's helpers (open beta §7.3)", () => {
    test("legalIds: my turn while playing gives the server's legal cards as ids; otherwise null", () => {
        const hand = [T7, T9, TJ, HA]
        expect(legalIds(mine([['bob', TQ]], hand, [T9, TJ]))).toEqual(['TREF-DEVETKA', 'TREF-DECKO'])
        expect(legalIds({ ...mine([['bob', TQ]], hand, [T9, TJ]), yourTurn: false })).toBeNull()
        expect(legalIds(mine([], hand, [T9, TJ], { gameState: 'BIDDING' }))).toBeNull()
        expect(legalIds(mine([['bob', TQ]], hand, null))).toBeNull()
        // an older backend sends no field at all
        expect(legalIds(mine([['bob', TQ]], hand, undefined))).toBeNull()
        expect(legalIds(null)).toBeNull()
    })

    test("whyMarked names the rule behind the marks, from the server's set", () => {
        const cases: [WhyKind, PrivateGameView, Boja | null][] = [
            // nothing led yet: any card
            ['lead', mine([], [T9, H7, KA], [KA, T9, H7]), null],
            // Tref led, the As can't be beaten: every Tref of mine
            ['follow', mine([['bob', TA]], [T7, T9, HA, KK], [T9, T7]), 'TREF'],
            // Tref led, the Baba beaten only by my As
            ['beat', mine([['bob', TQ]], [TA, T7, HA], [TA]), 'TREF'],
            // trump led: every trump of mine, none beats the As
            ['followTrump', mine([['bob', HA]], [H7, H8, TA], [H8, H7]), 'HERC'],
            // trump led: only my Decko beats it
            ['overTrump', mine([['bob', HA]], [HJ, H7, TA], [HJ]), 'HERC'],
            // no Tref: every trump of mine
            ['cut', mine([['bob', TA]], [H7, HK, KA], [HK, H7]), 'TREF'],
            // no Tref, and alice's Kralj already cut it: only my higher trump
            ['overCut', mine([['alice', TA], ['bob', HK]], [H7, HA, KA], [HA]), 'TREF'],
            // no Tref, no trump: anything
            ['any', mine([['bob', TA]], [KA, P7], [P7, KA]), 'TREF'],
            // trump led, no trump: anything
            ['noTrump', mine([['bob', HA]], [TA, P7], [TA, P7]), 'HERC'],
            // a set that fits none of the rules: a neutral line, never a wrong one
            ['other', mine([['bob', TA]], [T7, HA, KA], [T7, HA]), 'TREF'],
        ]
        for (const [kind, view, suit] of cases) {
            expect(whyMarked(view), kind).toEqual({ kind, suit, trump: 'HERC' })
        }
        // nothing to explain without a legal set
        expect(whyMarked(mine([['bob', TA]], [T7], null))).toBeNull()
        expect(whyMarked(mine([['bob', TA]], [T7], []))).toBeNull()
        expect(whyMarked({ ...mine([['bob', TA]], [T7], [T7]), yourTurn: false })).toBeNull()
        expect(whyMarked(null)).toBeNull()
    })

    test("whyLine words each kind in both languages, with the board's suit names", () => {
        expect(whyLine({ kind: 'follow', suit: 'TREF', trump: 'HERC' }, en)).toBe('Tref was led and you hold Tref, so you must follow suit. Any Tref of yours may go here.')
        expect(whyLine({ kind: 'cut', suit: 'KARA', trump: 'HERC' }, hr)).toBe('Nemaš nijedan Karo, pa moraš rezati adutom: baci Herc.')
        expect(whyLine({ kind: 'any', suit: 'PIK', trump: 'HERC' }, en)).toBe('You have no Pik and no trump, so any card may go.')
        const kinds: WhyKind[] = ['lead', 'follow', 'beat', 'followTrump', 'overTrump', 'cut', 'overCut', 'any', 'noTrump', 'other']
        for (const catalog of [en, hr]) {
            for (const kind of kinds) {
                const why: Why = { kind, suit: kind === 'lead' ? null : 'TREF', trump: 'HERC' }
                const line = whyLine(why, catalog)
                expect(line, kind).toMatch(/\S/)
                expect(line, kind).not.toContain('undefined')
            }
        }
    })

    test('firstHandOver: a deal after a scored hand, and nothing else', () => {
        const cases: [GamePhase, number, number, boolean][] = [
            ['BIDDING', 0, 0, false],
            ['PLAYING', 0, 0, false],
            // the hand result and its 10-s window: seen first
            ['HAND_COMPLETE', 162, 0, false],
            ['BIDDING', 162, 70, true],
            ['PLAYING', 0, 232, true],
            ['DECLARATIONS', 100, 80, true],
            // the board's own end sheet takes these
            ['COMPLETED', 1001, 500, false],
            ['CANCELLED', 300, 0, false],
        ]
        for (const [gameState, teamAScore, teamBScore, over] of cases) {
            expect(firstHandOver(pub({ gameState, teamAScore, teamBScore })), `${gameState} ${teamAScore}–${teamBScore}`).toBe(over)
        }
        expect(gameOver(pub({ gameState: 'COMPLETED' }))).toBe(true)
        expect(gameOver(pub({ gameState: 'CANCELLED' }))).toBe(true)
        expect(gameOver(pub({ gameState: 'HAND_COMPLETE' }))).toBe(false)
        expect(gameOver(pub({ gameState: 'BIDDING' }))).toBe(false)
    })

    test("mustCall: the dealer after three passes, as the board's dealerMustCall", () => {
        const passes = (n: number): GameBid[] => ['alice', 'bob', 'dave'].slice(0, n).map((playerId) => ({ playerId, action: 'PASS', selectedTrump: null }))
        const bidding = (bids: GameBid[], yourTurn: boolean): PrivateGameView => ({
            publicPart: pub({ gameState: 'BIDDING', bids, currentTrick: { leadPlayerId: '_NO_LEAD_', trump: null, plays: {} } }),
            hand: [T7, HA], yourTurn, challengeUsed: false,
        })
        expect(mustCall(bidding(passes(3), true))).toBe(true)
        expect(mustCall(bidding(passes(2), true))).toBe(false)
        expect(mustCall(bidding(passes(3), false))).toBe(false)
        expect(mustCall(null)).toBe(false)
    })
})
