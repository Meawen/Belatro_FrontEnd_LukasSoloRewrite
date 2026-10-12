import { describe, test, expect } from 'vitest'
import { bubbleSpot, seatSpot } from './seatSpot'
import { EMPTY_LOCAL, boardModel } from './model/boardModel'
import { cardTargets, layoutFor } from './model/cardTargets'
import { indexOf, playTable } from '../../test/fixtures/views/table'

// carol's board at the TS frame of the call: alice, her partner, is to lead, so her plate has the turn timer
const table = playTable()
const ts = table[indexOf(table, 'call:') + 1]
const model = boardModel({ publicView: ts.private.carol.publicPart, privateView: ts.private.carol, receivedAt: ts.at, skew: 0, source: 'live' }, 'carol', EMPTY_LOCAL)

describe('bubbleSpot (gameplay rules §6): a bubble by each seat plate', () => {
    test('under the other seats\' plates (and the timer bar of the seat to act), aligned as the plate; over mine', () => {
        for (const viewport of [{ width: 1440, height: 900, dpr: 1 }, { width: 375, height: 812, dpr: 3 }, { width: 812, height: 375, dpr: 3 }]) {
            const layout = layoutFor(viewport)
            const targets = cardTargets(model, layout)
            const [me, right, partner, left] = model.seats
            expect([me.id, right.id, partner.id, left.id]).toEqual(['carol', 'dave', 'alice', 'bob'])
            expect(model.turn).toMatchObject({ playerId: 'alice' })
            const plate = (seat: typeof me) => seatSpot(seat, targets, layout)
            expect(bubbleSpot(me, model, targets, layout)).toEqual({ ...plate(me), top: plate(me).top - 4, transform: 'translateY(-100%)' })
            expect(bubbleSpot(right, model, targets, layout)).toEqual({ ...plate(right), top: plate(right).top + 30 })
            expect(bubbleSpot(left, model, targets, layout)).toEqual({ ...plate(left), top: plate(left).top + 30 })
            expect(bubbleSpot(partner, model, targets, layout)).toEqual({ ...plate(partner), top: plate(partner).top + 37 })
        }
    })
})
