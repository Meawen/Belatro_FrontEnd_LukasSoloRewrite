import { describe, test, expect } from 'vitest'
import { diffBoard, type BoardEvent } from './diffBoard'
import { EMPTY_LOCAL, boardModel, type BoardLocal, type BoardModel } from './boardModel'
import { NOTHING_ACCEPTED, acceptFrame, type Accepted } from './accept'
import { deliveries, duplicated, indexOf, playTable, staleRedelivery, type FanOut } from '../../../test/fixtures/views/table'
import type { PrivateGameView, PublicGameView } from '../../../types/game'

const table = playTable()

/** carol's model of every fan-out, threading the frozen hand order as the board does. */
function models(fanOuts: readonly FanOut[], me = 'carol'): BoardModel[] {
    let local: BoardLocal = EMPTY_LOCAL
    return fanOuts.map((f) => {
        const m = boardModel({ publicView: f.private[me].publicPart, privateView: f.private[me], receivedAt: f.at, skew: 0, source: 'live' }, me, local)
        local = { ...local, order: m.order }
        return m
    })
}
const all = models(table)
const types = (events: BoardEvent[] | null) => events?.map((e) => e.type) ?? null
const at = (label: string, from = 0) => indexOf(table, label, from)

/** One model from a hand-made change to a fan-out's view. */
function edited(i: number, change: (pub: PublicGameView, priv: PrivateGameView) => void, me = 'carol'): BoardModel {
    const priv = structuredClone(table[i].private[me])
    change(priv.publicPart, priv)
    return boardModel({ publicView: priv.publicPart, privateView: priv, receivedAt: 0, skew: 0, source: 'live' }, me, { ...EMPTY_LOCAL, order: all[i].order })
}

