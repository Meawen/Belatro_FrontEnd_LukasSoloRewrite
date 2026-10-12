import { describe, test, expect } from 'vitest'
import { BELOT_HOLD_MS, MOMENT_MS, SAY_GAP_MS, belotLine, momentAt, momentKey, momentSrLine, summaryChips } from './declarationMoment'
import type { DeclarationView, Rank, ZvanjaSeatView, ZvanjaView } from '../../../types/game'

const OPENS = 1_000_000
const T0 = OPENS - MOMENT_MS

const seat = (playerId: string, said: number | null, more: Partial<ZvanjaSeatView> = {}): ZvanjaSeatView =>
    ({ playerId, said, kind: null, height: null, declarations: [], cards: [], ...more })
const run = (points: number, top: Rank): DeclarationView => ({ kind: 'RUN', points, suit: 'HERC', top })
const four = (top: Rank): DeclarationView => ({ kind: 'FOUR', points: 100, suit: null, top })
const zvanja = (seats: ZvanjaSeatView[], more: Partial<ZvanjaView> = {}): ZvanjaView =>
    ({ seats, winnerTeam: 'B', total: 20, decidedBy: null, belot: null, playOpensAt: OPENS, ...more })

// the owner's example: ivo (team B) and me (team A) both said 20 up to Baba; ivo is first in turn order
const tied = zvanja([
    seat('ivo', 20, { kind: 'RUN', height: 'BABA', declarations: [run(20, 'BABA')] }),
    seat('mara', null),
    seat('lana', null),
    seat('me', 20, { kind: 'RUN', height: 'BABA' }),
], { winnerTeam: 'B', total: 20, decidedBy: 'ORDER' })
const TIED_SR = 'Declarations: ivo 20 up to Baba, mara nothing, lana nothing, you 20 up to Baba. ivo was first: Team B scores 20.'

// no tie: ivo's 50 wins outright, and with his 20 his team scores 70
const byValue = zvanja([
    seat('ivo', 50, { declarations: [run(50, 'KRALJ'), run(20, 'DESETKA')] }),
    seat('mara', 20),
    seat('lana', null),
    seat('me', null),
], { winnerTeam: 'B', total: 70, decidedBy: 'VALUE' })

