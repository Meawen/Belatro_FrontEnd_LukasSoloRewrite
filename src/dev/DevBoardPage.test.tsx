import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { MotionGlobalConfig } from 'motion/react'
import DevBoardPage from './DevBoardPage'

// the whole board renders in every test: slower than a 5-s default on a busy machine
vi.setConfig({ testTimeout: 20_000 })

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => {
    window.history.replaceState({}, '', '/')
    MotionGlobalConfig.skipAnimations = false
    vi.restoreAllMocks()
})

function open(search: string) {
    window.history.replaceState({}, '', `/dev/board${search}`)
    return render(<MemoryRouter><DevBoardPage /></MemoryRouter>)
}

describe('/dev/board (spec §4.17)', () => {
    test('from the start, Step feeds the real board one frame at a time', async () => {
        const user = userEvent.setup()
        open('?seat=carol')
        expect(screen.getByText('Press Play or Step: no frame has arrived yet.')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Step' }))
        expect(screen.getByTestId('game-phase')).toHaveTextContent('Bidding')
        expect(screen.getAllByTestId('hand-card')).toHaveLength(6)
    })

    test('a jump lands on that fan-out as a snapshot, and the URL can ask for one, without controls or animations', async () => {
        const user = userEvent.setup()
        open('?seat=carol&at=deal')
        await user.clear(screen.getByRole('textbox', { name: 'Fan-out index or label' }))
        await user.type(screen.getByRole('textbox', { name: 'Fan-out index or label' }), 'call:')
        await user.click(screen.getByRole('button', { name: 'Jump' }))
        expect(screen.getByTestId('trump').textContent).toBe('Herc')
        expect(screen.getAllByTestId('hand-card')).toHaveLength(8)
    })

    test('controls=0 shows only the board; skip=1 skips every animation', () => {
        open('?seat=dave&at=window-open&controls=0&skip=1')
        expect(screen.queryByRole('button', { name: 'Step' })).not.toBeInTheDocument()
        expect(screen.getByTestId('game-phase')).toHaveTextContent('Hand finished')
        expect(MotionGlobalConfig.skipAnimations).toBe(true)
    })
})
