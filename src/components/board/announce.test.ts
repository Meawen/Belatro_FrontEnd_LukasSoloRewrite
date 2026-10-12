import { describe, test, expect } from 'vitest'
import { announce, seatName } from './announce'
import { EMPTY_LOCAL, boardModel, type BoardModel } from './model/boardModel'
import { find, playTable } from '../../test/fixtures/views/table'

const table = playTable()
const modelAt = (label: string, me = 'carol'): BoardModel => {
    const f = find(table, label)
    return boardModel({ publicView: f.private[me].publicPart, privateView: f.private[me], receivedAt: f.at, skew: 0, source: 'live' }, me, EMPTY_LOCAL)
}

describe('announce (spec §5.8)', () => {
    test('turns, plays, the trick winner and the trump call, with "You" for me', () => {
        const model = modelAt('play:bob:PIK-BABA')
        expect(seatName(model, 'carol')).toBe('You')
        expect(announce([
            { type: 'CardPlayed', playerId: 'bob', card: { boja: 'PIK', rank: 'BABA' }, id: 'PIK-BABA', mine: false, recovered: false },
            { type: 'Turn', playerId: 'carol' },
        ], model, null)).toEqual(['bob played Baba Pik', 'Your turn'])
        expect(announce([
            { type: 'CardPlayed', playerId: 'carol', card: { boja: 'PIK', rank: 'OSMICA' }, id: 'PIK-OSMICA', mine: true, recovered: false },
            { type: 'TrickCompleted', winnerId: 'dave', winnerTeam: 'B', cards: [], recovered: false },
            { type: 'Turn', playerId: 'dave' },
        ], model, null)).toEqual(['You played 8 Pik', 'dave wins the trick', "dave's turn"])
        expect(announce([{ type: 'Bid', playerId: 'alice', call: 'PASS' }, { type: 'TrumpCalled', suit: 'HERC', playerId: 'dave', dealerId: 'dave' }], model, null))
            .toEqual(['alice: Pass', 'dave called Herc'])
    })

    test('a bot\'s turn is not announced; what it plays still is, and a person\'s turn too (casual bots, R27)', () => {
        const base = modelAt('play:bob:PIK-BABA')
        const model: BoardModel = { ...base, seats: base.seats.map((seat) => (seat.id === 'dave' ? { ...seat, bot: true } : seat)) }
        expect(announce([
            { type: 'Turn', playerId: 'dave' },
            { type: 'CardPlayed', playerId: 'dave', card: { boja: 'PIK', rank: 'BABA' }, id: 'PIK-BABA', mine: false, recovered: false },
            { type: 'Turn', playerId: 'alice' },
        ], model, null)).toEqual(['dave played Baba Pik', "alice's turn"])
        expect(announce([{ type: 'Turn', playerId: 'carol' }], model, null)).toEqual(['Your turn'])
    })

    test('the hand result in Mi and Vi from my side, with its number once known', () => {
        const model = modelAt('hand-complete')
        expect(announce([{ type: 'HandCompleted', delta: { a: 11, b: 171 } }], model, 1)).toEqual(['Hand 1: Mi 11, Vi 171'])
        expect(announce([{ type: 'HandCompleted', delta: { a: 11, b: 171 } }], modelAt('hand-complete', 'dave'), null))
            .toEqual(['Hand finished: Mi 171, Vi 11'])
        expect(announce([{ type: 'HandCompleted', delta: null }], model, 2)).toEqual(['Hand 2'])
    })

    test('a challenge the view tells: the banner\'s words, once, with "You" for mine (gameplay rules §6)', () => {
        const model = modelAt('play:alice:PIK-SEDMICA')
        expect(announce([{ type: 'Challenged', number: 1, playerId: 'bob', team: 'B', foulFound: true, mine: false }], model, null))
            .toEqual(['bob challenges! Foul found: Team B takes the hand'])
        expect(announce([{ type: 'Challenged', number: 2, playerId: 'carol', team: 'A', foulFound: false, mine: true }], model, null))
            .toEqual(['You challenge! No foul: you have no challenge left'])
    })

    test("an older backend's inferred challenges keep their lines", () => {
        const model = modelAt('play:alice:PIK-SEDMICA')
        expect(announce([
            { type: 'ChallengeUpheld', team: 'B' },
            { type: 'ChallengeUpheld', team: null },
            { type: 'ChallengeFailed', playerId: 'bob', mine: false },
            { type: 'ChallengeFailed', playerId: 'carol', mine: true },
        ], model, null)).toEqual(['Challenge upheld: Team B takes the hand', 'Challenge upheld', 'bob challenged: no foul found', 'No foul found'])
    })

    test('the end says why it ended, else who won', () => {
        const over = playTable({ scores: [990, 900] })
        const f = find(over, 'game-over')
        const model = boardModel({ publicView: f.private.carol.publicPart, privateView: f.private.carol, receivedAt: f.at, skew: 0, source: 'live' }, 'carol', EMPTY_LOCAL)
        expect(announce([{ type: 'Ended', phase: 'COMPLETED' }], model, null)).toEqual(['Team B wins'])
    })

    test('a belot\'s end says the belot once, then who won (gameplay rules §3, §6)', () => {
        const belot = playTable({ belot: { player: 'bob', suit: 'PIK' } })
        const f = belot[belot.length - 1]
        const as = (me: string) => boardModel({ publicView: f.private[me].publicPart, privateView: f.private[me], receivedAt: f.at, skew: 0, source: 'live' }, me, EMPTY_LOCAL)
        expect(announce([{ type: 'Ended', phase: 'COMPLETED' }], as('carol'), null)).toEqual(['Belot! bob holds all eight Pik', 'Team B wins by belot'])
        expect(announce([{ type: 'Ended', phase: 'COMPLETED' }], as('bob'), null)).toEqual(['Belot! You hold all eight Pik', 'Team B wins by belot'])
    })
})