describe('the declaration moment (gameplay rules spec §6, D-9, D-14)', () => {
    test('the timeline: seats speak 0.6 s apart from T0, the heights at 2600, the winner at 3400, closed at playOpensAt', () => {
        expect(MOMENT_MS).toBe(5000)
        expect(SAY_GAP_MS).toBe(600)
        const at = (offset: number) => momentAt(tied, 'me', T0 + offset)!
        expect(at(0)).toEqual({
            step: 'saying', bubbles: { ivo: '20', mara: null, lana: null, me: null }, line: null, srLine: TIED_SR, showCards: false,
        })
        expect(Object.keys(at(0).bubbles)).toEqual(['ivo', 'mara', 'lana', 'me'])
        expect(at(599).bubbles).toEqual({ ivo: '20', mara: null, lana: null, me: null })
        expect(at(600).bubbles).toEqual({ ivo: '20', mara: '–', lana: null, me: null })
        expect(at(1200).bubbles).toEqual({ ivo: '20', mara: '–', lana: '–', me: null })
        expect(at(1800).bubbles).toEqual({ ivo: '20', mara: '–', lana: '–', me: '20' })
        expect(at(2599)).toMatchObject({ step: 'saying', line: null })
        const heights = { ivo: '20 · up to Baba', mara: '–', lana: '–', me: '20 · up to Baba' }
        expect(at(2600)).toEqual({ step: 'heights', bubbles: heights, line: null, srLine: TIED_SR, showCards: false })
        expect(at(3399).step).toBe('heights')
        expect(at(3400)).toEqual({
            step: 'winner', bubbles: heights, line: 'ivo was first: Team B scores 20', srLine: TIED_SR, showCards: false,
        })
        expect(at(MOMENT_MS - 1).step).toBe('winner')
        const closed = { step: 'closed', bubbles: { ivo: null, mara: null, lana: null, me: null }, line: null, srLine: TIED_SR, showCards: true }
        expect(at(MOMENT_MS)).toEqual(closed)
        expect(at(MOMENT_MS + 60_000)).toEqual(closed)
    })

    test('a clock before T0 (skew) shows the saying step with every bubble null', () => {
        expect(momentAt(tied, 'me', T0 - 1)).toEqual({
            step: 'saying', bubbles: { ivo: null, mara: null, lana: null, me: null }, line: null, srLine: TIED_SR, showCards: false,
        })
    })

    test('without heights the winner step starts at T0 + 2600; a winning seat with two declarations then shows "50 + 20"', () => {
        expect(momentAt(byValue, 'me', T0 + 2599)).toMatchObject({
            step: 'saying', bubbles: { ivo: '50', mara: '20', lana: '–', me: '–' }, line: null,
        })
        expect(momentAt(byValue, 'me', T0 + 2600)).toEqual({
            step: 'winner',
            bubbles: { ivo: '50 + 20', mara: '20', lana: '–', me: '–' },
            line: 'Team B scores 70',
            srLine: 'Declarations: ivo 50, mara 20, lana nothing, you nothing. Team B scores 70.',
            showCards: false,
        })
    })

    test('a lone declaration (decidedBy null) names only the team', () => {
        const lone = zvanja([seat('ivo', null), seat('me', 20, { declarations: [run(20, 'AS')] }), seat('mara', null), seat('lana', null)],
            { winnerTeam: 'A', total: 20, decidedBy: null })
        expect(momentAt(lone, 'me', T0 + 2600)!.line).toBe('Team A scores 20')
        expect(momentAt(lone, 'me', T0)!.srLine).toBe('Declarations: ivo nothing, you 20, mara nothing, lana nothing. Team A scores 20.')
    })

    test('HEIGHT: "ivo\'s is higher", or "Yours is higher" when I won', () => {
        const height = (winner: 'ivo' | 'me') => zvanja([
            seat('ivo', 20, { kind: 'RUN', height: winner === 'ivo' ? 'AS' : 'BABA', declarations: winner === 'ivo' ? [run(20, 'AS')] : [] }),
            seat('mara', null),
            seat('lana', null),
            seat('me', 20, { kind: 'RUN', height: winner === 'me' ? 'AS' : 'BABA', declarations: winner === 'me' ? [run(20, 'AS')] : [] }),
        ], { winnerTeam: winner === 'ivo' ? 'B' : 'A', total: 20, decidedBy: 'HEIGHT' })
        const theirs = momentAt(height('ivo'), 'me', T0 + 3400)!
        expect(theirs.line).toBe("ivo's is higher: Team B scores 20")
        expect(theirs.bubbles).toEqual({ ivo: '20 · up to As', mara: '–', lana: '–', me: '20 · up to Baba' })
        expect(theirs.srLine).toBe("Declarations: ivo 20 up to As, mara nothing, lana nothing, you 20 up to Baba. ivo's is higher: Team B scores 20.")
        const mine = momentAt(height('me'), 'me', T0 + 3400)!
        expect(mine.line).toBe('Yours is higher: Team A scores 20')
        expect(mine.srLine).toBe('Declarations: ivo 20 up to Baba, mara nothing, lana nothing, you 20 up to As. Yours is higher: Team A scores 20.')
    })

    test('FOUR: the four\'s seat says "four Asovi"; "mara\'s four beats the run", or "Your four beats the run"', () => {
        const fourOverRun = (holder: 'mara' | 'me') => zvanja([
            seat('ivo', 100, { kind: 'RUN', height: 'AS' }),
            seat('mara', holder === 'mara' ? 100 : null, holder === 'mara' ? { kind: 'FOUR', height: 'AS', declarations: [four('AS')] } : {}),
            seat('lana', null),
            seat('me', holder === 'me' ? 100 : null, holder === 'me' ? { kind: 'FOUR', height: 'AS', declarations: [four('AS')] } : {}),
        ], { winnerTeam: 'A', total: 100, decidedBy: 'FOUR' })
        const theirs = momentAt(fourOverRun('mara'), 'me', T0 + 3400)!
        expect(theirs.bubbles).toEqual({ ivo: '100 · up to As', mara: '100 · four Asovi', lana: '–', me: '–' })
        expect(theirs.line).toBe("mara's four beats the run: Team A scores 100")
        expect(theirs.srLine).toBe(
            "Declarations: ivo 100 up to As, mara 100 four Asovi, lana nothing, you nothing. mara's four beats the run: Team A scores 100.")
        const mine = momentAt(fourOverRun('me'), 'me', T0 + 3400)!
        expect(mine.line).toBe('Your four beats the run: Team A scores 100')
        expect(mine.srLine).toBe('Declarations: ivo 100 up to As, mara nothing, lana nothing, you 100 four Asovi. Your four beats the run: Team A scores 100.')
    })

    test('ORDER when I was first: "You were first"', () => {
        expect(momentAt(tied, 'ivo', T0 + 3400)!.line).toBe('You were first: Team B scores 20')
        expect(momentAt(tied, 'ivo', T0)!.srLine)
            .toBe('Declarations: you 20 up to Baba, mara nothing, lana nothing, me 20 up to Baba. You were first: Team B scores 20.')
    })

    test('only partners tie (D-20): no heights, no heights step, and the plain line', () => {
        // ivo and lana (team B) both said 50, lana's up to As the higher; my team said 20 or nothing: the server sends
        // no kind or height, and decidedBy against the strongest opponent seat (VALUE), or null when it said nothing
        const partners = (mine: number | null) => zvanja([
            seat('ivo', 50, { declarations: [run(50, 'BABA')] }),
            seat('mara', null),
            seat('lana', 50, { declarations: [run(50, 'AS')] }),
            seat('me', mine),
        ], { winnerTeam: 'B', total: 100, decidedBy: mine === null ? null : 'VALUE', winnerId: 'lana' })
        for (const [mine, me] of [[20, '20'], [null, '–']] as const) {
            const view = partners(mine)
            expect(momentAt(view, 'me', T0 + 2599)!.step).toBe('saying')
            expect(momentAt(view, 'me', T0 + 2600)).toEqual({
                step: 'winner',
                bubbles: { ivo: '50', mara: '–', lana: '50', me },
                line: 'Team B scores 100',
                srLine: `Declarations: ivo 50, mara nothing, lana 50, you ${mine ?? 'nothing'}. Team B scores 100.`,
                showCards: false,
            })
        }
    })

    test('partners both at the top value with different heights: the winner is winnerId (A2), not the first of them', () => {
        // A1 20 up to Baba, B1 20 up to Kralj, A2 20 up to As: A2's beats B1's (HEIGHT), and team A scores both 20s
        const view = zvanja([
            seat('A1', 20, { kind: 'RUN', height: 'BABA', declarations: [run(20, 'BABA')] }),
            seat('B1', 20, { kind: 'RUN', height: 'KRALJ' }),
            seat('A2', 20, { kind: 'RUN', height: 'AS', declarations: [run(20, 'AS')] }),
            seat('B2', null),
        ], { winnerTeam: 'A', total: 40, decidedBy: 'HEIGHT', winnerId: 'A2' })
        const theirs = momentAt(view, 'B2', T0 + 3400)!
        expect(theirs.bubbles).toEqual({ A1: '20 · up to Baba', B1: '20 · up to Kralj', A2: '20 · up to As', B2: '–' })
        expect(theirs.line).toBe("A2's is higher: Team A scores 40")
        expect(theirs.srLine).toBe(
            "Declarations: A1 20 up to Baba, B1 20 up to Kralj, A2 20 up to As, you nothing. A2's is higher: Team A scores 40.")
        expect(momentAt(view, 'A2', T0 + 3400)!.line).toBe('Yours is higher: Team A scores 40')
        expect(momentAt(view, 'A1', T0 + 3400)!.line).toBe("A2's is higher: Team A scores 40")
    })

    test('an older backend (no winnerId): the first winning seat at the top value, as before', () => {
        expect(tied).not.toHaveProperty('winnerId')
        expect(momentAt(tied, 'me', T0 + 3400)!.line).toBe('ivo was first: Team B scores 20')
        expect(momentAt({ ...tied, winnerId: null }, 'me', T0 + 3400)!.line).toBe('ivo was first: Team B scores 20')
        const height = zvanja([
            seat('ivo', 20, { kind: 'RUN', height: 'AS', declarations: [run(20, 'AS')] }), seat('mara', 20, { kind: 'RUN', height: 'BABA' }),
        ], { winnerTeam: 'B', total: 20, decidedBy: 'HEIGHT' })
        expect(momentAt(height, 'me', T0 + 3400)!.line).toBe("ivo's is higher: Team B scores 20")
    })

    test('a four names its rank in the plural', () => {
        const plural: [Rank, string][] = [
            ['DECKO', 'Decki'], ['DEVETKA', 'Devetke'], ['AS', 'Asovi'], ['DESETKA', 'Desetke'], ['KRALJ', 'Kralji'], ['BABA', 'Babe'],
        ]
        for (const [rank, label] of plural) {
            const view = zvanja([seat('ivo', 100, { kind: 'FOUR', height: rank, declarations: [four(rank)] }), seat('mara', 100, { kind: 'RUN', height: 'AS' })],
                { total: 100, decidedBy: 'FOUR' })
            expect(momentAt(view, 'me', T0 + 2600)!.bubbles.ivo).toBe(`100 · four ${label}`)
        }
    })

    test('a winning seat with two declarations shows them from the winner step, even after its height', () => {
        const view = zvanja([
            seat('ivo', 50, { kind: 'RUN', height: 'KRALJ', declarations: [run(50, 'KRALJ'), run(20, 'DESETKA')] }),
            seat('mara', 50, { kind: 'RUN', height: 'BABA' }),
            seat('lana', null),
            seat('me', null),
        ], { total: 70, decidedBy: 'HEIGHT' })
        expect(momentAt(view, 'me', T0 + 3399)!.bubbles.ivo).toBe('50 · up to Kralj')
        expect(momentAt(view, 'me', T0 + 3400)!.bubbles).toEqual({ ivo: '50 + 20', mara: '50 · up to Baba', lana: '–', me: '–' })
    })

    test('nothing to say: no zvanja, no playOpensAt, or a belot', () => {
        expect(momentAt(null, 'me', T0)).toBeNull()
        expect(momentAt({ ...tied, playOpensAt: null }, 'me', T0 + 3400)).toBeNull()
        expect(momentAt(zvanja([seat('ivo', null), seat('me', null)], { winnerTeam: null, total: 0, playOpensAt: null }), 'me', T0)).toBeNull()
        const belot = zvanja([seat('ivo', null), seat('me', null)], { total: 0, belot: { playerId: 'ivo', suit: 'PIK' }, playOpensAt: null })
        expect(momentAt(belot, 'me', T0)).toBeNull()
        expect(momentAt(belot, 'me', T0, true)).toBeNull()
    })

    test('a snapshot during the wait shows the end state (all said, the line up); after it, only the closed state', () => {
        const end = momentAt(tied, 'me', T0 + 3400)
        expect(momentAt(tied, 'me', T0 + 100, true)).toEqual(end)
        expect(momentAt(tied, 'me', T0 - 2000, true)).toEqual(end)
        expect(momentAt(tied, 'me', OPENS - 1, true)).toEqual(end)
        expect(momentAt(tied, 'me', OPENS, true)).toEqual(momentAt(tied, 'me', OPENS))
        expect(momentAt(tied, 'me', OPENS, true)!.step).toBe('closed')
        expect(momentAt(byValue, 'me', T0, true)).toEqual(momentAt(byValue, 'me', T0 + 2600))
    })
})

