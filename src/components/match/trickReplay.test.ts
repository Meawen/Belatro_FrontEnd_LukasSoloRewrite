import { describe, test, expect } from 'vitest'
import { replayColumns, replayTricks, teamOfPlayer } from './trickReplay'
import type { HandDTO, MoveDTO, TrickDTO } from '../../types/match'

// Seat (turn) order A1, B1, A2, B2: ana, cy, bob, dan
const MATCH = {
    teamA: [{ id: 'u1', username: 'ana' }, { id: 'u2', username: 'bob' }],
    teamB: [{ id: 'u3', username: 'cy' }, { id: 'u4', username: 'dan' }],
}

let order = 0
const move = (player: string, card: string, legal: boolean | null = true): MoveDTO => ({ order: ++order, player, card, legal })
const trick = (trickNo: number, winnerId: string | null, ...moves: MoveDTO[]): TrickDTO => ({ trickNo, winnerId, points: 0, moves, lastTrickBonus: false })
const hand = (tricks: TrickDTO[], trump = 'HERC'): HandDTO => ({
    handNo: 1, trumpCalls: [{ order: 1, player: 'cy', trump: 'PASS' }, { order: 2, player: 'bob', trump }], tricks, challenges: [], handSummary: null,
})

// bob leads the first trick: bob, dan, ana, cy
const FIRST = trick(1, 'ana', move('bob', 'SEDMICA of PIK'), move('dan', 'OSMICA of PIK'), move('ana', 'AS of PIK'), move('cy', 'KRALJ of PIK'))

describe('replayColumns (spec §4.9 item 6; §7.2 trick-column order)', () => {
    test('the cyclic play order of the hand’s first complete trick, rotated to start with me', () => {
        const players = (me: string | null) => replayColumns(hand([FIRST]), MATCH, me).map((column) => column.player)
        expect(players('ana')).toEqual(['ana', 'cy', 'bob', 'dan'])
        expect(players('dan')).toEqual(['dan', 'ana', 'cy', 'bob'])
    })

    test('a partial first trick does not count: the first complete one sets the order', () => {
        const short = trick(1, null, move('cy', 'AS of KARA'), move('bob', 'DESETKA of KARA'))
        expect(replayColumns(hand([short, FIRST]), MATCH, 'ana').map((column) => column.player)).toEqual(['ana', 'cy', 'bob', 'dan'])
    })

    test('without a complete trick: A1, B1, A2, B2, still starting with me; someone else’s match keeps its order', () => {
        const short = trick(1, null, move('cy', 'AS of KARA'), move('bob', 'DESETKA of KARA'))
        expect(replayColumns(hand([short]), MATCH, 'bob').map((column) => column.player)).toEqual(['bob', 'dan', 'ana', 'cy'])
        expect(replayColumns(hand([short]), MATCH, 'zed').map((column) => column.player)).toEqual(['ana', 'cy', 'bob', 'dan'])
        expect(replayColumns(hand([FIRST]), MATCH, null).map((column) => column.player)).toEqual(['bob', 'dan', 'ana', 'cy'])
    })

    test('each column knows its team and whether it is me', () => {
        expect(replayColumns(hand([FIRST]), MATCH, 'ana')).toEqual([
            { player: 'ana', team: 'A', me: true },
            { player: 'cy', team: 'B', me: false },
            { player: 'bob', team: 'A', me: false },
            { player: 'dan', team: 'B', me: false },
        ])
        expect(teamOfPlayer(MATCH, 'nobody')).toBeNull()
    })
})

describe('replayTricks (spec §4.9 item 6; ACs 4, 5, 9)', () => {
    test('each card in its player’s column with its play order; a partial trick leaves empty cells', () => {
        const h = hand([FIRST, trick(2, null, move('cy', 'SEDMICA of TREF'), move('bob', 'AS of TREF'))])
        const [first, second] = replayTricks(h, replayColumns(h, MATCH, 'ana'))
        expect(first.cells.map((cell) => cell && [cell.player, cell.id, cell.order])).toEqual([
            ['ana', 'PIK-AS', 3], ['cy', 'PIK-KRALJ', 4], ['bob', 'PIK-SEDMICA', 1], ['dan', 'PIK-OSMICA', 2],
        ])
        expect(first).toMatchObject({ trickNo: 1, cards: 4, partial: false })
        expect(second.cells.map((cell) => cell && cell.order)).toEqual([null, 1, 2, null])
        expect(second).toMatchObject({ trickNo: 2, cards: 2, partial: true })
    })

    test('a trump card is marked; only legal === false is illegal (R-16)', () => {
        const h = hand([trick(1, 'bob', move('bob', 'DECKO of HERC', false), move('dan', 'AS of HERC', null), move('ana', 'AS of PIK', true), move('cy', 'KRALJ of PIK', null))])
        const [only] = replayTricks(h, replayColumns(h, MATCH, 'ana'))
        expect(only.cells.map((cell) => cell && [cell.player, cell.trump, cell.illegal])).toEqual([
            ['ana', false, false], ['cy', false, false], ['bob', true, true], ['dan', true, false],
        ])
    })

    test('the server’s winner is crowned; with winnerId null the trick rule picks it from the four cards and the trump', () => {
        const h = hand([
            // the server says dan, so dan it is
            trick(1, 'dan', move('ana', 'AS of KARA'), move('cy', 'DESETKA of KARA'), move('bob', 'KRALJ of KARA'), move('dan', 'SEDMICA of KARA')),
            // no winnerId (trick 8 before the §6.3 fix): bob's 7 of the trump beats the led ace
            trick(2, null, move('ana', 'AS of TREF'), move('cy', 'DESETKA of TREF'), move('bob', 'SEDMICA of HERC'), move('dan', 'KRALJ of TREF')),
        ])
        const winners = replayTricks(h, replayColumns(h, MATCH, 'ana')).map((t) => t.cells.filter((cell) => cell?.won).map((cell) => cell!.player))
        expect(winners).toEqual([['dan'], ['bob']])
        // without a trump call there is no rule to apply, so no crown
        const noTrump = { ...h, trumpCalls: [] }
        expect(replayTricks(noTrump, replayColumns(noTrump, MATCH, 'ana'))[1].cells.some((cell) => cell?.won)).toBe(false)
    })
})
