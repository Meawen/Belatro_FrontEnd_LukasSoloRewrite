import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { actions, privateFor, renderBoard, stateOf, tableState, view } from './testing'
import { find, indexOf, playTable } from '../../test/fixtures/views/table'

// the whole board renders in every test: slower than a 5-s default on a busy machine
vi.setConfig({ testTimeout: 20_000 })

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => {
    vi.restoreAllMocks()
})

const table = playTable()
const HINT = 'Think an opponent played an illegal card this hand? Challenge to win the whole hand. A wrong challenge costs your challenge for this hand'

describe('Board: Challenge and its hint (GameTable cases, R-18, R-31)', () => {
    test('a challenge is offered while playing until it is used', async () => {
        const user = userEvent.setup()
        const playing = view({ gameState: 'PLAYING' })
        const moves = actions()
        renderBoard({ state: stateOf(privateFor(playing, false)), actions: moves })
        screen.getAllByTestId('hand-card').forEach((card) => expect(card).toBeDisabled())
        await user.click(screen.getByRole('button', { name: 'Challenge' }))
        expect(moves.challenge).toHaveBeenCalledTimes(1)

        // The server's next private view says the challenge is spent: no button any more.
        cleanup()
        renderBoard({ state: stateOf(privateFor(playing, false, undefined, true)) })
        expect(screen.getByTestId('game-phase')).toHaveTextContent('Playing')
        expect(screen.queryByRole('button', { name: 'Challenge' })).not.toBeInTheDocument()
    })

    test('the Challenge hint sits by the button while the button is offered', () => {
        const playing = view({ gameState: 'PLAYING' })
        renderBoard({ state: stateOf(privateFor(playing, false)) })
        expect(screen.getByRole('button', { name: 'Challenge' })).toBeEnabled()
        expect(screen.getByTestId('challenge-hint').textContent).toBe(HINT)
        cleanup()
        renderBoard({ state: stateOf(privateFor(playing, false, undefined, true)) })
        expect(screen.queryByTestId('challenge-hint')).not.toBeInTheDocument()
    })

    test('the info button reveals the hint and Escape hides it again; Challenge is described by it', async () => {
        const user = userEvent.setup()
        renderBoard({ state: stateOf(privateFor(view({ gameState: 'PLAYING' }), false)) })
        const hint = screen.getByTestId('challenge-hint')
        expect(hint).toHaveClass('sr-only')
        expect(screen.getByRole('button', { name: 'Challenge' })).toHaveAccessibleDescription(HINT)
        await user.click(screen.getByRole('button', { name: 'What does Challenge do?' }))
        expect(hint).not.toHaveClass('sr-only')
        expect(screen.getByRole('button', { name: 'What does Challenge do?' })).toHaveAttribute('aria-expanded', 'true')
        await user.keyboard('{Escape}')
        expect(hint).toHaveClass('sr-only')
    })
})

describe('Board: challenge results and the live region (spec §5.3.4, §5.8, O-4)', () => {
    const playing = find(table, 'play:bob:PIK-BABA')
    /** The same state with this seat's challenge spent: a failed challenge. */
    function failedBy(seat: string) {
        const priv = structuredClone(playing.private.carol)
        priv.publicPart.challengeUsedByPlayer[seat] = true
        priv.publicPart.stateVersion = playing.version + 1
        if (seat === 'carol') priv.challengeUsed = true
        return stateOf(priv)
    }

    test('my failed challenge says "No foul found"; another seat’s names them', () => {
        const { rerenderWith } = renderBoard({ state: tableState(playing) })
        rerenderWith({ state: failedBy('carol') })
        expect(screen.getByRole('status')).toHaveTextContent('No foul found')
        cleanup()
        const other = renderBoard({ state: tableState(playing) })
        other.rerenderWith({ state: failedBy('bob') })
        expect(screen.getByRole('status')).toHaveTextContent('bob challenged: no foul found')
        expect(within(screen.getByRole('log')).getByText('bob challenged: no foul found')).toBeInTheDocument()
    })

    test('a challenge upheld mid-trick: a toast and the live region, the partial trick leaves, then a new deal', () => {
        const { rerenderWith } = renderBoard({ state: tableState(playing) })
        expect(screen.getAllByTestId('trick-card')).toHaveLength(2)
        rerenderWith({ state: tableState(find(table, 'next-deal')) })
        expect(screen.getByRole('status')).toHaveTextContent('Challenge upheld: Team B takes the hand')
        expect(within(screen.getByRole('log')).getByText('Challenge upheld: Team B takes the hand')).toBeInTheDocument()
        expect(screen.queryAllByTestId('trick-card')).toHaveLength(0)
        expect(screen.getAllByTestId('hand-card')).toHaveLength(6)
    })

    test('the live region says each event once: the play, then whose turn it is', () => {
        const { rerenderWith } = renderBoard({ state: tableState(table[indexOf(table, 'play:alice:PIK-SEDMICA')]) })
        rerenderWith({ state: tableState(playing) })
        expect([...screen.getByRole('log').children].map((line) => line.textContent)).toEqual(['bob played Baba Pik', 'Your turn'])
        rerenderWith({ state: tableState(table[indexOf(table, 'play:bob:PIK-BABA') + 1]) })
        expect([...screen.getByRole('log').children].map((line) => line.textContent)).toEqual(['bob played Baba Pik', 'Your turn'])
    })
})
