import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { RematchFrame } from '../types/game'

const ws = vi.hoisted(() => ({
    options: {} as { onRematchUpdate?: (frame: RematchFrame) => void },
    subscribeToRematch: vi.fn(),
    unsubscribeFromRematch: vi.fn(),
    voteRematch: vi.fn(() => true),
    declineRematch: vi.fn(() => true),
}))
vi.mock('./useGameWebSocket', () => ({
    useGameWebSocket: (options: typeof ws.options) => {
        ws.options = options
        return {
            subscribeToRematch: ws.subscribeToRematch,
            unsubscribeFromRematch: ws.unsubscribeFromRematch,
            voteRematch: ws.voteRematch,
            declineRematch: ws.declineRematch,
        }
    },
}))
const router = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('react-router-dom', () => ({ useNavigate: () => router.navigate }))

import { useRematch } from './useRematch'

beforeEach(() => {
    vi.clearAllMocks()
    ws.options = {}
})
afterEach(() => vi.useRealTimers())

describe('useRematch (R-45)', () => {
    test('while the game runs: no rematch channel and no clock', () => {
        vi.useFakeTimers()
        const { result } = renderHook(() => useRematch('g1', false))
        expect(ws.subscribeToRematch).not.toHaveBeenCalled()
        act(() => { vi.advanceTimersByTime(3 * 60_000) })
        expect(result.current.expired).toBe(false)
    })

    test('game over: it listens on the rematch channel, and Play again sends the vote', () => {
        const { result, unmount } = renderHook(() => useRematch('g1', true))
        expect(ws.subscribeToRematch).toHaveBeenCalledWith('g1')
        act(() => result.current.playAgain())
        expect(ws.voteRematch).toHaveBeenCalledWith('g1')
        unmount()
        expect(ws.unsubscribeFromRematch).toHaveBeenCalledWith('g1')
    })

    test('VOTE frames give the count', () => {
        const { result } = renderHook(() => useRematch('g1', true))
        expect(result.current.votes).toBe(0)
        act(() => ws.options.onRematchUpdate?.({ type: 'VOTE', accepted: ['alice', 'carol'] }))
        expect(result.current.votes).toBe(2)
    })

    test('START takes the seat to the new game, replacing the old one in history', () => {
        renderHook(() => useRematch('g1', true))
        act(() => ws.options.onRematchUpdate?.({ type: 'START', newGameId: 'g2' }))
        expect(router.navigate).toHaveBeenCalledWith('/game/g2', { replace: true })
    })

    test('CANCEL names who left', () => {
        const { result } = renderHook(() => useRematch('g1', true))
        act(() => ws.options.onRematchUpdate?.({ type: 'CANCEL', by: 'bob' }))
        expect(result.current.cancelledBy).toBe('bob')
    })

    test('two minutes without a START: expired', () => {
        vi.useFakeTimers()
        const { result } = renderHook(() => useRematch('g1', true))
        act(() => { vi.advanceTimersByTime(119_999) })
        expect(result.current.expired).toBe(false)
        act(() => { vi.advanceTimersByTime(1) })
        expect(result.current.expired).toBe(true)
    })

    test('Leave sends the decline, then goes back to the lobbies', () => {
        const { result } = renderHook(() => useRematch('g1', true))
        act(() => result.current.leave())
        expect(ws.declineRematch).toHaveBeenCalledWith('g1')
        expect(router.navigate).toHaveBeenCalledWith('/lobbies')
        expect(ws.declineRematch.mock.invocationCallOrder[0]).toBeLessThan(router.navigate.mock.invocationCallOrder[0])
    })
})
