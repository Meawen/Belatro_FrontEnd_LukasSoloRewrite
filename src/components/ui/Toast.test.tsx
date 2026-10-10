import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { Toaster } from './Toast'
import { TOAST_MS, showToast } from './toastStore'
import { rule, uiCss } from '../../test/css'

beforeEach(() => {
    vi.useFakeTimers()
})

afterEach(() => {
    act(() => vi.runOnlyPendingTimers())
    vi.useRealTimers()
})

describe('Toast (spec §3.7)', () => {
    test('showToast puts the message in the polite status region', () => {
        render(<Toaster />)
        const region = screen.getByRole('status')
        expect(region).toBeEmptyDOMElement()
        act(() => showToast('Invite link copied'))
        expect(region).toHaveTextContent('Invite link copied')
    })

    test('it goes after 1.8 s; a newer toast replaces it and restarts the clock', () => {
        render(<Toaster />)
        expect(TOAST_MS).toBe(1800)
        act(() => showToast('Invite link copied'))
        act(() => vi.advanceTimersByTime(1000))
        act(() => showToast('ivo challenged: no foul found'))
        expect(screen.getByRole('status')).toHaveTextContent(/^ivo challenged: no foul found$/)
        act(() => vi.advanceTimersByTime(1799))
        expect(screen.getByRole('status')).toHaveTextContent('ivo challenged: no foul found')
        act(() => vi.advanceTimersByTime(1))
        expect(screen.getByRole('status')).toBeEmptyDOMElement()
    })

    test('showing a toast with nothing mounted is harmless', () => {
        expect(() => showToast('Invite link copied')).not.toThrow()
    })

    test('top-centre above every layer, clear of the bottom bars, never catching a tap', () => {
        const toaster = rule('.ui-toaster', uiCss())
        expect(toaster).toMatch(/top:\s*calc\(12px \+ var\(--safe-top\)\);/)
        expect(toaster).toMatch(/z-index:\s*var\(--z-toast\);/)
        expect(toaster).toMatch(/pointer-events:\s*none;/)
    })
})