describe('summaryChips', () => {
    test('each winning seat keeps its values for the rest of the hand', () => {
        expect(summaryChips(byValue)).toEqual({ ivo: 'Zvanja 50 + 20' })
        expect(summaryChips(tied)).toEqual({ ivo: 'Zvanja 20' })
        const partners = zvanja([
            seat('ivo', 50, { declarations: [run(50, 'AS')] }), seat('mara', null), seat('lana', 20, { declarations: [run(20, 'DECKO')] }), seat('me', null),
        ], { total: 70, decidedBy: 'VALUE' })
        expect(summaryChips(partners)).toEqual({ ivo: 'Zvanja 50', lana: 'Zvanja 20' })
    })

    test('nobody won: no chips', () => {
        expect(summaryChips(null)).toEqual({})
        expect(summaryChips(zvanja([seat('ivo', null), seat('me', null)], { winnerTeam: null, total: 0, playOpensAt: null }))).toEqual({})
        expect(summaryChips(zvanja([seat('ivo', null), seat('me', null)], { total: 0, belot: { playerId: 'ivo', suit: 'PIK' }, playOpensAt: null })))
            .toEqual({})
    })
})

describe('belotLine', () => {
    const belot = zvanja([seat('ivo', null), seat('mara', null), seat('lana', null), seat('me', null)],
        { winnerTeam: 'B', total: 0, belot: { playerId: 'ivo', suit: 'PIK' }, playOpensAt: null })

    test('names the holder and the suit, or "You hold" for me', () => {
        expect(belotLine(belot, 'me')).toBe('Belot! ivo holds all eight Pik')
        expect(belotLine(belot, 'ivo')).toBe('Belot! You hold all eight Pik')
        expect(belotLine({ ...belot, belot: { playerId: 'me', suit: 'KARA' } }, 'me')).toBe('Belot! You hold all eight Karo')
    })

    test('null without a belot', () => {
        expect(belotLine(null, 'me')).toBeNull()
        expect(belotLine(tied, 'me')).toBeNull()
    })
})

