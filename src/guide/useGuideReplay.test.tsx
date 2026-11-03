import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import hand1 from './hand1.recording.json'
import { stepsOf, type GuideStep, type LessonKey } from './script'
import { PACE_MS, rebased, useGuideReplay, type GuideReplay } from './useGuideReplay'
import type { BoardState } from '../components/board/model/accept'
import type { CoachMove } from '../components/board/coach'
import type { GameCard } from '../types/game'

// Škola bele hand 1 on rails (open beta §7.2): the replay of B8's recording, its pace, its clocks and its coach

const HAND1 = stepsOf(hand1)
const T9: GameCard = { boja: 'TREF', rank: 'DEVETKA' }
const H7: GameCard = { boja: 'HERC', rank: 'SEDMICA' }

beforeEach(() => {
    vi.useFakeTimers()
})
afterEach(() => {
    vi.useRealTimers()
})

type Result = { current: GuideReplay }
/** Fake time moves `ms` on, then React renders what it fed (one act each: a feed's next timer is set after its render). */
const after = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })
/** Up to 10 s, a render at least every 100 ms, until the learner is at a step. */
function untilReady(result: Result) {
    for (let waited = 0; waited < 10_000 && !result.current.ready; waited += 100) after(100)
    expect(result.current.ready).toBe(true)
}

/** The step's move through the replay's actions, as the Board sends it; true when it went. */
function send(result: Result, move: NonNullable<GuideStep['move']> | CoachMove): boolean {
    let went = false
    act(() => {
        const { actions } = result.current
        if (move.kind === 'bid') went = actions.bidTrump(move.trump)
        else if (move.kind === 'pass') went = actions.passBid()
        else if (move.kind === 'challenge') went = actions.challenge()
        else went = actions.play(move.card, 'declareBela' in move ? move.declareBela : move.bela)
    })
    return went
}

/** From where the replay is, plays the expected moves up to (not including) `lesson`'s step, once it is ready. */
function playTo(result: Result, lesson: LessonKey) {
    for (;;) {
        untilReady(result)
        const step = result.current.step!
        if (step.lesson === lesson) return
        if (step.move) expect(send(result, step.move)).toBe(true)
        else act(() => result.current.next())
    }
}

