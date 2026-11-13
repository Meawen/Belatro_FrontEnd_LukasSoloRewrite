import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import hand1 from './hand1.recording.json'
import { LESSONS, LESSON_RULES, RECORDING_FORMAT, refusalOf, stepsOf, storedHands, type LessonKey } from './script'
import { cardId } from '../components/board/model/rules'
import { blokRows, endedHand } from '../components/board/model/hands'
import { RULE_SECTIONS } from '../components/info/rulesData'
import type { CoachMove } from '../components/board/coach'
import type { Boja, GameCard, PrivateGameView, PublicGameView, Rank } from '../types/game'
import { en } from '../i18n/catalog/en'
import { hr } from '../i18n/catalog/hr'

// Škola bele's hand 1 (open beta §7.2): B8's recording of a real server game, and the steps the learner takes in it

/** The recording as text (this file is src/guide/script.test.ts). Not new URL(…, import.meta.url): Vite rewrites it. */
const text = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'hand1.recording.json'), 'utf8')

const guide = stepsOf(hand1)
const card = (boja: Boja, rank: Rank): GameCard => ({ boja, rank })
const play = (boja: Boja, rank: Rank, bela = false): CoachMove => ({ kind: 'play', card: card(boja, rank), bela })
const at = (lesson: LessonKey) => guide.steps.findIndex((step) => step.lesson === lesson)
/** The public views of the private frames up to frame `upTo`, as the replay has fed them. */
const fedTo = (upTo: number): PublicGameView[] =>
    guide.frames.slice(0, upTo + 1).flatMap((frame) => (frame.channel === 'private' ? [frame.body.publicPart] : []))
const teamOf = (view: PublicGameView) => (id: string) => (view.teamA.some((seat) => seat.id === id) ? 'A' : view.teamB.some((seat) => seat.id === id) ? 'B' : null)

/** A copy of the recording with `edit` applied, as stepsOf would read it. */
function edited(edit: (copy: { format: string; frames: { channel: string; body: { legalCards?: GameCard[] | null } }[]; steps: Record<string, unknown>[] }) => void): unknown {
    const copy = structuredClone(hand1) as unknown as Parameters<typeof edit>[0]
    edit(copy)
    return copy
}

