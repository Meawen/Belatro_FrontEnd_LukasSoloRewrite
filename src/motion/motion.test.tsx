import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { m, motion } from 'motion/react'
import { MotionProvider, fade, hold, path, press, spring, stagger, useReducedMotion } from '.'
import { captureConsole } from '../test/captureConsole'

// The OS asks for reduced motion in this file. Motion reads it once, on first use, as "(prefers-reduced-motion)".
beforeAll(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query.startsWith('(prefers-reduced-motion'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
    }))
})

afterAll(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('motion tokens (spec §3.8)', () => {
    test('four critically damped springs, never a bounce', () => {
        expect(spring).toEqual({
            ui: { type: 'spring', bounce: 0, visualDuration: 0.35 },
            quick: { type: 'spring', bounce: 0, visualDuration: 0.2 },
            sheet: { type: 'spring', bounce: 0, visualDuration: 0.3 },
            felt: { type: 'spring', bounce: 0, visualDuration: 0.5 },
        })
    })

    test('the deal and sweep staggers, the trick hold, the press and the reduced-motion fade', () => {
        expect(stagger).toEqual({ deal: 0.03, sweep: 0.04 })
        expect(hold).toEqual({ trick: 900 })
        expect(press).toBe('transform 90ms ease-out')
        expect(fade).toEqual({ duration: 0.075, ease: 'linear' })
    })

    test('path.card makes a new arc for each card, so each keeps its own curve', () => {
        const a = path.card()
        const b = path.card()
        expect(a).not.toBe(b)
        expect(typeof a.animateVisualElement).toBe('function')
    })
})

describe('MotionProvider and useReducedMotion (spec §3.8)', () => {
    const inside = (reducedMotion?: 'user' | 'always' | 'never') =>
        ({ children }: { children: ReactNode }) => <MotionProvider reducedMotion={reducedMotion}>{children}</MotionProvider>

    test('follows the OS preference by default', () => {
        expect(renderHook(useReducedMotion, { wrapper: inside() }).result.current).toBe(true)
    })

    test('can be forced on or off (the dev board toggle)', () => {
        expect(renderHook(useReducedMotion, { wrapper: inside('always') }).result.current).toBe(true)
        expect(renderHook(useReducedMotion, { wrapper: inside('never') }).result.current).toBe(false)
    })

    test('without a provider nothing counts as reduced (Motion\'s default), so tests that need it mount the provider', () => {
        expect(renderHook(useReducedMotion).result.current).toBe(false)
    })

    test('m.div renders inside it; motion.div throws (strict LazyMotion keeps the bundle small)', () => {
        const { getByTestId } = render(<MotionProvider><m.div data-testid="m" /></MotionProvider>)
        expect(getByTestId('m')).toBeInTheDocument()
        captureConsole()
        expect(() => render(<MotionProvider><motion.div /></MotionProvider>)).toThrow()
    })
})
