import { describe, test, expect } from 'vitest'
import { NOTHING_ACCEPTED, acceptFrame, type Accepted, type Frame } from './accept'
import { cardId } from './rules'
import { find, indexOf, playTable } from '../../../test/fixtures/views/table'
import type { PrivateGameView } from '../../../types/game'

const table = playTable()
const carolsPlay = indexOf(table, 'play:carol:')
const played = table[carolsPlay]
const playedId = played.label.split(':')[2]

const pub = (i: number): Frame => ({ kind: 'public', view: table[i].public })
const priv = (i: number, source: 'live' | 'snapshot' = 'live'): Frame => ({ kind: 'private', view: table[i].private.carol, source })
const run = (frames: Frame[], start: Accepted = NOTHING_ACCEPTED): Accepted =>
    frames.reduce((acc, frame, i) => acceptFrame(acc, frame, 1000 + i), start)
const handIds = (acc: Accepted) => acc.state!.privateView!.hand.map(cardId)
const edited = (i: number, change: (view: PrivateGameView) => void): Frame => {
    const view = structuredClone(table[i].private.carol)
    change(view)
    return { kind: 'private', view, source: 'live' }
}

describe('acceptFrame (spec §5.3.1)', () => {
    test('a private frame carries the whole state; after one, versioned public frames are ignored', () => {
        const first = acceptFrame(NOTHING_ACCEPTED, priv(0), 5)
        expect(first.state).toEqual({
            publicView: table[0].private.carol.publicPart, privateView: table[0].private.carol, receivedAt: 5, skew: table[0].at - 5, source: 'live',
        })
        expect(first.version).toBe(table[0].version)
        expect(acceptFrame(first, pub(2), 6)).toBe(first)
    })

    test('public then private at one version: my card leaves my hand and my turn ends', () => {
        const start = run([priv(carolsPlay - 1)])
        expect(handIds(start)).toContain(playedId)
        expect(start.state!.privateView!.yourTurn).toBe(true)
        const after = run([pub(carolsPlay), priv(carolsPlay)], start)
        expect(handIds(after)).not.toContain(playedId)
        expect(after.state!.privateView!.yourTurn).toBe(false)
        expect(after.state!.publicView.currentTrick!.plays.carol).toEqual(played.private.carol.publicPart.currentTrick!.plays.carol)
    })

    test('private then public at one version: my card leaves my hand and my turn ends', () => {
        const after = run([priv(carolsPlay - 1), priv(carolsPlay), pub(carolsPlay)])
        expect(handIds(after)).not.toContain(playedId)
        expect(after.state!.privateView).toBe(played.private.carol)
        expect(after.state!.privateView!.yourTurn).toBe(false)
    })

    test('a newer version is accepted, an older one dropped, a duplicate keeps the state', () => {
        const now = run([priv(carolsPlay)])
        expect(acceptFrame(now, priv(carolsPlay - 2), 9)).toBe(now)
        expect(acceptFrame(now, priv(carolsPlay), 2000).state).toBe(now.state)
        expect(acceptFrame(now, priv(carolsPlay + 2), 9).version).toBe(table[carolsPlay + 2].version)
    })

    test('the same version merges only the clocks: the later deadline for the same player wins, nothing else changes', () => {
        const now = run([priv(carolsPlay)])
        const deadline = played.public.turnExpiresAt!
        const merged = acceptFrame(now, edited(carolsPlay, (view) => {
            view.publicPart.turnExpiresAt = deadline + 5
            view.publicPart.teamAScore = 999
            view.hand = []
        }), 50)
        expect(merged.state!.publicView.turnExpiresAt).toBe(deadline + 5)
        expect(merged.state!.publicView.teamAScore).toBe(played.public.teamAScore)
        expect(merged.state!.privateView).toBe(played.private.carol)
        expect(merged.state!.receivedAt).toBe(50)
        // an earlier deadline, or none, never replaces it
        expect(acceptFrame(merged, edited(carolsPlay, (view) => { view.publicPart.turnExpiresAt = deadline }), 51).state).toBe(merged.state)
        expect(acceptFrame(merged, edited(carolsPlay, (view) => { view.publicPart.turnExpiresAt = null }), 52).state).toBe(merged.state)
    })

    test("the trump call's GSC frame (no deadline) after its TS frame at the same version keeps the TS deadline, in either order", () => {
        const call = indexOf(table, 'call:')
        expect(table[call].public.turnExpiresAt).toBeNull()
        const deadline = table[call + 1].public.turnExpiresAt
        expect(run([priv(call + 1), priv(call)]).state!.publicView.turnExpiresAt).toBe(deadline)
        expect(run([priv(call), priv(call + 1)]).state!.publicView.turnExpiresAt).toBe(deadline)
    })

    test('in HAND_COMPLETE a set window replaces a null one at the same version; a null never replaces it', () => {
        const hc = indexOf(table, 'hand-complete')
        const start = run([priv(hc)])
        expect(start.state!.publicView.challengeWindowExpiresAt).toBeNull()
        const opened = acceptFrame(start, edited(hc, (view) => { view.publicPart.challengeWindowExpiresAt = 77 }), 60)
        expect(opened.state!.publicView.challengeWindowExpiresAt).toBe(77)
        expect(acceptFrame(opened, priv(hc), 61).state!.publicView.challengeWindowExpiresAt).toBe(77)
    })

    test('a snapshot follows the version rule: newer is taken and tagged, older (a live frame came first) is dropped', () => {
        const live = run([priv(carolsPlay + 4)])
        expect(acceptFrame(live, priv(carolsPlay, 'snapshot'), 60)).toBe(live)
        const snap = acceptFrame(run([priv(carolsPlay)]), priv(carolsPlay + 4, 'snapshot'), 61)
        expect(snap.state).toMatchObject({ privateView: table[carolsPlay + 4].private.carol, source: 'snapshot' })
        // at the same version it only merges the clocks: there is nothing to snap to
        expect(acceptFrame(snap, priv(carolsPlay + 4, 'snapshot'), 62).state).toBe(snap.state)
    })

    test('the skew is the largest serverNow − receivedAt of the last 10 accepted frames; 0 without serverNow', () => {
        const at = table[carolsPlay].at
        const slow = acceptFrame(NOTHING_ACCEPTED, priv(carolsPlay), at - 300)
        expect(slow.state!.skew).toBe(300)
        // a later, less delayed copy of the same version raises the estimate
        const fast = acceptFrame(slow, priv(carolsPlay), at - 500)
        expect(fast.state!.skew).toBe(500)
        // ten more samples push the best one out
        let acc = fast
        for (let i = 1; i <= 10; i++) acc = acceptFrame(acc, priv(carolsPlay + 2 * i), table[carolsPlay + 2 * i].at - 100)
        expect(acc.samples).toHaveLength(10)
        expect(acc.state!.skew).toBe(100)
        const old = playTable({ fields: false })
        expect(acceptFrame(NOTHING_ACCEPTED, { kind: 'private', view: old[0].private.carol, source: 'live' }, 5).state!.skew).toBe(0)
    })

    test('before any private frame a public frame shows a read-only table, ordered by its own version', () => {
        const first = run([pub(4)])
        expect(first.state).toMatchObject({ publicView: table[4].public, privateView: null })
        expect(acceptFrame(first, pub(2), 9)).toBe(first)
        const withPrivate = acceptFrame(first, priv(4), 10)
        expect(withPrivate.state!.privateView).toBe(table[4].private.carol)
    })

    test('without stateVersion every frame is accepted as before: a later public frame replaces the public part', () => {
        const old = playTable({ fields: false })
        const call = indexOf(old, 'call:')
        const afterPrivate = acceptFrame(NOTHING_ACCEPTED, { kind: 'private', view: old[call].private.carol, source: 'live' }, 1)
        expect(afterPrivate.version).toBeNull()
        const stale = acceptFrame(afterPrivate, { kind: 'public', view: old[0].public }, 2)
        expect(stale.state!.publicView).toBe(old[0].public)
        expect(stale.state!.privateView).toBe(old[call].private.carol)
        expect(acceptFrame(stale, { kind: 'private', view: old[0].private.carol, source: 'live' }, 3).state!.privateView).toBe(old[0].private.carol)
    })

    test('a whole hand in the server order, then 40 stale frames again, ends on the newest state', () => {
        const frames = table.flatMap((f): Frame[] => [{ kind: 'public', view: f.public }, { kind: 'private', view: f.private.carol, source: 'live' }])
        const end = run([...frames, ...frames.slice(0, 40)])
        const last = table[table.length - 1]
        expect(end.state!.publicView).toEqual(last.private.carol.publicPart)
        expect(end.state!.privateView!.hand).toEqual(last.private.carol.hand)
        expect(end.version).toBe(last.version)
        expect(find(table, 'next-deal').version).toBe(last.version)
    })
})
