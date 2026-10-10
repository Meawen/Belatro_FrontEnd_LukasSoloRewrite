import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, render, screen } from '@testing-library/react'
import { QueueStatus } from './QueueStatus'
import { useEnhancedRanked } from '../../hooks/useEnhancedRanked'
import type { QueueStatusDTO } from '../../types'

vi.mock('../../hooks/useEnhancedRanked', () => ({ useEnhancedRanked: vi.fn() }))

// Not new URL(…, import.meta.url): Vite rewrites that form into an import (src/test/css.ts)
const queueCss = () => readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'QueueStatus.css'), 'utf8')

const NOW = new Date(2026, 9, 9, 20, 0).getTime()

function queue(isInQueue: boolean, queueStatus: Partial<QueueStatusDTO> | null, queuedSince: number | null = NOW) {
    vi.mocked(useEnhancedRanked).mockReturnValue({
        isInQueue,
        queueStatus: queueStatus && { state: 'IN_QUEUE', estWaitSeconds: 45, queueSize: 3, mmr: 1450, ...queueStatus },
        queuedSince,
    } as never)
}

/** The value shown under a tile's label. */
const tile = (label: string) => screen.getByText(label).nextElementSibling

beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

describe('QueueStatus (spec §4.5; US-20)', () => {
    test('while queued: "Searching for a match", the four squares, players in queue, the wait and the time', () => {
        queue(true, { queueSize: 3, estWaitSeconds: 125 })
        render(<QueueStatus />)
        expect(screen.getByText('Searching for a match')).toBeInTheDocument()
        expect(document.querySelectorAll('.queue-turn > span')).toHaveLength(4)
        expect(document.querySelector('.queue-turn')).toHaveAttribute('aria-hidden', 'true')
        expect(tile('Players in queue')).toHaveTextContent(/^3$/)
        expect(tile('Estimated wait')).toHaveTextContent(/^2m 5s$/)
        expect(tile('Time in queue')).toHaveTextContent(/^0:00$/)
    })

    test.each([-1, 0])('an estimate of %i reads "Calculating..." (R-47)', (estWaitSeconds) => {
        queue(true, { estWaitSeconds })
        render(<QueueStatus />)
        expect(tile('Estimated wait')).toHaveTextContent(/^Calculating\.\.\.$/)
    })

    test('the time in queue counts up every second from when the tab learned it is queued', () => {
        queue(true, null, NOW - 65_000)
        render(<QueueStatus />)
        expect(tile('Time in queue')).toHaveTextContent(/^1:05$/)
        // before the first status frame the server's numbers are unknown
        expect(tile('Players in queue')).toHaveTextContent(/^—$/)
        expect(tile('Estimated wait')).toHaveTextContent(/^Calculating\.\.\.$/)
        act(() => {
            vi.advanceTimersByTime(1000)
        })
        expect(tile('Time in queue')).toHaveTextContent(/^1:06$/)
    })

    // today's idle and connecting lines ("Ready to queue when you are!", "Establishing connection...") go
    test('nothing while not queued', () => {
        queue(false, null, null)
        const { container } = render(<QueueStatus />)
        expect(container).toBeEmptyDOMElement()
    })

    test('the squares light in turn by opacity alone and stand still under reduced motion (spec §3.1 rule 5)', () => {
        const css = queueCss()
        expect(css).toMatch(/\.queue-turn > span \{[^}]*animation: queue-turn 1s step-end infinite;/)
        expect(css).toMatch(/@keyframes queue-turn \{\s*0% \{\s*opacity: 1;\s*\}\s*25%,\s*100% \{\s*opacity: 0\.25;\s*\}\s*\}/)
        expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.queue-turn > span \{\s*animation: none;/)
    })
})
