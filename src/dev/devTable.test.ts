import { describe, test, expect } from 'vitest'
import { devHands, devStream, devTable, frameOf, parseDevOptions, recordedStream, resolveAt, type RecordedViews } from './devTable'
import { blokRows, endedHand, handTricks } from '../components/board/model/hands'
import { deliveries, indexOf, playTable } from '../test/fixtures/views/table'

const table = playTable({ hands: 2 })

describe('the dev board’s data (spec §4.17)', () => {
    test('URL options, with defaults for everything left out', () => {
        expect(parseDevOptions('')).toEqual({
            seat: 'alice', seed: 7, trump: 'HERC', hands: 2, scores: null, at: null, chaos: false, layout: 'fit',
            reduced: false, effects: null, controls: true, skip: false, play: false, speed: 1, names: false, fixture: null,
        })
        expect(parseDevOptions('?fixture=recorded-k3f9q').fixture).toBe('recorded-k3f9q')
        expect(parseDevOptions('?seat=carol&at=window-open&layout=812x375&motion=reduce&effects=off&chaos=1&controls=0&skip=1&play=1&speed=2&scores=990,900&trump=KARA'))
            .toMatchObject({ seat: 'carol', at: 'window-open', layout: '812x375', reduced: true, effects: 'off', chaos: true, controls: false, skip: true, play: true, speed: 2, scores: [990, 900], trump: 'KARA' })
        expect(parseDevOptions('?seat=eve&layout=1x1&effects=sparkly')).toMatchObject({ seat: 'alice', layout: 'fit', effects: 'full' })
    })

    test('a jump by index or by label; the table’s clock puts that fan-out now', () => {
        expect(resolveAt(table, '12')).toBe(12)
        expect(resolveAt(table, 'window-open')).toBe(indexOf(table, 'window-open'))
        expect(resolveAt(table, 'no-such-label')).toBe(0)
        const now = 1_800_000_000_000
        const live = devTable({ seed: 7, trump: 'HERC', hands: 2, scores: null }, now, 20)
        expect(live[20].at).toBe(now)
        expect(live.map((f) => f.label)).toEqual(table.map((f) => f.label))
    })

    test('clean: every private frame first; chaos: public first, duplicated, and older frames after newer ones', () => {
        const clean = devStream(table, 'carol', false)
        expect(clean[0].delivery.channel).toBe('private')
        expect(clean.map((s) => s.fanOut)).toEqual(table.flatMap((_, i) => [i, i]))
        const chaos = devStream(table, 'carol', true)
        expect(chaos[0].delivery.channel).toBe('public')
        expect(chaos[0].delivery).toBe(chaos[1].delivery)
        const versions = chaos.filter((s) => s.delivery.channel === 'private').map((s) => s.delivery.body.publicPart.stateVersion!)
        expect(versions.some((v, i) => i > 0 && v < versions[i - 1])).toBe(true)
        expect(frameOf({ channel: 'snapshot', body: table[3].private.carol })).toEqual({ kind: 'private', view: table[3].private.carol, source: 'snapshot' })
    })

    test('a recording: as its seat received it, or with chaos (duplicates, older frames after newer ones); each step names its frame', () => {
        const frames = deliveries(table, 'carol').map((delivery, i) => ({ ...delivery, at: i * 800 }))
        const recording: RecordedViews = { format: 'stiglja-recorded-views/1', gameId: 'g1', me: 'carol', frames }
        const clean = recordedStream(recording, false)
        expect(clean.map((s) => s.delivery)).toEqual(frames)
        expect(clean.map((s) => s.fanOut)).toEqual(frames.map((_, i) => i))
        expect(frameOf(clean[0].delivery)).toEqual({ kind: 'public', view: table[0].public })
        const chaos = recordedStream(recording, true)
        expect(chaos[0].delivery).toBe(chaos[1].delivery)
        expect(chaos[0].fanOut).toBe(0)
        const versions = chaos.filter((s) => s.delivery.channel === 'private').map((s) => s.delivery.body.publicPart.stateVersion!)
        expect(versions.some((v, i) => i > 0 && v < versions[i - 1])).toBe(true)
    })

    test('the stored hands as the server would have them: tricks with winners, the summary once a hand ends', () => {
        const midHand = devHands(table, indexOf(table, 'play:carol:PIK-DECKO'))
        expect(midHand).toHaveLength(1)
        expect(midHand[0].handSummary).toBeNull()
        expect(handTricks(midHand[0]).map((t) => t.winnerId)).toEqual(['dave', 'bob'])
        const end = indexOf(table, 'hand-complete')
        const ended = devHands(table, end)
        expect(ended[0].tricks).toHaveLength(8)
        expect(endedHand(ended, { a: table[end].public.teamAScore, b: table[end].public.teamBScore })).toBe(ended[0])
        const both = devHands(table, table.length - 1)
        const rows = blokRows(both, (id) => (id === 'alice' || id === 'carol' ? 'A' : 'B'))
        const last = table[table.length - 1].public
        expect(rows.reduce((sum, row) => sum + row.a, 0)).toBe(last.teamAScore)
        expect(rows.reduce((sum, row) => sum + row.b, 0)).toBe(last.teamBScore)
    })
})
