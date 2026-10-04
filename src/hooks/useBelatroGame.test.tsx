import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { PrivateGameView, PublicGameView } from '../types/game'

type Options = {
    onPublicGameUpdate?: (view: PublicGameView) => void
    onPrivateGameUpdate?: (view: PrivateGameView) => void
    onGameError?: (message: string) => void
    onGameDisconnect?: () => void
}

const ws = vi.hoisted(() => ({
    options: {} as Options,
    isConnected: false,
    subscribeToGame: vi.fn(),
    unsubscribeFromGame: vi.fn(),
    refreshGameState: vi.fn(),
    placeBid: vi.fn(),
    playCard: vi.fn(),
    challenge: vi.fn(),
}))
vi.mock('./useGameWebSocket', () => ({
    useGameWebSocket: (options: Options) => {
        ws.options = options
        return {
            isConnected: ws.isConnected,
            isConnecting: false,
            connectionError: null,
            subscribeToGame: ws.subscribeToGame,
            unsubscribeFromGame: ws.unsubscribeFromGame,
            refreshGameState: ws.refreshGameState,
            placeBid: ws.placeBid,
            playCard: ws.playCard,
            challenge: ws.challenge,
        }
    },
}))

import { useBelatroGame } from './useBelatroGame'

const publicView = { gameId: 'g1', gameState: 'BIDDING', bids: [], teamAScore: 0, teamBScore: 0 } as unknown as PublicGameView
const privateView = {
    publicPart: publicView, hand: [{ boja: 'HERC', rank: 'AS' }], yourTurn: true, challengeUsed: false,
} as PrivateGameView

beforeEach(() => {
    vi.clearAllMocks()
    ws.isConnected = false
    ws.options = {}
})
afterEach(() => vi.useRealTimers())

describe('useBelatroGame', () => {
    test('subscribes to its game on mount and unsubscribes on unmount', () => {
        const { unmount } = renderHook(() => useBelatroGame('g1'))
        expect(ws.subscribeToGame).toHaveBeenCalledWith('g1')
        unmount()
        expect(ws.unsubscribeFromGame).toHaveBeenCalledWith('g1')
    })

    test('once connected it asks for a snapshot, every 2 s, until the private view arrives', () => {
        vi.useFakeTimers()
        const { rerender } = renderHook(() => useBelatroGame('g1'))
        expect(ws.refreshGameState).not.toHaveBeenCalled()
        ws.isConnected = true
        rerender()
        expect(ws.refreshGameState).toHaveBeenCalledTimes(1)
        act(() => { vi.advanceTimersByTime(2000) })
        expect(ws.refreshGameState).toHaveBeenCalledTimes(2)
        act(() => ws.options.onPrivateGameUpdate?.(privateView))
        act(() => { vi.advanceTimersByTime(6000) })
        expect(ws.refreshGameState).toHaveBeenCalledTimes(2)
    })

    test('a private view sets both views; a later public view replaces the public part', () => {
        const { result } = renderHook(() => useBelatroGame('g1'))
        act(() => ws.options.onPrivateGameUpdate?.(privateView))
        expect(result.current.privateView).toBe(privateView)
        expect(result.current.publicView).toBe(publicView)
        const next = { ...publicView, gameState: 'PLAYING' } as PublicGameView
        act(() => ws.options.onPublicGameUpdate?.(next))
        expect(result.current.publicView).toBe(next)
    })

    test('actions send this game\'s moves and clear the last error', () => {
        const { result } = renderHook(() => useBelatroGame('g1'))
        act(() => ws.options.onGameError?.('Not a participant in game g1'))
        expect(result.current.error).toBe('Not a participant in game g1')
        act(() => result.current.actions.bidTrump('HERC'))
        expect(ws.placeBid).toHaveBeenCalledWith('g1', false, 'HERC')
        expect(result.current.error).toBeNull()
        act(() => result.current.actions.passBid())
        expect(ws.placeBid).toHaveBeenLastCalledWith('g1', true)
        act(() => result.current.actions.play({ boja: 'KARA', rank: 'DESETKA' }))
        expect(ws.playCard).toHaveBeenCalledWith('g1', { boja: 'KARA', rank: 'DESETKA' }, false)
        act(() => result.current.actions.challenge())
        expect(ws.challenge).toHaveBeenCalledWith('g1')
    })

    test('a cancelled game (DISCONNECT) calls onDisconnect', () => {
        const onDisconnect = vi.fn()
        renderHook(() => useBelatroGame('g1', onDisconnect))
        act(() => ws.options.onGameDisconnect?.())
        expect(onDisconnect).toHaveBeenCalledTimes(1)
    })
})