describe('useGuideReplay: hand 1 on rails (open beta §7.2)', () => {
    test('starts at the deal and stops at each step; the other seats come one pair per 900 ms', () => {
        expect(PACE_MS).toBe(900)
        const { result } = renderHook(() => useGuideReplay(HAND1))
        // the deal, at once: six cards, nobody has bid
        expect(result.current.state.privateView?.hand).toHaveLength(6)
        expect(result.current.state.publicView.bids).toEqual([])
        expect(result.current.step).toBeNull()
        expect(result.current.ready).toBe(false)
        expect(result.current.done).toBe(false)
        after(899)
        expect(result.current.step).toBeNull()
        after(1)
        // ivo's pass: the first lesson waits for Next
        expect(result.current.step?.lesson).toBe('dalje')
        expect(result.current.ready).toBe(true)
        expect(result.current.state.publicView.bids).toHaveLength(1)
        // nothing moves while a stop waits
        after(5000)
        expect(result.current.state.publicView.bids).toHaveLength(1)

        act(() => result.current.next())
        // the table moves on; the lesson stays until the next step is reached
        expect(result.current.ready).toBe(false)
        expect(result.current.step?.lesson).toBe('dalje')
        after(900)
        expect(result.current.state.publicView.bids).toHaveLength(2)
        expect(result.current.ready).toBe(false)
        after(899)
        expect(result.current.ready).toBe(false)
        after(1)
        expect(result.current.step?.lesson).toBe('mus')
        expect(result.current.ready).toBe(true)
        expect(result.current.state.publicView.bids).toHaveLength(3)
        expect(result.current.state.privateView?.yourTurn).toBe(true)
    })

    test('the clocks: no serverNow, no turn or window deadline, and play opens 5 s after the call with no card before it', () => {
        const { result } = renderHook(() => useGuideReplay(HAND1))
        const states = new Set<BoardState>()
        const keep = () => states.add(result.current.state)
        keep()
        playTo(result, 'mus')
        const call = Date.now()
        expect(send(result, { kind: 'bid', trump: 'HERC' })).toBe(true)
        // the server's answer comes at once (the next macrotask), not on the table's pace
        after(0)
        keep()
        expect(result.current.step?.lesson).toBe('zvanja')
        expect(result.current.ready).toBe(true)
        const opens = result.current.state.publicView.zvanja?.playOpensAt
        expect(opens).toEqual(expect.any(Number))
        expect(Math.abs(opens! - (call + 5000))).toBeLessThanOrEqual(100)

        act(() => result.current.next())
        after(4900)
        keep()
        expect(result.current.state.publicView.currentTrick.plays).toEqual({})
        after(200)
        keep()
        expect(result.current.state.publicView.currentTrick.plays).toEqual({ ivo: { boja: 'TREF', rank: 'AS' } })

        // the rest of the hand, every state kept
        for (const step of HAND1.steps.slice(3)) {
            for (let waited = 0; waited < 10_000 && !result.current.ready; waited += 100) {
                after(100)
                keep()
            }
            expect(result.current.step?.lesson).toBe(step.lesson)
            if (step.move) expect(send(result, step.move)).toBe(true)
            else act(() => result.current.next())
            keep()
        }
        expect(result.current.done).toBe(true)
        // every frame went through the board's acceptance rule with its recorded clocks neutralised
        expect(states.size).toBeGreaterThan(30)
        for (const state of states) {
            expect(state.publicView).not.toHaveProperty('serverNow')
            expect(state.skew).toBe(0)
            expect(state.publicView.turnExpiresAt).toBeNull()
            expect(state.publicView.challengeWindowExpiresAt).toBeNull()
            // one rebased moment for the whole hand: its key never changes
            if (state.publicView.zvanja) expect(state.publicView.zvanja.playOpensAt).toBe(opens)
        }
        expect(result.current.state.publicView.gameState).toBe('HAND_COMPLETE')
    })

    test('rebased maps each recorded playOpensAt once, from its first frame’s serverNow', () => {
        const frame = HAND1.frames[8]
        if (frame.channel !== 'public') throw new Error('frame 8 is public')
        const recorded = frame.body.zvanja!.playOpensAt!
        const first = rebased(frame, 1_000_000, new Map())
        expect(first.frame.kind).toBe('public')
        expect(first.frame.view.zvanja?.playOpensAt).toBe(1_000_000 + recorded - frame.body.serverNow!)
        expect(first.opens.get(recorded)).toBe(first.frame.view.zvanja?.playOpensAt)
        // a later frame with the same recorded value: the same rebased one, whatever the time
        const later = rebased(HAND1.frames[9], 2_000_000, first.opens)
        expect(later.frame.kind).toBe('private')
        if (later.frame.kind !== 'private') return
        expect(later.frame.source).toBe('live')
        expect(later.frame.view.publicPart.zvanja?.playOpensAt).toBe(first.frame.view.zvanja?.playOpensAt)
        expect(later.opens).toBe(first.opens)
        // the recording itself is left as it was
        expect(frame.body.serverNow).toEqual(expect.any(Number))
        expect(frame.body.zvanja!.playOpensAt).toBe(recorded)
    })

    test('allowed accepts only the step’s move; a refused move keeps the state and says why', () => {
        const { result } = renderHook(() => useGuideReplay(HAND1))
        after(900)
        // a stop: nothing marked, nothing allowed
        expect(result.current.step?.lesson).toBe('dalje')
        expect(result.current.coach.marked).toBeUndefined()
        expect(result.current.coach.allowed({ kind: 'pass' })).toBe(false)
        act(() => result.current.coach.onRefused?.({ kind: 'challenge' }))
        expect(result.current.refusal).toBe('readFirst')
        act(() => result.current.next())
        expect(result.current.refusal).toBeNull()
        untilReady(result)

        expect(result.current.step?.lesson).toBe('mus')
        expect(result.current.coach.allowed({ kind: 'bid', trump: 'HERC' })).toBe(true)
        expect(result.current.coach.allowed({ kind: 'bid', trump: 'KARA' })).toBe(false)
        expect(result.current.coach.allowed({ kind: 'pass' })).toBe(false)
        act(() => result.current.coach.onRefused?.({ kind: 'pass' }))
        expect(result.current.refusal).toBe('pass')
        act(() => result.current.coach.onRefused?.({ kind: 'bid', trump: 'KARA' }))
        expect(result.current.refusal).toBe('bid')
        // the actions check the same rule: a wrong one goes nowhere
        expect(send(result, { kind: 'bid', trump: 'KARA' })).toBe(false)
        expect(send(result, { kind: 'pass' })).toBe(false)
        expect(result.current.step?.lesson).toBe('mus')
        expect(result.current.ready).toBe(true)

        playTo(result, 'followSuit')
        expect(result.current.coach.marked).toEqual(['TREF-DEVETKA'])
        expect(result.current.coach.allowed({ kind: 'play', card: T9, bela: false })).toBe(true)
        expect(result.current.coach.allowed({ kind: 'play', card: T9, bela: true })).toBe(false)
        expect(result.current.coach.allowed({ kind: 'play', card: { boja: 'TREF', rank: 'DESETKA' }, bela: false })).toBe(false)
        expect(result.current.coach.allowed({ kind: 'challenge' })).toBe(false)
        const before = result.current.state
        act(() => result.current.coach.onRefused?.({ kind: 'play', card: H7, bela: false }))
        expect(result.current.refusal).toBe('illegal')
        expect(result.current.state).toBe(before)
        expect(result.current.step?.lesson).toBe('followSuit')
        after(5000)
        expect(result.current.state).toBe(before)
        act(() => result.current.coach.onRefused?.({ kind: 'challenge' }))
        expect(result.current.refusal).toBe('challengeEarly')
        expect(send(result, { kind: 'play', card: H7, bela: false })).toBe(false)
        expect(result.current.state).toBe(before)

        // the right card: the refusal goes, the result comes at once
        expect(send(result, { kind: 'play', card: T9, bela: false })).toBe(true)
        expect(result.current.refusal).toBeNull()
        expect(result.current.ready).toBe(false)
        expect(result.current.coach.marked).toBeUndefined()
        expect(result.current.coach.allowed({ kind: 'play', card: T9, bela: false })).toBe(false)
        after(0)
        expect(result.current.state.publicView.currentTrick.plays.ti).toEqual(T9)
    })

    test('a refusal is said again when repeated, and never carries into the next lesson (Ruling 69)', () => {
        const { result } = renderHook(() => useGuideReplay(HAND1))
        playTo(result, 'followSuit')
        expect(result.current.refused).toBe(0)
        act(() => result.current.coach.onRefused?.({ kind: 'play', card: H7, bela: false }))
        act(() => result.current.coach.onRefused?.({ kind: 'play', card: H7, bela: false }))
        // the same refusal twice: the same line, counted twice, so the panel says it again
        expect(result.current.refusal).toBe('illegal')
        expect(result.current.refused).toBe(2)
        expect(send(result, { kind: 'play', card: T9, bela: false })).toBe(true)
        after(0)
        // while the table moves on, a Challenge is refused with the real rule
        act(() => result.current.coach.onRefused?.({ kind: 'challenge' }))
        expect(result.current.ready).toBe(false)
        expect(result.current.refusal).toBe('challengeEarly')
        // the next lesson starts with nothing refused
        untilReady(result)
        expect(result.current.step?.lesson).toBe('mustTrump')
        expect(result.current.refusal).toBeNull()
        expect(result.current.refused).toBe(3)
    })

    test('an allowed move goes on at once, Next goes on from a stop, and the whole hand reaches done', () => {
        const { result } = renderHook(() => useGuideReplay(HAND1))
        const wrong: Partial<Record<LessonKey, CoachMove>> = {
            mus: { kind: 'bid', trump: 'PIK' },
            followSuit: { kind: 'play', card: { boja: 'TREF', rank: 'DECKO' }, bela: false },
            bela: { kind: 'play', card: { boja: 'HERC', rank: 'KRALJ' }, bela: false },
            challenge: { kind: 'play', card: { boja: 'TREF', rank: 'BABA' }, bela: false },
        }
        for (const step of HAND1.steps) {
            untilReady(result)
            expect(result.current.step).toBe(step)
            expect(result.current.done).toBe(false)
            const mistake = wrong[step.lesson]
            if (mistake) {
                const before = result.current.state
                expect(send(result, mistake)).toBe(false)
                expect(result.current.state).toBe(before)
                expect(result.current.step).toBe(step)
            }
            if (step.move) {
                // Next does nothing where a move is awaited
                act(() => result.current.next())
                expect(result.current.step).toBe(step)
                expect(result.current.ready).toBe(true)
                expect(send(result, step.move)).toBe(true)
                // nothing waits on the pace: the move's result is fed on the next macrotask
                after(0)
            } else {
                act(() => result.current.next())
            }
        }
        expect(result.current.done).toBe(true)
        expect(result.current.ready).toBe(false)
        expect(result.current.step?.lesson).toBe('foulFound')
        const view = result.current.state.publicView
        expect([view.teamAScore, view.teamBScore]).toEqual([232, 0])
        // the stored hand the board reads: the corrected one, after the right challenge
        expect(result.current.hands.ended?.handSummary).toMatchObject({ finalScoreA: 232, finalScoreB: 0, padanje: false })
        expect(result.current.hands.ended?.challenges).toEqual([{ order: 0, player: 'ti', success: true }])
        // nothing more is fed after the last frame
        after(10_000)
        expect(result.current.state.publicView).toBe(view)
    })
})
