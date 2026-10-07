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
    // like useGameWebSocket's: true when the move went out
    placeBid: vi.fn(() => true),
    playCard: vi.fn(() => true),
    challenge: vi.fn(() => true),
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

    test('the snapshot comes from the /app/queue subscription: no /refresh is sent (R-35)', () => {
        vi.useFakeTimers()
        const { result, rerender } = renderHook(() => useBelatroGame('g1'))
        ws.isConnected = true
        rerender()
        // what subscribeToGame's SUBSCRIBE to /app/queue/games/g1 answers
        act(() => ws.options.onPrivateGameUpdate?.(privateView))
        act(() => { vi.advanceTimersByTime(30000) })
        expect(result.current.publicView).toBe(publicView)
        expect(ws.refreshGameState).not.toHaveBeenCalled()
        expect(result.current.notAvailable).toBe(false)
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
        act(() => ws.options.onGameError?.('The dealer must call trump'))
        expect(result.current.error).toBe('The dealer must call trump')
        act(() => result.current.actions.bidTrump('HERC'))
        expect(ws.placeBid).toHaveBeenCalledWith('g1', false, 'HERC')
        expect(result.current.error).toBeNull()
        act(() => result.current.actions.passBid())
        expect(ws.placeBid).toHaveBeenLastCalledWith('g1', true)
        act(() => result.current.actions.play({ boja: 'KARA', rank: 'DESETKA' }))
        expect(ws.playCard).toHaveBeenCalledWith('g1', { boja: 'KARA', rank: 'DESETKA' }, false)
        // R-32: the table's Play + Bela
        act(() => result.current.actions.play({ boja: 'HERC', rank: 'BABA' }, true))
        expect(ws.playCard).toHaveBeenLastCalledWith('g1', { boja: 'HERC', rank: 'BABA' }, true)
        act(() => result.current.actions.challenge())
        expect(ws.challenge).toHaveBeenCalledWith('g1')
    })

    test('a cancelled game (DISCONNECT) calls onDisconnect', () => {
        const onDisconnect = vi.fn()
        renderHook(() => useBelatroGame('g1', onDisconnect))
        act(() => ws.options.onGameDisconnect?.())
        expect(onDisconnect).toHaveBeenCalledTimes(1)
    })

    test('a move made while the socket is down says so instead of vanishing (R-30)', () => {
        ws.playCard.mockReturnValueOnce(false)
        ws.placeBid.mockReturnValueOnce(false)
        const { result } = renderHook(() => useBelatroGame('g1'))
        act(() => result.current.actions.play({ boja: 'KARA', rank: 'DESETKA' }))
        expect(result.current.error).toBe('Not sent — reconnecting')
        act(() => result.current.actions.passBid())
        expect(result.current.error).toBe('Not sent — reconnecting')
        // the socket is back: the next move goes out and the notice clears
        act(() => result.current.actions.passBid())
        expect(result.current.error).toBeNull()
    })

    test('silence: one /refresh every 3 s, at most 3, then the page gives up and sends nothing more (R-35)', () => {
        vi.useFakeTimers()
        const { result, rerender } = renderHook(() => useBelatroGame('g1'))
        ws.isConnected = true
        rerender()
        act(() => { vi.advanceTimersByTime(2999) })
        expect(ws.refreshGameState).not.toHaveBeenCalled()
        act(() => { vi.advanceTimersByTime(1) })
        expect(ws.refreshGameState).toHaveBeenCalledTimes(1)
        act(() => { vi.advanceTimersByTime(3000) })
        act(() => { vi.advanceTimersByTime(3000) })
        expect(ws.refreshGameState).toHaveBeenCalledTimes(3)
        expect(result.current.notAvailable).toBe(false)
        act(() => { vi.advanceTimersByTime(3000) })
        expect(result.current.notAvailable).toBe(true)
        expect(ws.unsubscribeFromGame).toHaveBeenCalledWith('g1')
        act(() => { vi.advanceTimersByTime(60000) })
        expect(ws.refreshGameState).toHaveBeenCalledTimes(3)
    })

    test("an error frame naming this game ends the page at once: it isn't this player's (R-35)", () => {
        vi.useFakeTimers()
        const { result, rerender } = renderHook(() => useBelatroGame('g1'))
        ws.isConnected = true
        rerender()
        act(() => { vi.advanceTimersByTime(3000) })
        expect(ws.refreshGameState).toHaveBeenCalledTimes(1)
        act(() => ws.options.onGameError?.('Not a participant in game g1'))
        expect(result.current.notAvailable).toBe(true)
        expect(result.current.error).toBeNull()
        act(() => { vi.advanceTimersByTime(60000) })
        expect(ws.refreshGameState).toHaveBeenCalledTimes(1)
    })

    test('"Game not found" ends only a page with no game yet: the error queue is per user, not per game', () => {
        const first = renderHook(() => useBelatroGame('g1'))
        act(() => ws.options.onGameError?.('Game not found'))
        expect(first.result.current.notAvailable).toBe(true)
        first.unmount()
        // a page showing its table: another tab's "Game not found" is only shown, never fatal
        const second = renderHook(() => useBelatroGame('g1'))
        act(() => ws.options.onPrivateGameUpdate?.(privateView))
        act(() => ws.options.onGameError?.('Game not found'))
        expect(second.result.current.notAvailable).toBe(false)
        expect(second.result.current.error).toBe('Game not found')
    })

    test('a reconnect asks again through the subscription, with a fresh allowance of 3 refreshes', () => {
        vi.useFakeTimers()
        const { result, rerender } = renderHook(() => useBelatroGame('g1'))
        ws.isConnected = true
        rerender()
        act(() => { vi.advanceTimersByTime(3000) })
        act(() => { vi.advanceTimersByTime(3000) })
        act(() => ws.options.onPrivateGameUpdate?.(privateView))
        expect(ws.refreshGameState).toHaveBeenCalledTimes(2)
        ws.isConnected = false
        rerender()
        ws.isConnected = true
        rerender()
        // silence after the reconnect: three more refreshes before the page gives up
        act(() => { vi.advanceTimersByTime(3000) })
        act(() => { vi.advanceTimersByTime(3000) })
        act(() => { vi.advanceTimersByTime(3000) })
        expect(ws.refreshGameState).toHaveBeenCalledTimes(5)
        expect(result.current.notAvailable).toBe(false)
        act(() => { vi.advanceTimersByTime(3000) })
        expect(result.current.notAvailable).toBe(true)
    })

    test('a cancelled game stays on its end screen: DISCONNECT right behind the CANCELLED view does not leave (R-31)', () => {
        const onDisconnect = vi.fn()
        renderHook(() => useBelatroGame('g1', onDisconnect))
        act(() => {
            ws.options.onPublicGameUpdate?.({ ...publicView, gameState: 'CANCELLED', endReason: 'CANCELLED' } as PublicGameView)
            // the next frame, before React has rendered the view
            ws.options.onGameDisconnect?.()
        })
        expect(onDisconnect).not.toHaveBeenCalled()
    })

    test("a rematch refusal is shown as the table's error, not as \"not your game\" (R-45)", () => {
        const { result } = renderHook(() => useBelatroGame('g1'))
        act(() => ws.options.onGameError?.('Rematch is not available for game g1'))
        expect(result.current.error).toBe('Rematch is not available for game g1')
        expect(result.current.notAvailable).toBe(false)
    })
})