describe('diffBoard (spec §5.3.4)', () => {
    test('a duplicate (the TS and CTL frames of one action) animates nothing', () => {
        const i = at('play:')
        expect(table[i + 1].label).toBe(table[i].label)
        expect(diffBoard(all[i], all[i + 1])).toEqual([])
    })

    test('a new deal: Dealt from the dealer in turn order from the first bidder; the last trick leaves first', () => {
        expect(diffBoard(null, all[0])).toEqual([{ type: 'Dealt', dealerId: 'dave', order: ['alice', 'bob', 'carol', 'dave'] }])
        const next = at('next-deal')
        expect(diffBoard(all[next - 1], all[next])).toEqual([
            { type: 'TrickCollected', winnerTeam: all[next - 1].trick!.winnerTeam, cards: all[next - 1].trick!.plays.map((p) => p.id) },
            { type: 'Dealt', dealerId: 'alice', order: ['bob', 'carol', 'dave', 'alice'] },
            { type: 'Turn', playerId: 'bob' },
        ])
    })

    test('bids grew: a Bid at the seat, and the turn moves', () => {
        const i = at('bid:alice:PASS')
        expect(diffBoard(all[i - 1], all[i])).toEqual([{ type: 'Bid', playerId: 'alice', call: 'PASS' }, { type: 'Turn', playerId: 'bob' }])
    })

    test('the trump appears: the call, TrumpCalled with the caller and the dealer, +2 cards, the declarations', () => {
        const i = at('call:')
        const events = diffBoard(all[i - 1], all[i])!
        expect(events.slice(0, 2)).toEqual([
            { type: 'Bid', playerId: 'dave', call: 'HERC' },
            { type: 'TrumpCalled', suit: 'HERC', playerId: 'dave', dealerId: 'dave' },
        ])
        const declared = all[i].seats.filter((s) => s.zvanja.length > 0).map((s) => s.id)
        if (declared.length) expect(events).toContainEqual({ type: 'Declared', playerIds: declared })
        expect(all[i].hand).toHaveLength(8)
    })

    test("an opponent's card and my card: CardPlayed, mine only for my own", () => {
        const theirs = at('play:alice:')
        expect(diffBoard(all[theirs - 1], all[theirs])![0]).toMatchObject({ type: 'CardPlayed', playerId: 'alice', mine: false, recovered: false })
        const mine = at('play:carol:')
        const events = diffBoard(all[mine - 1], all[mine])!
        expect(events[0]).toMatchObject({ type: 'CardPlayed', playerId: 'carol', id: table[mine].label.split(':')[2], mine: true })
        expect(all[mine].hand).toHaveLength(all[mine - 1].hand.length - 1)
    })

    test('the 4th card: TrickCompleted with the winner; the next lead collects the trick at once', () => {
        const fourth = at('call:') + 9
        const completed = diffBoard(all[fourth - 1], all[fourth])!
        expect(types(completed)).toEqual(['CardPlayed', 'TrickCompleted', 'Turn'].filter((t) => t !== 'Turn' || all[fourth - 1].turn!.playerId !== all[fourth].turn!.playerId))
        expect(completed[1]).toMatchObject({ type: 'TrickCompleted', winnerId: table[fourth].public.lastTrick!.winnerId, recovered: false })
        const lead = diffBoard(all[fourth], all[fourth + 2])!
        expect(types(lead)).toEqual(['TrickCollected', 'CardPlayed', 'Turn'])
    })

    test('the 4-card view missed: the 4th card is recovered from lastTrick, completed and collected; without lastTrick it snaps', () => {
        const fourth = at('call:') + 9
        const events = diffBoard(all[fourth - 2], all[fourth + 2])!
        expect(types(events)).toEqual(['CardPlayed', 'TrickCompleted', 'TrickCollected', 'CardPlayed', 'Turn'])
        expect(events[0]).toMatchObject({ recovered: true })
        expect(events[1]).toMatchObject({ recovered: true, winnerId: table[fourth].public.lastTrick!.winnerId })
        const old = models(playTable({ fields: false }))
        expect(diffBoard(old[fourth - 2], old[fourth + 2])).toBeNull()
    })

    test('HAND_COMPLETE: the 8th card, its trick, HandCompleted with the score change, Scored, nobody to act', () => {
        const i = at('hand-complete')
        const events = diffBoard(all[i - 1], all[i])!
        expect(types(events)).toEqual(['CardPlayed', 'TrickCompleted', 'HandCompleted', 'Scored', 'Turn'])
        expect(events[2]).toEqual({
            type: 'HandCompleted',
            delta: { a: all[i].scores.a - all[i - 1].scores.a, b: all[i].scores.b - all[i - 1].scores.b },
        })
        expect(events[4]).toEqual({ type: 'Turn', playerId: null })
        // the window opening and closing are clock changes only
        expect(diffBoard(all[i], all[i + 1])).toEqual([])
        expect(diffBoard(all[i + 2], all[at('window-close')])).toEqual([])
    })

    test('bela and the end of the game', () => {
        const i = at('play:bob:')
        expect(diffBoard(all[i], edited(i, (pub) => { pub.belaDeclaredByPlayer.bob = true }))).toEqual([{ type: 'Bela', playerId: 'bob' }])
        const decided = playTable({ scores: [990, 900] })
        const end = models(decided)
        expect(types(diffBoard(end[end.length - 3], end[end.length - 2]))).toEqual(['Ended'])
        expect(diffBoard(end[end.length - 2], end[end.length - 1])).toEqual([])
        const cancelled = edited(i, (pub) => { pub.gameState = 'CANCELLED'; pub.endReason = 'FORFEIT'; pub.forfeitTeamId = 'B' })
        expect(types(diffBoard(all[i], cancelled))).toEqual(['Ended'])
    })

    test("challenges: a seat's flag alone → ChallengeFailed for that seat; the hand ending early, or HAND_COMPLETE scores moving → ChallengeUpheld", () => {
        const i = at('play:bob:')
        expect(diffBoard(all[i], edited(i, (pub, priv) => { priv.challengeUsed = true; pub.challengeUsedByPlayer.carol = true })))
            .toEqual([{ type: 'ChallengeFailed', playerId: 'carol', mine: true }])
        expect(diffBoard(all[i], edited(i, (pub) => { pub.challengeUsedByPlayer.bob = true })))
            .toEqual([{ type: 'ChallengeFailed', playerId: 'bob', mine: false }])
        const next = at('next-deal')
        const early = diffBoard(all[i], all[next])!
        expect(early[0]).toEqual({ type: 'ChallengeUpheld', team: all[next].scores.a - all[i].scores.a > all[next].scores.b - all[i].scores.b ? 'A' : 'B' })
        expect(types(early)).toContain('Dealt')
        const hc = at('window-open')
        const upheld = edited(hc, (pub) => { pub.teamBScore += 182 })
        expect(diffBoard(all[hc], upheld)).toEqual([
            { type: 'ChallengeUpheld', team: 'B' },
            { type: 'Scored', from: all[hc].scores, to: { a: all[hc].scores.a, b: all[hc].scores.b + 182 } },
        ])
    })

    test('unexplainable → null (snap): cards vanish from the trick, my hand loses two cards, the seats change', () => {
        const third = at('call:') + 7
        expect(all[third].trick!.plays).toHaveLength(3)
        expect(diffBoard(all[third], edited(third, (pub) => { pub.currentTrick!.plays = {} }))).toBeNull()
        const mine = at('play:carol:')
        expect(diffBoard(all[mine - 1], edited(mine, (_pub, priv) => { priv.hand = priv.hand.slice(1) }))).toBeNull()
        expect(diffBoard(all[mine], edited(mine, (pub) => { pub.seatingOrder = pub.seatingOrder.map((s) => (s.id === 'dave' ? { ...s, id: 'zoe' } : s)) }))).toBeNull()
    })

    test('a whole hand through acceptance, with duplicates, stale re-deliveries and both arrival orders: never a snap, every card once', () => {
        const stream = staleRedelivery(duplicated(deliveries(table, 'carol')), 3)
        let accepted: Accepted = NOTHING_ACCEPTED
        let local: BoardLocal = EMPTY_LOCAL
        let prev: BoardModel | null = null
        const events: BoardEvent[] = []
        stream.forEach((d, n) => {
            const next = acceptFrame(accepted, d.channel === 'public' ? { kind: 'public', view: d.body } : { kind: 'private', view: d.body, source: 'live' }, n)
            if (next === accepted || !next.state?.privateView) {
                accepted = next
                return
            }
            accepted = next
            const model = boardModel(next.state, 'carol', local)
            local = { ...local, order: model.order }
            const diff = diffBoard(prev, model)
            expect(diff).not.toBeNull()
            events.push(...diff!)
            prev = model
        })
        const count = (type: BoardEvent['type']) => events.filter((e) => e.type === type).length
        expect(count('CardPlayed')).toBe(32)
        expect(new Set(events.flatMap((e) => (e.type === 'CardPlayed' ? [e.id] : []))).size).toBe(32)
        expect(count('TrickCompleted')).toBe(8)
        expect([count('Dealt'), count('TrumpCalled'), count('HandCompleted'), count('Bid')]).toEqual([2, 1, 1, 4])
    })
})
