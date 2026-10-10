import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { Arena } from './Arena'
import { fieldMode } from './fieldMode'
import { MotionProvider } from '../../motion/MotionProvider'
import { writeTableEffects } from '../../settings/tableEffects'

// jsdom draws nothing: no 2D context unless a test brings one
beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
    writeTableEffects('full')
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

const props = { burst: 0, instant: false, calm: false }

describe('Arena (spec §5.7)', () => {
    test('data-season follows the trump’s season, and the felt layer takes its colours', () => {
        const { rerender } = render(<Arena season="none" {...props} />)
        expect(screen.getByTestId('arena')).toHaveAttribute('data-season', 'none')
        rerender(<Arena season="summer" {...props} />)
        expect(screen.getByTestId('arena')).toHaveAttribute('data-season', 'summer')
        expect(screen.getByTestId('arena').querySelector('.felt-summer')).not.toBeNull()
    })

    test('the particles follow Table effects; reduced motion turns them off; an ended game stays Calm', () => {
        expect(fieldMode('full', false, false)).toBe('full')
        expect(fieldMode('full', false, true)).toBe('calm')
        expect(fieldMode('calm', true, false)).toBe('off')
        expect(fieldMode('off', false, true)).toBe('off')
        const canvas = () => screen.getByTestId('arena').querySelector('canvas')!
        const { unmount } = render(<Arena season="spring" {...props} />)
        expect(canvas()).toHaveAttribute('data-effects', 'full')
        act(() => writeTableEffects('off'))
        expect(canvas()).toHaveAttribute('data-effects', 'off')
        unmount()
        writeTableEffects('full')
        render(<MotionProvider reducedMotion="always"><Arena season="spring" {...props} /></MotionProvider>)
        expect(canvas()).toHaveAttribute('data-effects', 'off')
        expect(screen.getByTestId('arena')).toHaveAttribute('data-season', 'spring')
    })

    test('the canvas pauses while the tab is hidden', () => {
        const painter = { clearRect: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), setTransform: vi.fn(), fillStyle: '', globalAlpha: 1, imageSmoothingEnabled: true }
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(painter as unknown as CanvasRenderingContext2D)
        const request = vi.fn(() => 7)
        const cancel = vi.fn()
        vi.stubGlobal('requestAnimationFrame', request)
        vi.stubGlobal('cancelAnimationFrame', cancel)
        render(<Arena season="winter" {...props} />)
        expect(request).toHaveBeenCalledTimes(1)
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
        act(() => { document.dispatchEvent(new Event('visibilitychange')) })
        expect(cancel).toHaveBeenCalledWith(7)
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
        act(() => { document.dispatchEvent(new Event('visibilitychange')) })
        expect(request).toHaveBeenCalledTimes(2)
    })
})
