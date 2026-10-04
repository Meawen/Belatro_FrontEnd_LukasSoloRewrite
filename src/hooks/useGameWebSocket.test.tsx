import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const fake = vi.hoisted(() => {
    const handlers = new Map<string, Set<(body: string) => void>>()
    const published: { destination: string; body: unknown }[] = []
    const counters = { acquired: 0, released: 0 }
    const state = { isConnected: true, isConnecting: false, error: null as string | null }
    const gameSocket = {
        acquire: () => {
            counters.acquired += 1
            return () => { counters.released += 1 }
        },
        subscribe: (destination: string, handler: (body: string) => void) => {
            if (!handlers.has(destination)) handlers.set(destination, new Set())
            handlers.get(destination)!.add(handler)
            return () => { handlers.get(destination)?.delete(handler) }
        },
        publish: (destination: string, body: unknown) => {
            published.push({ destination, body })
            return true
        },
        getState: () => state,
        onStateChange: () => () => {},
    }
    const deliver = (destination: string, body: string) => handlers.get(destination)?.forEach((h) => h(body))
    return { handlers, published, counters, gameSocket, deliver }
})
vi.mock('../services/gameSocket', () => ({ gameSocket: fake.gameSocket }))

import { useGameWebSocket } from './useGameWebSocket'

beforeEach(() => {
    fake.handlers.clear()
    fake.published.length = 0
    fake.counters.acquired = 0
    fake.counters.released = 0
})

describe('useGameWebSocket game channels', () => {
    test('subscribes to the public topic, the private queue and the error queue; unmount releases all', () => {
        const { result, unmount } = renderHook(() => useGameWebSocket({}))
        act(() => result.current.subscribeToGame('g1'))
        expect([...fake.handlers.keys()].sort()).toEqual(['/topic/games/g1', '/user/queue/errors', '/user/queue/games/g1'])
        expect(fake.counters.acquired).toBe(1)
        unmount()
        expect([...fake.handlers.values()].every((set) => set.size === 0)).toBe(true)
        expect(fake.counters.released).toBe(1)
    })

    test('routes views, errors and the DISCONNECT marker to the callbacks', () => {
        const onPublicGameUpdate = vi.fn()
        const onPrivateGameUpdate = vi.fn()
        const onGameError = vi.fn()
        const onGameDisconnect = vi.fn()
        const { result } = renderHook(() =>
            useGameWebSocket({ onPublicGameUpdate, onPrivateGameUpdate, onGameError, onGameDisconnect }))
        act(() => result.current.subscribeToGame('g1'))
        fake.deliver('/topic/games/g1', '{"gameId":"g1"}')
        fake.deliver('/user/queue/games/g1', '{"yourTurn":true}')
        fake.deliver('/user/queue/errors', 'Not a participant in game g1')
        fake.deliver('/topic/games/g1', 'DISCONNECT')
        expect(onPublicGameUpdate).toHaveBeenCalledWith({ gameId: 'g1' })
        expect(onPrivateGameUpdate).toHaveBeenCalledWith({ yourTurn: true })
        expect(onGameError).toHaveBeenCalledWith('Not a participant in game g1')
        expect(onGameDisconnect).toHaveBeenCalledTimes(1)
    })

    test('the ranked queue channels are the two /user/queue destinations', () => {
        const onQueueStatusUpdate = vi.fn()
        const onMatchFound = vi.fn()
        const { result } = renderHook(() => useGameWebSocket({ onQueueStatusUpdate, onMatchFound }))
        act(() => result.current.subscribeToRankedQueue())
        fake.deliver('/user/queue/ranked/status', '{"state":"IN_QUEUE"}')
        fake.deliver('/user/queue/match-found', '{"id":"m1"}')
        expect(onQueueStatusUpdate).toHaveBeenCalledWith({ state: 'IN_QUEUE' })
        expect(onMatchFound).toHaveBeenCalledWith({ id: 'm1' })
    })
})

describe('useGameWebSocket actions match the backend messages (actor comes from the JWT)', () => {
    test('play sends {card: {boja, rank}, declareBela} and no playerId', () => {
        const { result } = renderHook(() => useGameWebSocket({}))
        act(() => result.current.playCard('g1', { boja: 'HERC', rank: 'AS' }, false))
        expect(fake.published).toEqual([
            { destination: '/app/games/g1/play', body: { card: { boja: 'HERC', rank: 'AS' }, declareBela: false } },
        ])
    })

    test('bid sends {pass, trump}', () => {
        const { result } = renderHook(() => useGameWebSocket({}))
        act(() => result.current.placeBid('g1', false, 'KARA'))
        act(() => result.current.placeBid('g1', true))
        expect(fake.published).toEqual([
            { destination: '/app/games/g1/bid', body: { pass: false, trump: 'KARA' } },
            { destination: '/app/games/g1/bid', body: { pass: true, trump: null } },
        ])
    })

    test('challenge, refresh and cancel send an empty object', () => {
        const { result } = renderHook(() => useGameWebSocket({}))
        act(() => {
            result.current.challenge('g1')
            result.current.refreshGameState('g1')
            result.current.cancelMatch('g1')
        })
        expect(fake.published).toEqual([
            { destination: '/app/games/g1/challenge', body: {} },
            { destination: '/app/games/g1/refresh', body: {} },
            { destination: '/app/games/g1/cancel', body: {} },
        ])
    })
})
