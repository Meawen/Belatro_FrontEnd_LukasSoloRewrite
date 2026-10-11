import { describe, test, expect } from 'vitest'
import { botCount, countLabel, countLine, createdAgo, filterLobbies, isBot, isFull, isMember, lobbyName, lobbyRowLabel, memberCount, membersOf, peopleCount, sortLobbies } from './lobbyModel'
import type { LobbyDTO } from '../../types/lobby'

const mira = { id: 'u9', username: 'mira_z' }
const luka = { id: 'u2', username: 'luka' }
const ivo = { id: 'u3', username: 'ivo' }
const tea = { id: 'u4', username: 'tea_r' }
const ana = { id: 'b1', username: 'Bot-Ana', bot: true }
const tin = { id: 'b2', username: 'Bot-Tin', bot: true }
const nika = { id: 'b3', username: 'Bot-Nika', bot: true }

function lobby(overrides: Partial<LobbyDTO> = {}): LobbyDTO {
    return {
        id: 'l1', name: 'Kod Mire', gameMode: 'CASUAL', status: 'WAITING', createdAt: '2026-10-09T18:00:00Z', hostUser: mira,
        teamAPlayers: [mira], teamBPlayers: [], unassignedPlayers: [], privateLobby: false, password: null,
        ...overrides,
    }
}

const ids = (lobbies: LobbyDTO[]) => lobbies.map((l) => l.id)

