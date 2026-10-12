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
            bots: [], live: false, t: 0, belot: null, challenge: null,
        })
        expect(parseDevOptions('?fixture=recorded-k3f9q').fixture).toBe('recorded-k3f9q')
        expect(parseDevOptions('?seat=carol&at=window-open&layout=812x375&motion=reduce&effects=off&chaos=1&controls=0&skip=1&play=1&speed=2&scores=990,900&trump=KARA'))
            .toMatchObject({ seat: 'carol', at: 'window-open', layout: '812x375', reduced: true, effects: 'off', chaos: true, controls: false, skip: true, play: true, speed: 2, scores: [990, 900], trump: 'KARA' })
        expect(parseDevOptions('?seat=eve&layout=1x1&effects=sparkly')).toMatchObject({ seat: 'alice', layout: 'fit', effects: 'full' })
    })

    test('bots=bob,dave: those seats carry the server’s bot flag in every frame, public and private; nothing else changes (casual bots spec §7)', () => {
        expect(parseDevOptions('?bots=bob,dave,eve').bots).toEqual(['bob', 'dave'])
        const options = { seed: 7, trump: 'HERC' as const, hands: 1, scores: null }
        const marked = devTable({ ...options, bots: ['bob', 'dave'] }, 0)
        const views = marked.flatMap((f) => [f.public, ...Object.values(f.private).map((p) => p.publicPart)])
        for (const v of views) {
            for (const seat of [...v.teamA, ...v.teamB, ...v.seatingOrder]) expect([seat.id, seat.bot === true]).toEqual([seat.id, seat.id === 'bob' || seat.id === 'dave'])
        }
        expect(JSON.parse(JSON.stringify(marked).split(',"bot":true').join(''))).toEqual(devTable(options, 0))
    })

    test('live=1 and t: step into `at` live, that long ago; belot= and challenge= reach the table (gameplay rules §1, §3)', () => {
        expect(parseDevOptions('?at=call:&live=1&t=700')).toMatchObject({ at: 'call:', live: true, t: 700 })
        expect(parseDevOptions('?live=yes&t=-5').live).toBe(false)
        expect(parseDevOptions('?t=-5').t).toBe(0)
        expect(parseDevOptions('?t=soon').t).toBe(0)
        expect(parseDevOptions('?belot=bob:PIK').belot).toEqual({ player: 'bob', suit: 'PIK' })
        for (const bad of ['eve:PIK', 'bob:SRCE', 'bob', '']) expect(parseDevOptions(`?belot=${bad}`).belot, bad).toBeNull()
        expect(parseDevOptions('?challenge=bob:2:wrong').challenge).toEqual({ by: 'bob', after: 2, foul: false })
        expect(parseDevOptions('?challenge=dave:window:right').challenge).toEqual({ by: 'dave', after: 'window', foul: true })
        for (const bad of ['eve:2:wrong', 'bob:0:wrong', 'bob:32:right', 'bob:2.5:right', 'bob:2:maybe', 'bob:2', ''])
            expect(parseDevOptions(`?challenge=${bad}`).challenge, bad).toBeNull()
        const options = { seed: 7, trump: 'HERC' as const, hands: 1, scores: null }
        expect(devTable({ ...options, belot: { player: 'bob', suit: 'PIK' } }, 0)).toEqual(playTable({ hands: 1, belot: { player: 'bob', suit: 'PIK' }, start: 0 }))
        const challenge = { by: 'dave', after: 2, foul: true }
        expect(devTable({ ...options, challenge }, 0)).toEqual(playTable({ hands: 1, challenge, start: 0 }))
    })

    test('the stored hands after a challenge: listed under its hand; a right one completes the hand with the challengers\' 162 and declarations', () => {
        // dave's right challenge after the hand's second card: team B takes 162 and its 20, team A nothing
        const right = playTable({ challenge: { by: 'dave', after: 2, foul: true } })
        const open = indexOf(right, 'window-open')
        const [hand] = devHands(right, open)
        expect(hand.challenges).toEqual([{ order: 0, player: 'dave', success: true }])
        expect(hand.handSummary).toMatchObject({
            teamAPoints: 0, teamBPoints: 162, teamADeclPoints: 0, teamBDeclPoints: 20, padanje: false, capot: false, finalScoreA: 0, finalScoreB: 182,
        })
        expect(endedHand([hand], { a: 0, b: 182 })).toBe(hand)
        // carol's: team B, caught, loses the declarations it won
        const caught = playTable({ challenge: { by: 'carol', after: 2, foul: true } })
        expect(devHands(caught, indexOf(caught, 'window-open'))[0].handSummary).toMatchObject({
            teamAPoints: 162, teamBPoints: 0, teamADeclPoints: 0, teamBDeclPoints: 0, finalScoreA: 162, finalScoreB: 0,
        })
        // in the window: the award taken back, the hand's summary stored again with the new scores
        const late = playTable({ challenge: { by: 'dave', after: 'window', foul: true } })
        const said = indexOf(late, 'challenge:')
        expect(devHands(late, said - 1)[0].handSummary).toMatchObject({ finalScoreA: 11, finalScoreB: 171 })
        const [corrected] = devHands(late, said)
        expect(corrected.challenges).toEqual([{ order: 0, player: 'dave', success: true }])
        expect(corrected.handSummary).toMatchObject({ teamAPoints: 0, teamBPoints: 162, teamADeclPoints: 0, teamBDeclPoints: 20, finalScoreA: 0, finalScoreB: 182 })
        expect(blokRows([corrected], (id) => (id === 'alice' || id === 'carol' ? 'A' : 'B'))).toEqual([{ handNo: 1, a: 0, b: 182, padanje: null, capot: null }])
        // a wrong one: listed, the hand played out and summed as before
        const wrong = playTable({ challenge: { by: 'bob', after: 2, foul: false } })
        const [played] = devHands(wrong, indexOf(wrong, 'window-open'))
        expect(played.challenges).toEqual([{ order: 0, player: 'bob', success: false }])
        expect(played.tricks).toHaveLength(8)
        expect(played.handSummary).toEqual(devHands(table, indexOf(table, 'window-open'))[0].handSummary)
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

    test('a hand\'s declaration points are what the table scored: the winning team\'s zvanja total, then bela (gameplay rules §2)', () => {
        // seed 44: dave holds a run of four and a run of three, and both count; the older declarations field keeps only the 50
        const t = playTable({ seed: 44 })
        const end = indexOf(t, 'hand-complete')
        const view = t[end].public
        expect(view.zvanja).toMatchObject({ winnerTeam: 'B', total: 70 })
        expect(view.declarations.dave.bestSequencePoints).toBe(50)
        const bela = (ids: string[]) => ids.filter((id) => view.belaDeclaredByPlayer[id]).length * 20
        const [hand] = devHands(t, end)
        expect(hand.handSummary).toMatchObject({ teamADeclPoints: bela(['alice', 'carol']), teamBDeclPoints: 70 + bela(['bob', 'dave']) })
    })
})
