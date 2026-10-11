import { describe, test, expect, vi, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { useElementWidth } from './useElementWidth'

function Probe() {
    const ref = useRef<HTMLDivElement>(null)
    const width = useElementWidth(ref, 640)
    return <div ref={ref}>width {width}</div>
}

afterEach(() => vi.unstubAllGlobals())

// ranks spec §7.3: the charts measure their container and draw in CSS px
describe('useElementWidth', () => {
    test('without ResizeObserver (jsdom) the fallback width', () => {
        vi.stubGlobal('ResizeObserver', undefined)
        render(<Probe />)
        expect(screen.getByText('width 640')).toBeInTheDocument()
    })

    test('follows the element as it resizes, e.g. a phone turned to landscape (review focus 5)', () => {
        let notify: () => void = () => {}
        vi.stubGlobal('ResizeObserver', class {
            constructor(callback: () => void) { notify = callback }
            observe() {}
            disconnect() {}
        })
        let width = 343
        vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width)
        render(<Probe />)
        expect(screen.getByText('width 343')).toBeInTheDocument()
        width = 780
        act(() => notify())
        expect(screen.getByText('width 780')).toBeInTheDocument()
    })
})
