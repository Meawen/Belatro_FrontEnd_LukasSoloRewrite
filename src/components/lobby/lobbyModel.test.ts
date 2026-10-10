import { describe, test, expect } from 'vitest'
import { createdAgo, filterLobbies, isFull, isMember, lobbyName, lobbyRowLabel, memberCount, membersOf, sortLobbies } from './lobbyModel'
import type { LobbyDTO } from '../../types/lobby'

const mira = { id: 'u9', username: 'mira_z' }
const luka = { id: 'u2', username: 'luka' }
const ivo = { id: 'u3', username: 'ivo' }
const tea = { id: 'u4', username: 'tea_r' }

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

    // X-6: today's "Most Players" added the other lobby's Team B (LobbyList.tsx:57)
    test('"Most players" orders by each lobby\'s own members, descending (AC 2, X-6)', () => {
        const three = lobby({ id: 'three', teamAPlayers: [mira], teamBPlayers: [ivo, tea] })
        const two = lobby({ id: 'two', teamAPlayers: [luka], teamBPlayers: [], unassignedPlayers: [tea] })
        expect(ids(sortLobbies([two, three], 'players'))).toEqual(['three', 'two'])
        expect(ids(sortLobbies([three, two], 'players'))).toEqual(['three', 'two'])
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

    test('a row is named by its lobby, host, members and privacy, and says when you are in (AC 6)', () => {
        const l = lobby({ teamAPlayers: [mira, luka], teamBPlayers: [ivo], privateLobby: true })
        expect(lobbyRowLabel(l, 'u7')).toBe('Kod Mire, host mira_z, 3 of 4, private')
        expect(lobbyRowLabel(l, 'u2')).toBe("Kod Mire, host mira_z, 3 of 4, private, you're in")
        expect(lobbyRowLabel(lobby(), null)).toBe('Kod Mire, host mira_z, 1 of 4')
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
