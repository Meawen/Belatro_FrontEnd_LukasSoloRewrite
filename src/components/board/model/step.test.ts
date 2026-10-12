import { describe, test, expect } from 'vitest'
import { stepBoard } from './step'
import { EMPTY_LOCAL, type BoardLocal, type BoardModel } from './boardModel'
import { pressCard } from './input'
import type { BoardState } from './accept'
import { indexOf, playTable, type FanOut } from '../../../test/fixtures/views/table'

const stateOf = (f: FanOut, source: BoardState['source'] = 'live'): BoardState =>
    ({ publicView: f.private.carol.publicPart, privateView: f.private.carol, receivedAt: f.at, skew: 0, source })

function replay(fanOuts: readonly FanOut[], from = 0, local: BoardLocal = EMPTY_LOCAL, prev: BoardModel | null = null) {
    const steps = []
    for (const f of fanOuts.slice(from)) {
        const step = stepBoard(prev, stateOf(f), 'carol', local, f.at)
        steps.push(step)
        prev = step.model
        local = step.local
    }
    return steps
}

describe('stepBoard', () => {
    test('a live state animates from the previous model; a snapshot snaps', () => {
        const table = playTable()
        const first = stepBoard(null, stateOf(table[0]), 'carol', EMPTY_LOCAL, 0)
        expect(first.events).toEqual([{ type: 'Dealt', dealerId: 'dave', order: ['alice', 'bob', 'carol', 'dave'] }])
        const snap = stepBoard(first.model, stateOf(table[20], 'snapshot'), 'carol', first.local, 0)
        expect(snap.events).toBeNull()
        expect(snap.local.order).toEqual(snap.model.order)
    })

    test('without tricksWonA/B the piles count completions, reset at the deal, and hide after a snapshot mid-hand', () => {
        const old = playTable({ fields: false, hands: 2 })
        const steps = replay(old)
        const handEnd = indexOf(old, 'hand-complete')
        const piles = steps[handEnd].model.piles!
        expect(piles.a + piles.b).toBe(8)
        expect(steps[indexOf(old, 'next-deal')].model.piles).toEqual({ a: 0, b: 0 })
        const midHand = indexOf(old, 'play:', indexOf(old, 'call:') + 12)
        const snapped = stepBoard(steps[2].model, stateOf(old[midHand], 'snapshot'), 'carol', steps[2].local, 0)
        expect(snapped.model.piles).toBeNull()
        const call = indexOf(old, 'call:')
        expect(stepBoard(null, stateOf(old[call], 'snapshot'), 'carol', EMPTY_LOCAL, 0).model.piles).toEqual({ a: 0, b: 0 })
    })

    test('the input settles with the new state: my pending card stops pending once it is on the table', () => {
        const table = playTable()
        const myTurn = indexOf(table, 'play:carol:') - 1
        const before = replay(table.slice(0, myTurn + 1)).pop()!
        const press = pressCard(before.model, before.local.input, table[myTurn + 1].label.split(':')[2], table[myTurn].at)
        const after = stepBoard(before.model, stateOf(table[myTurn + 1]), 'carol', { ...before.local, input: press.input }, table[myTurn + 1].at)
        expect(after.local.input.pending).toBeNull()
        expect(after.events![0]).toMatchObject({ type: 'CardPlayed', mine: true })
    })
})
