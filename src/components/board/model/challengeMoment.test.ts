import { describe, test, expect } from 'vitest'
import { OUTCOME_MS, WHO_MS, challengeAt, challengeHeader, challengeSrLine, type ChallengeSaid } from './challengeMoment'
import type { LastChallengeView } from '../../../types/game'

// ivo (team B) challenges; the name is seatName's: the seat id, or "You" for me
const right: ChallengeSaid = { name: 'ivo', mine: false, team: 'B', foulFound: true }
const wrong: ChallengeSaid = { name: 'ivo', mine: false, team: 'B', foulFound: false }
const mineRight: ChallengeSaid = { name: 'You', mine: true, team: 'A', foulFound: true }
const mineWrong: ChallengeSaid = { name: 'You', mine: true, team: 'A', foulFound: false }

describe('the challenge said out loud (gameplay rules spec §6, D-5)', () => {
    test('first who challenges for 1.2 s, then the outcome for 2 s, then nothing', () => {
        expect([WHO_MS, OUTCOME_MS]).toEqual([1200, 2000])
        expect(challengeAt(right, 0)).toEqual({ step: 'who', text: 'ivo challenges!' })
        expect(challengeAt(right, WHO_MS - 1)).toEqual({ step: 'who', text: 'ivo challenges!' })
        expect(challengeAt(right, WHO_MS)).toEqual({ step: 'outcome', text: 'Foul found: Team B takes the hand' })
        expect(challengeAt(right, WHO_MS + OUTCOME_MS - 1)).toEqual({ step: 'outcome', text: 'Foul found: Team B takes the hand' })
        expect(challengeAt(right, WHO_MS + OUTCOME_MS)).toEqual({ step: 'done', text: null })
        expect(challengeAt(right, 60_000)).toEqual({ step: 'done', text: null })
        // a clock a little behind the start still says who
        expect(challengeAt(right, -50)).toEqual({ step: 'who', text: 'ivo challenges!' })
    })

    test('a wrong challenge: no foul, and the challenger has no challenge left', () => {
        expect(challengeAt(wrong, 0).text).toBe('ivo challenges!')
        expect(challengeAt(wrong, WHO_MS).text).toBe('No foul: ivo has no challenge left')
        expect(challengeAt(wrong, WHO_MS + OUTCOME_MS).text).toBeNull()
    })

    test('a right challenge names the challenger\'s team, whoever fouled', () => {
        expect(challengeAt({ ...right, team: 'A' }, WHO_MS).text).toBe('Foul found: Team A takes the hand')
    })

    test('my own challenge: "You challenge!", and "you have" when it was wrong', () => {
        expect(challengeAt(mineRight, 0).text).toBe('You challenge!')
        expect(challengeAt(mineRight, WHO_MS).text).toBe('Foul found: Team A takes the hand')
        expect(challengeAt(mineWrong, 0).text).toBe('You challenge!')
        expect(challengeAt(mineWrong, WHO_MS).text).toBe('No foul: you have no challenge left')
    })

    test('the screen-reader line: both steps\' words, once', () => {
        expect(challengeSrLine(right)).toBe('ivo challenges! Foul found: Team B takes the hand')
        expect(challengeSrLine(wrong)).toBe('ivo challenges! No foul: ivo has no challenge left')
        expect(challengeSrLine(mineRight)).toBe('You challenge! Foul found: Team A takes the hand')
        expect(challengeSrLine(mineWrong)).toBe('You challenge! No foul: you have no challenge left')
    })

    test('the hand-result header: only for a hand a right challenge decided', () => {
        const last: LastChallengeView = { number: 3, playerId: 'ivo', team: 'B', foulFound: true, thisHand: true }
        expect(challengeHeader(last)).toBe('Foul found: Team B takes the hand')
        expect(challengeHeader({ ...last, team: 'A' })).toBe('Foul found: Team A takes the hand')
        // a wrong one, or a right one in an earlier hand, leaves the usual header
        expect(challengeHeader({ ...last, foulFound: false })).toBeNull()
        expect(challengeHeader({ ...last, thisHand: false })).toBeNull()
        expect(challengeHeader(null)).toBeNull()
    })
})
