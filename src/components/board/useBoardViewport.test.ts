import { describe, test, expect, afterEach } from 'vitest'
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
