import { describe, test, expect } from 'vitest'
import { isReadyToStart, lobbyHint, memberStatus, seatAction, seatLabel, seatedCount, startReadiness, tableSeats, teamOf } from './seats'
import type { LobbyDTO } from '../../types/lobby'

const mira = { id: 'u9', username: 'mira_z' }
const luka = { id: 'u2', username: 'luka' }
const ivo = { id: 'u3', username: 'ivo' }
const tea = { id: 'u4', username: 'tea_r' }
const dino = { id: 'u5', username: 'dino' }

function lobby(overrides: Partial<LobbyDTO> = {}): LobbyDTO {
    return {
        id: 'l1', name: 'Kod Mire', gameMode: 'CASUAL', status: 'WAITING', createdAt: null, hostUser: mira,
        teamAPlayers: [mira, luka], teamBPlayers: [ivo], unassignedPlayers: [], privateLobby: false, password: null,
        ...overrides,
    }
}

/** "position:key=name" for each seat, empty seats as "-". */
const layout = (l: LobbyDTO, viewer: string | null) =>
    tableSeats(l, viewer).map((s) => `${s.position}:${s.key}=${s.player?.username ?? '-'}`)

describe('seats (spec §4.7, §5.3.2)', () => {
    test('not seated: A1 at the bottom, then B1, A2, B2 counter-clockwise', () => {
        expect(layout(lobby(), null)).toEqual(['bottom:A1=mira_z', 'right:B1=ivo', 'top:A2=luka', 'left:B2=-'])
        expect(layout(lobby({ unassignedPlayers: [tea] }), 'u4')).toEqual(['bottom:A1=mira_z', 'right:B1=ivo', 'top:A2=luka', 'left:B2=-'])
    })

    test('a seated viewer is at the bottom, the next in turn order on the right, the partner on top (AC 11)', () => {
        expect(layout(lobby(), 'u3')).toEqual(['bottom:B1=ivo', 'right:A2=luka', 'top:B2=-', 'left:A1=mira_z'])
        expect(layout(lobby(), 'u2')).toEqual(['bottom:A2=luka', 'right:B2=-', 'top:A1=mira_z', 'left:B1=ivo'])
        const full = lobby({ teamBPlayers: [ivo, tea] })
        expect(layout(full, 'u4')).toEqual(['bottom:B2=tea_r', 'right:A1=mira_z', 'top:B1=ivo', 'left:A2=luka'])
    })

    test('empty seats sit in the slots their team\'s list leaves free', () => {
        expect(layout(lobby({ teamAPlayers: [luka], teamBPlayers: [] }), null)).toEqual(['bottom:A1=luka', 'right:B1=-', 'top:A2=-', 'left:B2=-'])
    })

    test('teams, the seated count and the start rule: 2 + 2 and nobody unassigned', () => {
        expect(teamOf(lobby({ unassignedPlayers: [tea] }), 'u4')).toBe('U')
        expect(teamOf(lobby(), 'u3')).toBe('B')
        expect(teamOf(lobby(), 'u7')).toBeNull()
        expect(teamOf(lobby(), null)).toBeNull()
        expect(seatedCount(lobby({ unassignedPlayers: [tea] }))).toBe(3)
        expect(isReadyToStart(lobby({ teamBPlayers: [ivo, tea] }))).toBe(true)
        expect(isReadyToStart(lobby())).toBe(false)
    })

    test('what a tap does: a member sits on the other team, opens their own seat; only the host removes', () => {
        const l = lobby({ unassignedPlayers: [tea] })
        const seat = (viewer: string | null, key: string) => tableSeats(l, viewer).find((s) => s.key === key)!
        expect(seatAction(seat('u4', 'B2'), l, 'u4')).toBe('sit')
        expect(seatAction(seat('u3', 'B2'), l, 'u3')).toBeNull()
        expect(seatAction(seat('u2', 'B2'), l, 'u2')).toBe('sit')
        expect(seatAction(seat('u3', 'B1'), l, 'u3')).toBe('own')
        expect(seatAction(seat('u9', 'A2'), l, 'u9')).toBe('remove')
        expect(seatAction(seat('u4', 'A2'), l, 'u4')).toBeNull()
        expect(seatAction(seat('u7', 'B2'), l, 'u7')).toBeNull()
        expect(seatAction(seat(null, 'B2'), l, null)).toBeNull()
    })

    test('seat names (AC 10)', () => {
        const l = lobby({ unassignedPlayers: [tea] })
        const label = (viewer: string | null, key: string) => seatLabel(tableSeats(l, viewer).find((s) => s.key === key)!, l, viewer)
        expect(label('u4', 'B2')).toBe('Sit here, team B')
        expect(label('u3', 'B2')).toBe('Open seat, team B')
        expect(label('u7', 'B2')).toBe('Open seat, team B')
        expect(label('u4', 'A2')).toBe('luka, team A')
        expect(label('u4', 'A1')).toBe('mira_z, team A, host')
        expect(label('u3', 'B1')).toBe('ivo (you), team B')
        expect(label('u9', 'A1')).toBe('mira_z (you), team A')
    })

    test('the host\'s reason line says what is missing (AC 4)', () => {
        expect(startReadiness(lobby({ teamAPlayers: [mira], teamBPlayers: [] }))).toEqual({ ready: false, reason: 'Waiting for 3 more players.' })
        expect(startReadiness(lobby())).toEqual({ ready: false, reason: 'Waiting for 1 more player.' })
        expect(startReadiness(lobby({ unassignedPlayers: [tea, dino], teamBPlayers: [] }))).toEqual({ ready: false, reason: "tea_r hasn't taken a seat yet." })
        expect(startReadiness(lobby({ teamBPlayers: [ivo, tea] }))).toEqual({ ready: true, reason: 'Everyone is seated.' })
    })

    test('hints under the table and the member\'s status line', () => {
        const l = lobby({ unassignedPlayers: [tea] })
        expect(lobbyHint(l, 'u9')).toBeNull()
        expect(lobbyHint(l, 'u7')).toBe('You are looking at this lobby. Join to pick a seat.')
        expect(lobbyHint(l, 'u4')).toBe('Pick a seat. Partners sit opposite each other.')
        expect(lobbyHint(l, 'u3')).toBe('The host starts the match when all four seats are taken.')
        expect(memberStatus(l, 'u4')).toBe('Tap an open seat.')
        expect(memberStatus(l, 'u3')).toBe("You're on Team B.")
    })
})
