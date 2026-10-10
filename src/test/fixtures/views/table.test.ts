import { describe, test, expect } from 'vitest'
import {
    deliveries, duplicated, find, indexOf, playTable, privateFirst, serverOrder, snapshotJump, staleRedelivery,
} from './table'
import { cardId } from '../../../components/board/model/rules'

describe('playTable: one hand as the server sends it', () => {
    const fanOuts = playTable()

    test('the deal: BIDDING, 6 cards each, alice bids first and dave deals, no trick yet', () => {
        const deal = fanOuts[0]
        expect(deal.label).toBe('deal')
        expect(deal.public.gameState).toBe('BIDDING')
        expect(deal.public.seatingOrder.map((s) => s.id)).toEqual(['alice', 'bob', 'carol', 'dave'])
        expect(deal.public.dealerId).toBe('dave')
        expect(deal.public.currentTrick?.leadPlayerId).toBe('_NO_LEAD_')
        expect(deal.public.lastTrick).toBeNull()
        expect(deal.public.turnExpiresAt).toBeNull()
        expect(fanOuts[1].public.turnExpiresAt).toBe(fanOuts[1].at + 30_000)
        for (const id of ['alice', 'bob', 'carol', 'dave']) expect(deal.private[id].hand).toHaveLength(6)
        expect(deal.private.alice.yourTurn).toBe(true)
        expect(deal.private.bob.yourTurn).toBe(false)
    })

    test('three passes, then the dealer must call; the call deals 2 more each and reveals the declarations', () => {
        expect(fanOuts.filter((f) => f.trigger !== 'CTL').map((f) => f.label).slice(2, 6))
            .toEqual(['bid:alice:PASS', 'bid:bob:PASS', 'bid:carol:PASS', 'call:dave:HERC'])
        const call = find(fanOuts, 'call:')
        expect(call.trigger).toBe('GSC')
        expect(call.public.turnExpiresAt).toBeNull()
        expect(call.public.gameState).toBe('PLAYING')
        expect(call.public.currentTrick).toMatchObject({ leadPlayerId: 'alice', trump: 'HERC', plays: {} })
        for (const id of ['alice', 'bob', 'carol', 'dave']) expect(call.private[id].hand).toHaveLength(8)
        expect(call.public.bids.map((b) => b.action)).toEqual(['PASS', 'PASS', 'PASS', 'CALL_TRUMP'])
    })

    test('32 cards; every 4th shows the completed trick, its winner to act and seatingOrder rotated to them', () => {
        const plays = fanOuts.filter((f) => f.label.startsWith('play:') && f.trigger === 'TS')
        expect(plays).toHaveLength(31)
        for (let n = 3; n < 31; n += 4) {
            const view = plays[n].public
            const winner = view.lastTrick!.winnerId
            expect(Object.keys(view.currentTrick!.plays)).toHaveLength(4)
            expect(view.currentPlayerId).toBe(winner)
            expect(view.seatingOrder[0].id).toBe(winner)
            expect(view.currentTrick!.winningCard).toEqual(view.currentTrick!.plays[winner])
            expect(view.lastTrick!.order[0]).toBe(view.currentTrick!.leadPlayerId)
            expect(plays[n].private[winner].yourTurn).toBe(true)
        }
        const next = plays[4].public
        expect(Object.keys(next.currentTrick!.plays)).toHaveLength(1)
        expect(next.currentTrick!.leadPlayerId).toBe(plays[3].public.lastTrick!.winnerId)
        expect(next.lastTrick).toEqual(plays[3].public.lastTrick)
    })

    test('the 8th card: HAND_COMPLETE with the window null, then set; 8 tricks counted; nobody to act', () => {
        const i = indexOf(fanOuts, 'hand-complete')
        const [first, second, third] = fanOuts.slice(i, i + 3)
        expect(first.public.gameState).toBe('HAND_COMPLETE')
        expect(first.public.challengeWindowExpiresAt).toBeNull()
        expect(second.label).toBe('window-open')
        expect(second.public.challengeWindowExpiresAt).toBe(second.at + 10_000)
        expect(third.trigger).toBe('CTL')
        expect(third.version).toBe(second.version + 1)
        expect(first.public.tricksWonA! + first.public.tricksWonB!).toBe(8)
        expect(first.public.teamAScore + first.public.teamBScore).toBeGreaterThanOrEqual(162)
        expect(first.public.currentPlayerId).toBeNull()
        expect(Object.keys(first.public.currentTrick!.plays)).toHaveLength(4)
        expect(first.private.carol).toMatchObject({ hand: [], yourTurn: false })
    })

    test('the next deal keeps the old trump\'s last trick and the old window on the view', () => {
        const close = find(fanOuts, 'window-close')
        expect(close.public).toMatchObject({ gameState: 'HAND_COMPLETE', challengeWindowExpiresAt: null })
        const next = find(fanOuts, 'next-deal')
        const lastPlay = fanOuts[indexOf(fanOuts, 'hand-complete')].public
        expect(next.public.gameState).toBe('BIDDING')
        expect(next.public.dealerId).toBe('alice')
        expect(next.public.seatingOrder.map((s) => s.id)).toEqual(['bob', 'carol', 'dave', 'alice'])
        expect(next.public.currentTrick).toEqual(lastPlay.currentTrick)
        expect(next.public.challengeWindowExpiresAt).toBe(find(fanOuts, 'window-open').public.challengeWindowExpiresAt)
        expect(next.public).toMatchObject({ bids: [], lastTrick: null, tricksWonA: 0, tricksWonB: 0, declarations: {} })
        expect(next.private.bob.hand).toHaveLength(6)
        expect(fanOuts[fanOuts.length - 1].label).toBe('next-deal')
    })

    test('versions never go down; a version repeats only in the re-broadcasts of one action', () => {
        for (let i = 1; i < fanOuts.length; i++) {
            expect(fanOuts[i].version).toBeGreaterThanOrEqual(fanOuts[i - 1].version)
            if (fanOuts[i].version === fanOuts[i - 1].version) expect(fanOuts[i].label).toBe(fanOuts[i - 1].label)
        }
        expect(fanOuts.every((f) => f.public.stateVersion === f.version && f.private.dave.publicPart.stateVersion === f.version)).toBe(true)
    })

    test("the private hand comes in the server's order, whose suit groups move around during the hand", () => {
        for (const f of fanOuts) expect(f.private.carol.hand).toEqual(serverOrder(f.private.carol.hand))
        const groups = (hand: { boja: string }[]) => [...new Set(hand.map((c) => c.boja))]
        const reordered = fanOuts.some((f, i) => i > 0 && ['alice', 'bob', 'carol', 'dave'].some((id) => {
            const before = groups(fanOuts[i - 1].private[id].hand)
            const after = groups(f.private[id].hand).filter((suit) => before.includes(suit))
            return after.join() !== before.filter((suit) => after.includes(suit)).join()
        }))
        expect(reordered).toBe(true)
    })
})

