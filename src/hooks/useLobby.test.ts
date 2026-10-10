import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { LOBBY_LIST_POLL_MS, useOpenLobbies } from './useLobby'
import { lobbyService } from '../services/lobbyService'
import { ApiError } from '../services/api'
import type { LobbyDTO } from '../types/lobby'

const mira = { id: 'u9', username: 'mira_z' }

function lobby(id: string): LobbyDTO {
    return {
        id, name: id, gameMode: 'CASUAL', status: 'WAITING', createdAt: null, hostUser: mira,
        teamAPlayers: [mira], teamBPlayers: [], unassignedPlayers: [], privateLobby: false, password: null,
    }
}

function setVisibility(state: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
    document.dispatchEvent(new Event('visibilitychange'))
}

const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(0) })
const wait = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const ids = (lobbies: LobbyDTO[] | null) => lobbies?.map((l) => l.id)

beforeEach(() => {
    vi.useFakeTimers()
})
afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    delete (document as { visibilityState?: unknown }).visibilityState
})

describe('useOpenLobbies (spec §4.6 Data)', () => {
    test('loads the open lobbies, then polls every 5 s while visible and not while hidden (AC 1, D-16)', async () => {
        const getOpen = vi.spyOn(lobbyService, 'getAllOpenLobbies').mockResolvedValue([lobby('l1')])
        const { result } = renderHook(() => useOpenLobbies())
        expect(result.current.loading).toBe(true)
        await settle()
        expect(ids(result.current.lobbies)).toEqual(['l1'])
        expect(result.current.loading).toBe(false)
        expect(getOpen).toHaveBeenCalledTimes(1)

        await wait(LOBBY_LIST_POLL_MS)
        expect(getOpen).toHaveBeenCalledTimes(2)
        setVisibility('hidden')
        await wait(3 * LOBBY_LIST_POLL_MS)
        expect(getOpen).toHaveBeenCalledTimes(2)
        setVisibility('visible')
        await settle()
        expect(getOpen).toHaveBeenCalledTimes(3)
        expect(LOBBY_LIST_POLL_MS).toBe(5000)
    })

    test('a failed poll keeps the last good list and says so; the next good poll clears it', async () => {
        const getOpen = vi.spyOn(lobbyService, 'getAllOpenLobbies').mockResolvedValue([lobby('l1')])
        const { result } = renderHook(() => useOpenLobbies())
        await settle()
        getOpen.mockRejectedValue(new ApiError({ status: 0, message: 'Failed to fetch' }))
        await wait(LOBBY_LIST_POLL_MS)
        expect(ids(result.current.lobbies)).toEqual(['l1'])
        expect(result.current.pollFailed).toBe(true)

        getOpen.mockResolvedValue([lobby('l1'), lobby('l2')])
        await wait(LOBBY_LIST_POLL_MS)
        expect(ids(result.current.lobbies)).toEqual(['l1', 'l2'])
        expect(result.current.pollFailed).toBe(false)
    })

    test('one request per poll: a slow answer is not asked for again until it comes', async () => {
        const getOpen = vi.spyOn(lobbyService, 'getAllOpenLobbies').mockResolvedValue([lobby('l1')])
        renderHook(() => useOpenLobbies())
        await settle()
        getOpen.mockImplementation(() => new Promise<LobbyDTO[]>(() => {}))
        await wait(3 * LOBBY_LIST_POLL_MS)
        expect(getOpen).toHaveBeenCalledTimes(2)
    })

    test('a failed first load shows no list and does not poll; Try again loads it', async () => {
        const getOpen = vi.spyOn(lobbyService, 'getAllOpenLobbies').mockRejectedValue(new ApiError({ status: 503, message: 'Service Unavailable' }))
        const { result } = renderHook(() => useOpenLobbies())
        await settle()
        expect(result.current).toMatchObject({ lobbies: null, loading: false, failed: true, pollFailed: false })
        await wait(3 * LOBBY_LIST_POLL_MS)
        expect(getOpen).toHaveBeenCalledTimes(1)

        getOpen.mockResolvedValue([])
        await act(() => result.current.refresh())
        expect(result.current).toMatchObject({ lobbies: [], loading: false, failed: false })
    })
})
