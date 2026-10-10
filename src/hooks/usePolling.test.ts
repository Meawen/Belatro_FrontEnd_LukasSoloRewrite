import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePolling } from './usePolling'

function setVisibility(state: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
    document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
    vi.useFakeTimers()
})
afterEach(() => {
    vi.useRealTimers()
    // back to jsdom's own getter on Document.prototype
    delete (document as { visibilityState?: unknown }).visibilityState
})

describe('usePolling (spec §4.6, §4.7; D-16)', () => {
    test('polls every interval while the tab is visible, never at mount', () => {
        const poll = vi.fn()
        renderHook(() => usePolling(poll, 5000))
        expect(poll).not.toHaveBeenCalled()
        vi.advanceTimersByTime(5000)
        expect(poll).toHaveBeenCalledTimes(1)
        vi.advanceTimersByTime(10000)
        expect(poll).toHaveBeenCalledTimes(3)
    })

    test('a hidden tab does not poll; showing it polls once at once and resumes the interval', () => {
        const poll = vi.fn()
        renderHook(() => usePolling(poll, 2000))
        setVisibility('hidden')
        vi.advanceTimersByTime(10000)
        expect(poll).not.toHaveBeenCalled()
        setVisibility('visible')
        expect(poll).toHaveBeenCalledTimes(1)
        vi.advanceTimersByTime(2000)
        expect(poll).toHaveBeenCalledTimes(2)
    })

    test('a poll still in flight is never doubled: the ticks wait for it', async () => {
        let finish: () => void = () => {}
        const poll = vi.fn(() => new Promise<void>((done) => { finish = done }))
        renderHook(() => usePolling(poll, 2000))
        vi.advanceTimersByTime(6000)
        expect(poll).toHaveBeenCalledTimes(1)
        finish()
        await vi.advanceTimersByTimeAsync(2000)
        expect(poll).toHaveBeenCalledTimes(2)
    })

    test('off while disabled, on when enabled, and gone after unmount', () => {
        const poll = vi.fn()
        const { rerender, unmount } = renderHook(({ on }) => usePolling(poll, 2000, on), { initialProps: { on: false } })
        vi.advanceTimersByTime(6000)
        expect(poll).not.toHaveBeenCalled()
        rerender({ on: true })
        vi.advanceTimersByTime(2000)
        expect(poll).toHaveBeenCalledTimes(1)
        unmount()
        vi.advanceTimersByTime(6000)
        setVisibility('hidden')
        setVisibility('visible')
        expect(poll).toHaveBeenCalledTimes(1)
    })

    test('each tick calls the latest poll function', () => {
        const first = vi.fn()
        const second = vi.fn()
        const { rerender } = renderHook(({ poll }) => usePolling(poll, 2000), { initialProps: { poll: first } })
        rerender({ poll: second })
        vi.advanceTimersByTime(2000)
        expect(first).not.toHaveBeenCalled()
        expect(second).toHaveBeenCalledTimes(1)
    })
})