describe('Škola bele hand 1: the recording and its steps (open beta §7.2)', () => {
    test('the recording is stiglja-recorded-views/1: 76 frames and B8’s 16 steps', () => {
        expect(RECORDING_FORMAT).toBe('stiglja-recorded-views/1')
        expect(guide.gameId).toBe('skola-bele-1')
        expect(guide.me).toBe('ti')
        expect(guide.frames).toHaveLength(76)
        guide.frames.forEach((frame, i) => expect(frame.channel, `frame ${i}`).toBe(i % 2 === 0 ? 'public' : 'private'))
        const versions = guide.frames.flatMap((frame) => (frame.channel === 'private' ? [frame.body.publicPart.stateVersion!] : []))
        versions.slice(1).forEach((version, i) => expect(version, `private frame ${i + 1}`).toBeGreaterThan(versions[i]))

        expect(guide.steps.map((step) => ({
            index: step.index, frame: step.frame, lesson: step.lesson, move: step.move?.kind ?? null,
            card: step.move?.kind === 'play' ? cardId(step.move.card) : step.move?.kind === 'bid' ? step.move.trump : null,
            bela: step.move?.kind === 'play' ? step.move.declareBela : null,
        }))).toEqual([
            { index: 0, frame: 3, lesson: 'dalje', move: null, card: null, bela: null },
            { index: 1, frame: 7, lesson: 'mus', move: 'bid', card: 'HERC', bela: null },
            { index: 2, frame: 9, lesson: 'zvanja', move: null, card: null, bela: null },
            { index: 3, frame: 15, lesson: 'followSuit', move: 'play', card: 'TREF-DEVETKA', bela: false },
            { index: 4, frame: 23, lesson: 'mustTrump', move: 'play', card: 'HERC-SEDMICA', bela: false },
            { index: 5, frame: 25, lesson: 'lead', move: 'play', card: 'TREF-DESETKA', bela: false },
            { index: 6, frame: 29, lesson: 'foul', move: null, card: null, bela: null },
            { index: 7, frame: 39, lesson: 'bela', move: 'play', card: 'HERC-KRALJ', bela: true },
            { index: 8, frame: 43, lesson: 'foulSeen', move: null, card: null, bela: null },
            { index: 9, frame: 47, lesson: 'followAfterCut', move: 'play', card: 'TREF-DECKO', bela: false },
            { index: 10, frame: 51, lesson: 'followTrump', move: 'play', card: 'HERC-BABA', bela: false },
            { index: 11, frame: 59, lesson: 'followPik', move: 'play', card: 'PIK-SEDMICA', bela: false },
            { index: 12, frame: 67, lesson: 'lastTrick', move: 'play', card: 'TREF-BABA', bela: false },
            { index: 13, frame: 73, lesson: 'padanje', move: null, card: null, bela: null },
            { index: 14, frame: 73, lesson: 'challenge', move: 'challenge', card: null, bela: null },
            { index: 15, frame: 75, lesson: 'foulFound', move: null, card: null, bela: null },
        ])
        expect(guide.steps.map((step) => step.lesson)).toEqual([...LESSONS])

        // every play is one the rules allow at that frame (the server's legalCards), and `legal` is that set
        for (const step of guide.steps) {
            const frame = guide.frames[step.frame]
            expect(frame.channel).toBe('private')
            const legal = (frame.body as PrivateGameView).legalCards
            if (step.move?.kind === 'play') {
                expect(legal!.map(cardId), step.lesson).toContain(cardId(step.move.card))
                expect(step.legal, step.lesson).toEqual(legal!.map(cardId))
            } else {
                expect(step.legal, step.lesson).toBeNull()
            }
        }
        expect(guide.steps[at('followSuit')].legal).toEqual(['TREF-DEVETKA', 'TREF-DESETKA', 'TREF-DECKO', 'TREF-BABA'])
        expect(new Set(guide.steps[at('bela')].legal)).toEqual(new Set(['HERC-BABA', 'HERC-KRALJ']))

        // the hand ends 232–0 after ti's right challenge
        const last = guide.frames[75].body as PrivateGameView
        expect([last.publicPart.teamAScore, last.publicPart.teamBScore]).toEqual([232, 0])
        expect(last.publicPart.lastChallenge).toMatchObject({ playerId: 'ti', team: 'A', foulFound: true })
        // a recording of a real game carries no credential
        expect(text).not.toContain('Bearer')
        expect(text).not.toContain('eyJ')
    })

    test('stepsOf refuses another format, an unknown lesson, a step on a public frame, and a play the rules don’t allow', () => {
        expect(() => stepsOf(edited((copy) => { copy.format = 'stiglja-recorded-views/2' }))).toThrow(/format/)
        expect(() => stepsOf(edited((copy) => { copy.steps[0].lesson = 'capot' }))).toThrow(/lesson/)
        expect(() => stepsOf(edited((copy) => { copy.steps[0].frame = 2 }))).toThrow(/private/)
        // followSuit's 7 Herc while holding Tref: not in the frame's legal cards
        expect(() => stepsOf(edited((copy) => { copy.steps[3].move = { kind: 'play', card: card('HERC', 'SEDMICA'), declareBela: false } }))).toThrow(/legal/)
        expect(() => stepsOf(null)).toThrow(/format/)
    })

    test('every lesson has a title and body in both catalogs, every move step a do-line, and each lesson a Rules section that exists', () => {
        expect(Object.keys(en.guide.lessons)).toEqual([...LESSONS])
        expect(Object.keys(hr.guide.lessons)).toEqual([...LESSONS])
        for (const lesson of LESSONS) {
            for (const catalog of [en, hr]) {
                expect(catalog.guide.lessons[lesson].title.trim(), lesson).not.toBe('')
                expect(catalog.guide.lessons[lesson].body.trim(), lesson).not.toBe('')
            }
        }
        const moving = guide.steps.filter((step) => step.move !== null).map((step) => step.lesson)
        expect(Object.keys(en.guide.do).sort()).toEqual([...moving].sort())
        expect(Object.keys(hr.guide.do).sort()).toEqual([...moving].sort())
        // a card's reasons belong to the steps where a card is played
        const playing = guide.steps.filter((step) => step.move?.kind === 'play').map((step) => step.lesson as string)
        for (const key of [...Object.keys(en.guide.illegal), ...Object.keys(en.guide.other)]) expect(playing, key).toContain(key)
        expect(Object.keys(LESSON_RULES)).toEqual([...LESSONS])
        for (const section of Object.values(LESSON_RULES)) expect(RULE_SECTIONS).toContain(section)
        expect(LESSON_RULES.mus).toBe('rules-bidding')
        expect(LESSON_RULES.padanje).toBe('rules-scoring')
        expect(LESSON_RULES.foulFound).toBe('rules-challenge')
    })

    test('a lesson shown over a live trick fits beside it on a phone: about 130 characters in both catalogs (Ruling 69)', () => {
        // the steps whose frame has a trick under way (1–3 cards): the panel sits over it on a portrait phone
        const live = guide.steps.filter((step) => {
            const frame = guide.frames[step.frame].body as PrivateGameView
            const cards = Object.keys(frame.publicPart.currentTrick?.plays ?? {}).length
            return cards > 0 && cards < 4
        }).map((step) => step.lesson)
        expect(live).toEqual(['followSuit', 'mustTrump', 'foul', 'bela', 'foulSeen', 'followAfterCut', 'followTrump', 'followPik', 'lastTrick'])
        for (const lesson of live) {
            for (const [name, catalog] of [['en', en], ['hr', hr]] as const) {
                // three lines at 375 px (Chromium, fix round 1: a fourth line reaches the side cards)
                expect(catalog.guide.lessons[lesson].body.length, `${name} ${lesson}`).toBeLessThanOrEqual(140)
            }
        }
        // the two foul stops (Nastavi takes a row) are the card and the rule, so ivo's card stays in sight
        for (const lesson of ['foul', 'foulSeen'] as const) {
            expect(en.guide.lessons[lesson].body.length, `en ${lesson}`).toBeLessThanOrEqual(100)
            expect(hr.guide.lessons[lesson].body.length, `hr ${lesson}`).toBeLessThanOrEqual(100)
        }
        // what the foul stop no longer says, the challenge lesson does (spec §7.2: real bots never foul)
        expect(en.guide.lessons.challenge.body).toContain('the bots on Stiglja never play one')
        expect(hr.guide.lessons.challenge.body).toContain('botovi na Stiglji nikad ne bacaju nedopuštene karte')
        expect(en.guide.lessons.foul.body).not.toContain('bots')
        expect(hr.guide.lessons.foul.body).not.toContain('botovi')
    })

    test('refusalOf names the reason for each kind of wrong move', () => {
        const cases: [LessonKey, boolean, CoachMove, string | null][] = [
            ['followSuit', true, play('HERC', 'SEDMICA'), 'illegal'],
            ['followSuit', true, play('TREF', 'DESETKA'), 'otherCard'],
            ['mus', true, { kind: 'bid', trump: 'KARA' }, 'bid'],
            ['mus', true, { kind: 'pass' }, 'pass'],
            ['bela', true, play('HERC', 'KRALJ', false), 'bela'],
            ['bela', true, play('HERC', 'BABA'), 'otherCard'],
            ['bela', true, play('PIK', 'SEDMICA'), 'illegal'],
            ['mustTrump', true, play('HERC', 'KRALJ'), 'otherCard'],
            ['mustTrump', true, play('TREF', 'DESETKA'), 'illegal'],
            // the real rule: you may challenge from the first card; before the foul it would be wrong
            ['followSuit', true, { kind: 'challenge' }, 'challengeEarly'],
            // after the foul it would be right, and would end the hand at once
            ['bela', true, { kind: 'challenge' }, 'challengeFoul'],
            // a stop before the foul: read it first
            ['dalje', true, { kind: 'challenge' }, 'readFirst'],
            ['zvanja', true, { kind: 'challenge' }, 'readFirst'],
            // a stop from the foul on (Ruling 69): a challenge would be right there (ivo held Kralj Tref)
            ['foul', true, { kind: 'challenge' }, 'challengeFoul'],
            ['foulSeen', true, { kind: 'challenge' }, 'challengeFoul'],
            // the hand is over at padanje: its 10 seconds are the real time to challenge (Ruling 70)
            ['padanje', true, { kind: 'challenge' }, 'challengeNow'],
            // on the way to it, the last trick may still be on: a right challenge would end the hand
            ['padanje', false, { kind: 'challenge' }, 'challengeFoul'],
            // on the way to the foul stop, before ivo's card is fed: no foul yet
            ['foul', false, { kind: 'challenge' }, 'challengeEarly'],
            // while the table moves: a card has nothing to say; a challenge says the rule by where the hand is
            ['followSuit', false, play('HERC', 'SEDMICA'), null],
            ['followSuit', false, { kind: 'challenge' }, 'challengeEarly'],
            ['bela', false, { kind: 'challenge' }, 'challengeFoul'],
        ]
        for (const [lesson, ready, move, kind] of cases) {
            expect(refusalOf(guide.steps, at(lesson), ready, move), `${lesson} ${ready ? 'ready' : 'moving'} ${JSON.stringify(move)}`).toBe(kind)
        }
    })

    test('storedHands gives the peek, Bela Blok and the hand result their hand, before and after the challenge', () => {
        const atFollowSuit = storedHands(fedTo(guide.steps[at('followSuit')].frame))
        expect(atFollowSuit).toHaveLength(1)
        expect(atFollowSuit[0].handNo).toBe(1)
        expect(atFollowSuit[0].tricks).toEqual([])
        expect(atFollowSuit[0].trumpCalls).toEqual([
            { order: 0, player: 'ivo', trump: 'PASS' },
            { order: 1, player: 'mara', trump: 'PASS' },
            { order: 2, player: 'ana', trump: 'PASS' },
            { order: 3, player: 'ti', trump: 'HERC' },
        ])
        expect(atFollowSuit[0].handSummary).toBeNull()

        const padanje = fedTo(guide.steps[at('padanje')].frame)
        const fell = storedHands(padanje)
        expect(fell[0].tricks!.map((trick) => trick.winnerId)).toEqual(['ivo', 'ti', 'ivo', 'ivo', 'ana', 'ana', 'ana', 'mara'])
        expect(fell[0].tricks!.map((trick) => trick.lastTrickBonus)).toEqual([false, false, false, false, false, false, false, true])
        expect(fell[0].tricks![2].moves).toEqual([
            { order: 0, player: 'ti', card: 'DESETKA of TREF', legal: null },
            { order: 1, player: 'ivo', card: 'DEVETKA of HERC', legal: null },
            { order: 2, player: 'mara', card: expect.any(String), legal: null },
            { order: 3, player: 'ana', card: expect.any(String), legal: null },
        ])
        expect(endedHand(fell, { a: 0, b: 232 })).toBe(fell[0])
        expect(blokRows(fell, teamOf(padanje.at(-1)!))).toEqual([{ handNo: 1, a: 0, b: 232, padanje: 'A', capot: null }])
        expect(fell[0].handSummary).toMatchObject({ teamADeclPoints: 70, teamBDeclPoints: 0, padanje: true, capot: false, teamATricksWon: 2, teamBTricksWon: 6 })
        expect(fell[0].challenges).toEqual([])

        const all = fedTo(75)
        const found = storedHands(all)
        expect(found).toHaveLength(1)
        expect(endedHand(found, { a: 232, b: 0 })).toBe(found[0])
        expect(blokRows(found, teamOf(all.at(-1)!))).toEqual([{ handNo: 1, a: 232, b: 0, padanje: null, capot: null }])
        expect(found[0].challenges).toEqual([{ order: 0, player: 'ti', success: true }])
        expect(found[0].handSummary).toMatchObject({ teamADeclPoints: 70, teamBDeclPoints: 0, padanje: false, finalScoreA: 232, finalScoreB: 0 })
    })
})
