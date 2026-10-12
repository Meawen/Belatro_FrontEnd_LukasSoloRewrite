import { describe, test, expect } from 'vitest'
import { find, indexOf, playTable, type FanOut } from './table'

// Seed 7: dave alone declares (20), so team B wins the contest; carol is to play after bob's card, the hand's second.
const plain = playTable({ hands: 2 })
const strip = (t: FanOut[]) => t.map((f) => `${f.label} ${f.trigger}`)
const views = (f: FanOut) => [f.public, ...Object.values(f.private).map((p) => p.publicPart)]
const SECOND = 'play:bob:PIK-BABA'

describe('playTable: a challenge (gameplay rules §1, §5)', () => {
    test('wrong, during play: one save that spends bob\'s challenge for the game; the scores, the turn and the cards go on as before', () => {
        const t = playTable({ hands: 2, challenge: { by: 'bob', after: 2, foul: false } })
        const i = indexOf(t, 'challenge:')
        // right after the second card's fan-outs, nothing else changes in the sequence
        expect(strip(t)).toEqual([...strip(plain).slice(0, i), 'challenge:bob:wrong GSC', ...strip(plain).slice(i)])
        expect(t[i - 1].label).toBe(SECOND)
        const [before, said] = [t[i - 1], t[i]]
        expect(said.version).toBe(before.version + 1)
        for (const view of views(said)) {
            expect(view.lastChallenge).toEqual({ number: 1, playerId: 'bob', team: 'B', foulFound: false, thisHand: true })
            expect(view.challengeUsedByPlayer).toEqual({ alice: false, bob: true, carol: false, dave: false })
            expect([view.gameState, view.currentPlayerId, view.turnExpiresAt, view.teamAScore, view.teamBScore])
                .toEqual([before.public.gameState, before.public.currentPlayerId, before.public.turnExpiresAt, before.public.teamAScore, before.public.teamBScore])
        }
        expect(Object.fromEntries(Object.entries(said.private).map(([id, p]) => [id, p.challengeUsed]))).toEqual({ alice: false, bob: true, carol: false, dave: false })
        expect(said.private.carol.yourTurn).toBe(true)
        // the same cards are played, and the same scores come of them
        expect(t.filter((f) => f.label !== 'challenge:bob:wrong').map((f) => [f.label, f.public.teamAScore, f.public.teamBScore]))
            .toEqual(plain.map((f) => [f.label, f.public.teamAScore, f.public.teamBScore]))
        // gone for the rest of the game; the next deal makes it an earlier hand's
        const next = indexOf(t, 'next-deal')
        for (const f of t.slice(i)) {
            expect(f.public.challengeUsedByPlayer.bob, f.label).toBe(true)
            expect(f.private.bob.challengeUsed, f.label).toBe(true)
            expect(f.public.lastChallenge, f.label).toMatchObject({ number: 1, playerId: 'bob', thisHand: t.indexOf(f) < next })
        }
    })

    test('right, during play: the hand ends there with the cards held, the challengers take 162 and their declarations, then the window as after an 8th card', () => {
        const t = playTable({ challenge: { by: 'dave', after: 2, foul: true } })
        const i = indexOf(t, 'challenge:')
        expect(strip(t).slice(i)).toEqual([
            'challenge:dave:right GSC', 'window-open GSC', 'window-open CTL', 'window-close GSC', 'next-deal GSC', 'next-deal TS', 'next-deal GSC',
        ])
        expect(t[i - 1].label).toBe(SECOND)
        const right = t[i].public
        expect(right).toMatchObject({
            gameState: 'HAND_COMPLETE', currentPlayerId: null, turnExpiresAt: null, challengeWindowExpiresAt: null,
            // dave's 20 won the contest for team B; nobody had played a bela
            teamAScore: 0, teamBScore: 162 + 20,
            lastChallenge: { number: 1, playerId: 'dave', team: 'B', foulFound: true, thisHand: true },
            challengeUsedByPlayer: { alice: false, bob: false, carol: false, dave: false },
        })
        // alice and bob have played a card each; the cut-short trick is still on the view
        expect(Object.fromEntries(Object.entries(t[i].private).map(([id, p]) => [id, p.hand.length]))).toEqual({ alice: 7, bob: 7, carol: 8, dave: 8 })
        expect(Object.keys(right.currentTrick!.plays)).toEqual(['alice', 'bob'])
        expect(Object.values(t[i].private).some((p) => p.yourTurn)).toBe(false)
        const open = t[i + 1].public
        expect(open.challengeWindowExpiresAt).toBe(t[i].at + 10_000)
        // the next deal: a new hand, the challenge an earlier hand's, dave's still his
        const next = find(t, 'next-deal').public
        expect(next).toMatchObject({ gameState: 'BIDDING', teamAScore: 0, teamBScore: 182, lastChallenge: { thisHand: false }, challengeUsedByPlayer: { dave: false } })
    })

    test('right, in the window: the award taken back and the challengers\' given, one save, the window again at 10 s', () => {
        const t = playTable({ challenge: { by: 'dave', after: 'window', foul: true } })
        const base = playTable()
        const i = indexOf(t, 'challenge:')
        expect(strip(t)).toEqual([...strip(base).slice(0, i), 'challenge:dave:right GSC', ...strip(base).slice(i)])
        expect(strip(t).slice(i - 3, i)).toEqual(['hand-complete GSC', 'window-open GSC', 'window-open CTL'])
        const [open, right] = [t[i - 1], t[i]]
        expect(open.public).toMatchObject({ teamAScore: 11, teamBScore: 171 })
        expect(right.public).toMatchObject({
            gameState: 'HAND_COMPLETE', teamAScore: 0, teamBScore: 182, challengeWindowExpiresAt: right.at + 10_000,
            lastChallenge: { number: 1, playerId: 'dave', team: 'B', foulFound: true, thisHand: true },
        })
        expect(right.public.challengeWindowExpiresAt).toBeGreaterThan(open.public.challengeWindowExpiresAt!)
        // the window that closes is the restarted one
        expect(find(t, 'window-close').at).toBe(right.public.challengeWindowExpiresAt)
    })

    test('wrong, in the window: no score moves, the window runs on, the challenge is gone', () => {
        const t = playTable({ challenge: { by: 'carol', after: 'window', foul: false } })
        const i = indexOf(t, 'challenge:')
        const [open, wrong] = [t[i - 1].public, t[i].public]
        expect(t[i].label).toBe('challenge:carol:wrong')
        expect(wrong).toMatchObject({
            gameState: 'HAND_COMPLETE', teamAScore: open.teamAScore, teamBScore: open.teamBScore, challengeWindowExpiresAt: open.challengeWindowExpiresAt,
            lastChallenge: { number: 1, playerId: 'carol', team: 'A', foulFound: false, thisHand: true }, challengeUsedByPlayer: { carol: true },
        })
        expect(t[i].private.carol.challengeUsed).toBe(true)
    })

    test('without the option nobody challenges: lastChallenge null and every challenge kept, as before', () => {
        for (const f of plain) {
            for (const view of views(f)) expect([view.lastChallenge, Object.values(view.challengeUsedByPlayer).some(Boolean)]).toEqual([null, false])
            expect(Object.values(f.private).some((p) => p.challengeUsed)).toBe(false)
        }
    })
})