describe('playTable options', () => {
    test('without the §6.1 fields no view carries them', () => {
        const views = playTable({ fields: false }).flatMap((f) => [f.public, f.private.alice.publicPart])
        for (const key of ['stateVersion', 'lastTrick', 'tricksWonA', 'tricksWonB', 'dealerId', 'serverNow']) {
            expect(views.some((v) => key in v)).toBe(false)
        }
    })

    test('the first bidder can call; two hands; a deciding hand ends COMPLETED after its window', () => {
        expect(find(playTable({ callAt: 0, trump: 'PIK' }), 'call:').label).toBe('call:alice:PIK')
        const two = playTable({ hands: 2 })
        expect(two.filter((f) => f.label === 'hand-complete')).toHaveLength(2)
        const decided = playTable({ scores: [990, 900], target: 1001 })
        const last = decided[decided.length - 1]
        expect(last.label).toBe('game-over')
        expect(last.public).toMatchObject({ gameState: 'COMPLETED', challengeWindowExpiresAt: null })
        expect(last.public.winnerTeamId).toBe(last.public.teamAScore > last.public.teamBScore ? 'A' : 'B')
    })

    test('the same options give the same table', () => {
        expect(playTable({ seed: 3 })).toEqual(playTable({ seed: 3 }))
        expect(playTable({ seed: 3 })[0].private.alice.hand).not.toEqual(playTable({ seed: 4 })[0].private.alice.hand)
    })
})

describe('delivery helpers', () => {
    const fanOuts = playTable().slice(0, 4)

    test('per fan-out the public frame, then the private one; or the other way round', () => {
        expect(deliveries(fanOuts, 'carol').map((d) => d.channel)).toEqual(['public', 'private', 'public', 'private', 'public', 'private', 'public', 'private'])
        expect(deliveries(fanOuts, 'carol')[1].body).toBe(fanOuts[0].private.carol)
        expect(privateFirst(fanOuts, 'carol').map((d) => d.channel).slice(0, 2)).toEqual(['private', 'public'])
    })

    test('duplicates, a stale re-delivery, and a snapshot jump', () => {
        const stream = deliveries(fanOuts, 'carol')
        expect(duplicated(stream)).toHaveLength(16)
        const stale = staleRedelivery(stream, 2)
        expect(stale).toHaveLength(10)
        expect(stale[4]).toBe(stream[1])
        const jump = snapshotJump(playTable(), 'carol', 2, 20)
        expect(jump).toHaveLength(5)
        expect(jump[4]).toEqual({ channel: 'snapshot', body: playTable()[20].private.carol })
    })

    test('labels name the card played, as data-card', () => {
        const play = find(playTable(), 'play:')
        const [, player, id] = play.label.split(':')
        expect(cardId(play.public.currentTrick!.plays[player])).toBe(id)
    })
})
