import { describe, test, expect } from 'vitest'
import { dropLeaving, emptyStage, fadeKept, landTrick, settleStage, shownPiles, stepStage, sweepHeld, tableTrick, trickKey, withInput, type Stage } from './stage'
import { pressCard, PENDING_MS } from './model/input'
import type { BoardState } from './model/accept'
import { indexOf, playTable, type FanOut } from '../../test/fixtures/views/table'

// no wait for the declarations: the press below comes at a small `now`
const table = playTable({ pauseMs: 0 })
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

    test("an older backend's successful challenge mid-trick: the partial trick fades, then a new deal", () => {
        const midTrick = run(at('play:bob:PIK-BABA'))
        const partial = midTrick.model!.trick!
        const next = structuredClone(table[at('next-deal')])
        delete next.private.carol.publicPart.lastChallenge
        const after = stepStage(midTrick, stateOf(next), 0)
        expect(after.events!.map((e) => e.type)).toContain('ChallengeUpheld')
        expect(after.leaving).toEqual([expect.objectContaining({ key: trickKey(partial), team: null, at: 'fade', deal: 1 })])
        expect(after.deal).toBe(2)
        expect(after.cleared).toEqual([])
    })

    /** bob's card as carol sees it right after dave's right challenge: HAND_COMPLETE with the cards still held (gameplay rules §1). */
    function decided(): FanOut {
        const f = structuredClone(table[at('play:bob:PIK-BABA')])
        const pub = f.private.carol.publicPart
        Object.assign(pub, {
            gameState: 'HAND_COMPLETE', teamBScore: pub.teamBScore + 162, currentPlayerId: null, turnExpiresAt: null,
            stateVersion: pub.stateVersion! + 1, lastChallenge: { number: 1, playerId: 'dave', team: 'B', foulFound: true, thisHand: true },
        })
        f.private.carol.yourTurn = false
        return f
    }

    test('a right challenge mid-trick (gameplay rules §6): the partial trick stays on the table while the banner says who, then fades (fadeKept); nothing is held; the cards stay in hand', () => {
        const midTrick = run(at('play:bob:PIK-BABA'))
        const partial = midTrick.model!.trick!
        expect(partial.plays).toHaveLength(2)
        const after = stepStage(midTrick, stateOf(decided()), 0)
        expect(after.events!.map((e) => e.type)).toEqual(['Challenged', 'HandCompleted', 'Scored', 'Turn'])
        expect(after.kept).toEqual({ key: trickKey(partial), trick: partial })
        expect(after.leaving).toEqual([])
        expect(tableTrick(after)).toEqual(partial)
        expect(after.held).toBeNull()
        expect(after.handDelta).toEqual({ a: 0, b: 162 })
        expect(after.model!.hand).toHaveLength(midTrick.model!.hand.length)
        // the banner's outcome: it fades where it lies
        const faded = fadeKept(after)
        expect(faded.kept).toBeNull()
        expect(faded.leaving).toEqual([expect.objectContaining({ key: trickKey(partial), team: null, at: 'fade', deal: 1 })])
        expect(tableTrick(faded)).toBeNull()
        expect(fadeKept(faded)).toBe(faded)
    })

    test('the kept trick shows even when the view takes it off the table; a snapshot or a deal ends it', () => {
        const midTrick = run(at('play:bob:PIK-BABA'))
        const partial = midTrick.model!.trick!
        const gone = decided()
        gone.private.carol.publicPart.currentTrick = { leadPlayerId: '_NO_LEAD_', trump: null, plays: {} }
        const after = stepStage(midTrick, stateOf(gone), 0)
        expect(after.model!.trick?.plays ?? []).toHaveLength(0)
        expect(tableTrick(after)).toEqual(partial)
        // a snapshot (a reconnect) shows the decided hand as it is
        expect(stepStage(after, stateOf(decided(), 'snapshot'), 0).kept).toBeNull()
        // the next deal: it fades, if the banner never reached its outcome
        const dealt = stepStage(after, stateOf(table[at('next-deal')]), 0)
        expect(dealt.kept).toBeNull()
        expect(dealt.leaving).toEqual([expect.objectContaining({ key: trickKey(partial), at: 'fade', deal: 1 })])
    })

    test('a right challenge in the window: the hand\'s change follows the scores (the award taken back, the challengers\' given)', () => {
        const open = run(at('window-open'))
        const delta = open.handDelta!
        expect(delta).toEqual(open.model!.scores)
        const f = structuredClone(table[at('window-open')])
        Object.assign(f.private.carol.publicPart, {
            teamAScore: 0, teamBScore: 162, stateVersion: f.version + 1,
            lastChallenge: { number: 1, playerId: 'dave', team: 'B', foulFound: true, thisHand: true },
        })
        const after = stepStage(open, stateOf(f), 0)
        expect(after.events!.map((e) => e.type)).toEqual(['Challenged', 'Scored'])
        expect(after.handDelta).toEqual({ a: 0, b: 162 })
        // the 8th trick has gone already: nothing more leaves the table
        expect(after.leaving).toEqual(open.leaving)
    })

    test('a wrong challenge leaves the trick where it is; a snapshot of a decided hand shows no partial trick', () => {
        const midTrick = run(at('play:bob:PIK-BABA'))
        const wrong = structuredClone(table[at('play:bob:PIK-BABA')])
        Object.assign(wrong.private.carol.publicPart, { lastChallenge: { number: 1, playerId: 'dave', team: 'B', foulFound: false, thisHand: true } })
        wrong.private.carol.publicPart.challengeUsedByPlayer.dave = true
        const after = stepStage(midTrick, stateOf(wrong), 0)
        expect(after.events!.map((e) => e.type)).toEqual(['Challenged'])
        expect(after.leaving).toEqual([])
        expect(tableTrick(after)!.plays).toHaveLength(2)
        const snap = stepStage(midTrick, stateOf(decided(), 'snapshot'), 0)
        expect(snap.events).toBeNull()
        expect(tableTrick(snap)).toBeNull()
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
