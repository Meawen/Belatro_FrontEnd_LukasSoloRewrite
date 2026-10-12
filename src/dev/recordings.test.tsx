import { describe, test, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import DevBoardPage from './DevBoardPage'
import { RECORDINGS } from './recordings'

// a whole board per recording
vi.setConfig({ testTimeout: 60_000 })

afterEach(() => {
    window.history.replaceState({}, '', '/')
    vi.restoreAllMocks()
})

// Every recorded view sequence committed under src/test/fixtures/views (Task 11.1's recorder writes
// them; spec §4.17): one game's frames, as one seat received them, and the dev board plays them.
describe('the recorded view sequences (spec §4.17)', () => {
    test('each holds one game as its seat received it, and /dev/board?fixture= plays it', async () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
        for (const [name, recording] of Object.entries(RECORDINGS)) {
            expect(name).toMatch(/^recorded-[a-z0-9-]+$/)
            expect(recording.format).toBe('stiglja-recorded-views/1')
            expect(recording.frames.length).toBeGreaterThan(0)
            const views = recording.frames.map((frame) => (frame.channel === 'public' ? frame.body : frame.body.publicPart))
            expect(new Set(views.map((view) => view.gameId))).toEqual(new Set([recording.gameId]))
            expect([...views[0].teamA, ...views[0].teamB].map((seat) => seat.id)).toContain(recording.me)
            window.history.replaceState({}, '', `/dev/board?fixture=${name}`)
            render(<MemoryRouter><DevBoardPage /></MemoryRouter>)
            const user = userEvent.setup()
            const firstPrivate = recording.frames.findIndex((frame) => frame.channel !== 'public')
            for (let i = 0; i <= firstPrivate; i++) await user.click(screen.getByRole('button', { name: 'Step' }))
            expect(screen.getByTestId('game-phase')).toBeInTheDocument()
            expect(screen.getAllByTestId('hand-card').length).toBeGreaterThan(0)
            cleanup()
        }
    })
})
