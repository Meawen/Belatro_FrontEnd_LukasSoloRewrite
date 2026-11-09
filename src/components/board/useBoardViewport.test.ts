import { describe, test, expect, afterEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useBoardViewport } from './useBoardViewport'
import { layoutFor } from './model/fit'

const saved = (['devicePixelRatio', 'innerWidth', 'innerHeight'] as const).map((key) => [key, Object.getOwnPropertyDescriptor(window, key)] as const)

function setWindow(width: number, height: number, dpr: number) {
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: dpr })
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
}

afterEach(() => {
    for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(window, key, descriptor)
        else delete (window as unknown as Record<string, unknown>)[key]
    }
})

describe('useBoardViewport follows a zoom (board-fit spec §6, Review Focus 1)', () => {
    test('a zoom changes devicePixelRatio and fires resize: the viewport gets the new density, and layoutFor re-picks the sizes', () => {
        // 1920×1080 at 100 %, then 125 %: the CSS window shrinks to 1536×864 and the density grows to 1.25
        setWindow(1920, 1080, 1)
        const { result } = renderHook(() => useBoardViewport())
        expect(result.current.viewport).toEqual({ width: 1920, height: 1080, dpr: 1 })
        const before = layoutFor(result.current.viewport)
        act(() => {
            setWindow(1536, 864, 1.25)
            window.dispatchEvent(new Event('resize'))
        })
        expect(result.current.viewport).toEqual({ width: 1536, height: 864, dpr: 1.25 })
        const after = layoutFor(result.current.viewport)
        // crisp at the new density: whole device pixels per art pixel
        for (const size of [after.trick, after.hand]) expect(Math.abs((size.w * 1.25) / 71 - Math.round((size.w * 1.25) / 71))).toBeLessThan(1e-9)
        expect(after.viewport.dpr).not.toBe(before.viewport.dpr)
    })

    test('a move to a screen of another density fires no resize: the resolution query\'s change reaches the viewport, and the hook then watches the new density (final review)', () => {
        const queries: { media: string; listeners: Set<() => void> }[] = []
        vi.stubGlobal('matchMedia', (media: string) => {
            const entry = { media, listeners: new Set<() => void>() }
            queries.push(entry)
            return {
                matches: true, media,
                addEventListener: (_type: string, listener: () => void) => entry.listeners.add(listener),
                removeEventListener: (_type: string, listener: () => void) => entry.listeners.delete(listener),
            }
        })
        try {
            setWindow(1440, 900, 1)
            const { result, unmount } = renderHook(() => useBoardViewport())
            const watching = () => queries.filter((one) => one.listeners.size > 0).map((one) => one.media)
            expect(watching()).toEqual(['(resolution: 1dppx)'])
            act(() => {
                // dragged onto a 2× screen: the density changes, the window's CSS size doesn't, and no resize fires
                setWindow(1440, 900, 2)
                for (const listener of [...queries.find((one) => one.media === '(resolution: 1dppx)')!.listeners]) listener()
            })
            expect(result.current.viewport).toEqual({ width: 1440, height: 900, dpr: 2 })
            expect(watching()).toEqual(['(resolution: 2dppx)'])
            unmount()
            expect(watching()).toEqual([])
        } finally {
            vi.unstubAllGlobals()
        }
    })

    test('a density change alone (the window keeps its CSS size) still reaches the viewport', () => {
        setWindow(1440, 900, 1)
        const { result } = renderHook(() => useBoardViewport())
        act(() => {
            setWindow(1440, 900, 2)
            window.dispatchEvent(new Event('resize'))
        })
        expect(result.current.viewport.dpr).toBe(2)
    })
})