describe('the board\'s moment per hand: momentKey, momentSrLine', () => {
    const belot = zvanja([seat('ivo', null), seat('me', null)], { total: 0, belot: { playerId: 'ivo', suit: 'PIK' }, playOpensAt: null })

    test('a key per wait (its playOpensAt) or per belot; none without either', () => {
        expect(momentKey(tied, OPENS)).toBe(`opens:${OPENS}`)
        expect(momentKey(tied, OPENS + 1)).not.toBe(momentKey(tied, OPENS))
        // the model's playOpensAt is null outside PLAYING: no moment
        expect(momentKey(tied, null)).toBeNull()
        expect(momentKey(null, null)).toBeNull()
        expect(momentKey(belot, null)).toBe('belot:ivo:PIK')
        expect(BELOT_HOLD_MS).toBe(4000)
    })

    test('the live region\'s line: the whole moment while it runs (or from a snapshot), the belot line; nothing once closed', () => {
        expect(momentSrLine(tied, 'me', T0, false)).toBe(TIED_SR)
        expect(momentSrLine(tied, 'me', OPENS - 1, true)).toBe(TIED_SR)
        expect(momentSrLine(tied, 'me', OPENS, true)).toBeNull()
        expect(momentSrLine(null, 'me', T0, false)).toBeNull()
        expect(momentSrLine(belot, 'me', T0, true)).toBe('Belot! ivo holds all eight Pik')
    })
})
