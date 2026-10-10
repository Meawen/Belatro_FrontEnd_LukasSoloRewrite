import { describe, test, expect } from 'vitest'
import { dropLeaving, emptyStage, landTrick, settleStage, shownPiles, stepStage, sweepHeld, tableTrick, trickKey, withInput, type Stage } from './stage'
import { pressCard, PENDING_MS } from './model/input'
import type { BoardState } from './model/accept'
import { indexOf, playTable, type FanOut } from '../../test/fixtures/views/table'

const table = playTable()
const stateOf = (f: FanOut, source: BoardState['source'] = 'live', me = 'carol'): BoardState =>
    ({ publicView: f.private[me].publicPart, privateView: f.private[me], receivedAt: f.at, skew: 0, source })

/** carol's stage after the fan-outs from..to (inclusive), each as a live state. */
function run(to: number, from = 0, stage: Stage = emptyStage('carol')): Stage {
    for (const f of table.slice(from, to + 1)) stage = stepStage(stage, stateOf(f), f.at)
    return stage
}
const at = (label: string, from = 0) => indexOf(table, label, from)

describe('the stage: holds, sweeps and entrances (spec §5.3.4, §5.5)', () => {
    test('the first live deal: every card exists at once and comes from the dealer, staggered in turn order', () => {
        const stage = run(0)
        expect(stage.deal).toBe(1)
        expect(stage.model!.hand).toHaveLength(6)
        // alice bids first: alice 0, bob 1, carol 2, dave 3 per round, 30 ms apart
        expect(stage.entrances['back:alice:0']).toEqual({ from: 'dave', delay: 0, flip: false, scale: 0.4 })
        expect(stage.entrances['back:bob:0'].delay).toBeCloseTo(0.03)
        expect(stage.entrances[stage.model!.hand[0].id]).toEqual({ from: 'dave', delay: expect.closeTo(0.06), flip: true, scale: 0.4 })
        expect(stage.entrances[stage.model!.hand[5].id].delay).toBeCloseTo((5 * 4 + 2) * 0.03)
        expect(Object.keys(stage.entrances)).toHaveLength(24)
    })

    test('a snapshot snaps: no entrance, no hold, a finished trick already off the table', () => {
        const fourth = at('play:dave:PIK-DESETKA')
        const snap = stepStage(run(5), stateOf(table[fourth], 'snapshot'), 0)
        expect(snap.events).toBeNull()
        expect(snap.entrances).toEqual({})
        expect(snap.held).toBeNull()
        expect(snap.leaving).toEqual([])
        expect(tableTrick(snap)).toBeNull()
        expect(shownPiles(snap)).toEqual({ a: 0, b: 1 })
        const midTrick = stepStage(run(5), stateOf(table[at('play:bob:PIK-BABA')], 'snapshot'), 0)
        expect(tableTrick(midTrick)!.plays).toHaveLength(2)
    })

    test('a finished trick is held, then sweeps to its winner’s pile; the pile counts it once it lands', () => {
        const fourth = at('play:dave:PIK-DESETKA')
        const held = run(fourth)
        expect(held.held!.trick.winnerId).toBe('dave')
        expect(tableTrick(held)!.complete).toBe(true)
        expect(shownPiles(held)).toEqual({ a: 0, b: 0 })
        const swept = sweepHeld(held, held.held!.key)
        expect(swept.held).toBeNull()
        expect(swept.leaving).toEqual([expect.objectContaining({ team: 'B', at: 'pile', deal: 1 })])
        expect(tableTrick(swept)).toBeNull()
        expect(shownPiles(swept)).toEqual({ a: 0, b: 0 })
        const landed = dropLeaving(swept, swept.leaving[0].key)
        expect(shownPiles(landed)).toEqual({ a: 0, b: 1 })
        expect(sweepHeld(landed, 'nothing')).toBe(landed)
    })

    test('the next lead during the hold sweeps at once, and the new card comes in from its seat', () => {
        const lead = at('play:dave:PIK-KRALJ')
        const stage = run(lead)
        expect(stage.held).toBeNull()
        expect(stage.leaving).toEqual([expect.objectContaining({ at: 'pile', team: 'B' })])
        expect(tableTrick(stage)!.plays.map((p) => p.id)).toEqual(['PIK-KRALJ'])
        expect(stage.entrances['PIK-KRALJ']).toEqual({ from: 'dave', delay: 0, flip: true, scale: 0.5 })
    })

    test('a missed 4-card view: the 4th card enters from its seat with the trick, which sweeps once it lands', () => {
        const third = at('play:carol:PIK-OSMICA')
        const before = run(third)
        const after = stepStage(before, stateOf(table[at('play:dave:PIK-KRALJ')]), 0)
        const recovered = after.leaving[0]
        expect(recovered).toMatchObject({ at: 'table', team: 'B', enter: 'PIK-DESETKA' })
        expect(recovered.trick.plays).toHaveLength(4)
        expect(after.entrances['PIK-DESETKA']).toEqual({ from: 'dave', delay: 0, flip: true, scale: 0.5 })
        expect(landTrick(after, recovered.key).leaving[0].at).toBe('pile')
    })

    test('a successful challenge mid-trick: the partial trick fades, then a new deal', () => {
        const midTrick = run(at('play:bob:PIK-BABA'))
        const partial = midTrick.model!.trick!
        const after = stepStage(midTrick, stateOf(table[at('next-deal')]), 0)
        expect(after.events!.map((e) => e.type)).toContain('ChallengeUpheld')
        expect(after.leaving).toEqual([expect.objectContaining({ key: trickKey(partial), team: null, at: 'fade', deal: 1 })])
        expect(after.deal).toBe(2)
        expect(after.cleared).toEqual([])
    })

    test('the trump call brings two cards per seat from the dealer, and only the new ones of mine', () => {
        const before = run(at('bid:carol:PASS'))
        const call = stepStage(before, stateOf(table[at('call:')]), 0)
        const mine = call.model!.hand.filter((card) => !before.model!.hand.some((held) => held.id === card.id)).map((card) => card.id)
        expect(mine).toHaveLength(2)
        expect(Object.keys(call.entrances).sort()).toEqual([
            ...mine, 'back:alice:6', 'back:alice:7', 'back:bob:6', 'back:bob:7', 'back:dave:6', 'back:dave:7',
        ].sort())
        expect(call.entrances['back:alice:6']).toEqual({ from: 'dave', delay: 0, flip: false, scale: 0.4 })
        expect([before.calls, call.calls]).toEqual([0, 1])
    })

    test('a press locks the hand; after 2 s the card drops back and the lock holds (O-2)', () => {
        const myTurn = run(at('play:bob:PIK-BABA'))
        const card = myTurn.model!.hand[0].id
        const pressed = withInput(myTurn, pressCard(myTurn.model!, myTurn.local.input, card, 1000).input)
        expect(pressed.model!.hand.find((c) => c.id === card)!.pending).toBe(true)
        expect(pressed.model!.hand.every((c) => !c.enabled)).toBe(true)
        const settled = settleStage(pressed, 1000 + PENDING_MS)
        expect(settled.model!.hand.find((c) => c.id === card)!.pending).toBe(false)
        expect(settled.model!.hand.every((c) => !c.enabled)).toBe(true)
        expect(withInput(settled, settled.local.input)).toBe(settled)
    })
})