describe('lobbyModel (spec §4.6)', () => {
    test('members are both teams and Unassigned; the cap of 4 counts them all', () => {
        const l = lobby({ teamAPlayers: [mira, luka], teamBPlayers: [ivo], unassignedPlayers: [tea] })
        expect(membersOf(l).map((p) => p.username)).toEqual(['mira_z', 'luka', 'ivo', 'tea_r'])
        expect(memberCount(l)).toBe(4)
        expect(isFull(l)).toBe(true)
        expect(isFull(lobby({ unassignedPlayers: [tea] }))).toBe(false)
        expect(isMember(l, 'u4')).toBe(true)
        expect(isMember(l, 'u7')).toBe(false)
        expect(isMember(l, null)).toBe(false)
        expect(memberCount(lobby({ teamAPlayers: null, teamBPlayers: null, unassignedPlayers: null }))).toBe(0)
    })

    test('a bot is told by its flag, never by its name', () => {
        expect(isBot(ana)).toBe(true)
        expect(isBot({ id: 'u8', username: 'Bot-Mara' })).toBe(false)
        expect(isBot({ ...ana, bot: false })).toBe(false)
        expect(isBot(mira)).toBe(false)
        expect(isBot(null)).toBe(false)
        expect(isBot(undefined)).toBe(false)
        // the board's seats (a game's PlayerPublicInfo) go by the same rule (R13)
        expect(isBot({ id: 'Bot-Ana', cardsLeft: 6, bot: true })).toBe(true)
        expect(isBot({ id: 'Bot-Mara', cardsLeft: 6 })).toBe(false)
    })

    test('people and bots are counted apart; full means four people, so a host with three bots is not full', () => {
        const hostAndThreeBots = lobby({ teamAPlayers: [mira, ana], teamBPlayers: [tin, nika] })
        expect(memberCount(hostAndThreeBots)).toBe(4)
        expect(peopleCount(hostAndThreeBots)).toBe(1)
        expect(botCount(hostAndThreeBots)).toBe(3)
        expect(isFull(hostAndThreeBots)).toBe(false)

        const fourPeople = lobby({ teamAPlayers: [mira, luka], teamBPlayers: [ivo], unassignedPlayers: [tea] })
        expect(peopleCount(fourPeople)).toBe(4)
        expect(botCount(fourPeople)).toBe(0)
        expect(isFull(fourPeople)).toBe(true)

        const empty = lobby({ teamAPlayers: null, teamBPlayers: null, unassignedPlayers: null })
        expect(peopleCount(empty)).toBe(0)
        expect(botCount(empty)).toBe(0)
    })

    test('the count line counts people of 4, and names the bots when there are any', () => {
        expect(countLine(lobby())).toBe('1 of 4')
        expect(countLine(lobby({ teamBPlayers: [luka], unassignedPlayers: [tea] }))).toBe('3 of 4')
        expect(countLine(lobby({ teamAPlayers: [mira, ana] }))).toBe('1 of 4 · 1 bot')
        expect(countLine(lobby({ teamAPlayers: [mira, ana], teamBPlayers: [luka, tin] }))).toBe('2 of 4 · 2 bots')
        expect(countLine(lobby({ teamAPlayers: [mira, ana], teamBPlayers: [tin, nika] }))).toBe('1 of 4 · 3 bots')
    })

    test('the count\'s spoken form says the same with a comma, not the middle dot (R27)', () => {
        expect(countLabel(lobby())).toBe('1 of 4')
        expect(countLabel(lobby({ teamAPlayers: [mira, ana] }))).toBe('1 of 4, 1 bot')
        expect(countLabel(lobby({ teamAPlayers: [mira, ana], teamBPlayers: [tin, nika] }))).toBe('1 of 4, 3 bots')
    })

    // X-6: today's "Most Players" added the other lobby's Team B (LobbyList.tsx:57)
    test('"Most players" orders by each lobby\'s own members, descending (AC 2, X-6)', () => {
        const three = lobby({ id: 'three', teamAPlayers: [mira], teamBPlayers: [ivo, tea] })
        const two = lobby({ id: 'two', teamAPlayers: [luka], teamBPlayers: [], unassignedPlayers: [tea] })
        expect(ids(sortLobbies([two, three], 'players'))).toEqual(['three', 'two'])
        expect(ids(sortLobbies([three, two], 'players'))).toEqual(['three', 'two'])
    })

    test('"Most players" counts people, not bots', () => {
        const bots = lobby({ id: 'bots', teamAPlayers: [mira, ana], teamBPlayers: [tin, nika] })
        const two = lobby({ id: 'two', teamAPlayers: [luka], teamBPlayers: [ivo] })
        expect(ids(sortLobbies([bots, two], 'players'))).toEqual(['two', 'bots'])
        expect(ids(sortLobbies([two, bots], 'players'))).toEqual(['two', 'bots'])
    })

    test('Newest first by creation time; Name from A to Z; the input is left alone', () => {
        const older = lobby({ id: 'older', name: 'Zagreb', createdAt: '2026-10-09T17:00:00Z' })
        const newer = lobby({ id: 'newer', name: 'Bjelovar', createdAt: '2026-10-09T18:30:00Z' })
        const input = [older, newer]
        expect(ids(sortLobbies(input, 'newest'))).toEqual(['newer', 'older'])
        expect(ids(sortLobbies([newer, older], 'name'))).toEqual(['newer', 'older'])
        expect(ids(input)).toEqual(['older', 'newer'])
    })

    test('search finds a lobby by its name or its host, in any case; a blank search shows all', () => {
        const kod = lobby({ id: 'kod' })
        const petak = lobby({ id: 'petak', name: 'Petak', hostUser: luka })
        expect(ids(filterLobbies([kod, petak], 'MIRE'))).toEqual(['kod'])
        expect(ids(filterLobbies([kod, petak], 'luk'))).toEqual(['petak'])
        expect(ids(filterLobbies([kod, petak], '  '))).toEqual(['kod', 'petak'])
        expect(lobbyName(lobby({ name: null }))).toBe('Unnamed Lobby')
    })

    test('a row is named by its lobby, host, people and bots and privacy, and says when you are in (AC 6)', () => {
        const l = lobby({ teamAPlayers: [mira, luka], teamBPlayers: [ivo], privateLobby: true })
        expect(lobbyRowLabel(l, 'u7')).toBe('Kod Mire, host mira_z, 3 of 4, private')
        expect(lobbyRowLabel(l, 'u2')).toBe("Kod Mire, host mira_z, 3 of 4, private, you're in")
        expect(lobbyRowLabel(lobby(), null)).toBe('Kod Mire, host mira_z, 1 of 4')
        const withBots = lobby({ teamAPlayers: [mira, ana], teamBPlayers: [luka, tin] })
        expect(lobbyRowLabel(withBots, 'u2')).toBe("Kod Mire, host mira_z, 2 of 4, 2 bots, you're in")
    })

    test('"Created …" in words: just now, minutes, hours, days; nothing without a date', () => {
        const now = Date.parse('2026-10-09T20:00:00Z')
        expect(createdAgo('2026-10-09T19:59:30Z', now)).toBe('just now')
        expect(createdAgo('2026-10-09T19:55:00Z', now)).toBe('5 minutes ago')
        expect(createdAgo('2026-10-09T18:00:00Z', now)).toBe('2 hours ago')
        expect(createdAgo('2026-10-08T19:00:00Z', now)).toBe('1 day ago')
        expect(createdAgo(null, now)).toBeNull()
        expect(createdAgo('not a date', now)).toBeNull()
    })
})
