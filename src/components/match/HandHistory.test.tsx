import { describe, test, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HandHistory } from './HandHistory'
import type { HandDTO, HandSummary, MoveDTO, TrickDTO } from '../../types/match'

// Tailwind's own colour scale (bg-emerald-900, text-red-300, …): the design uses tokens only (spec §3.2)
const RAW_PALETTE = /\b(?:bg|text|border|from|to|via)-(?:amber|emerald|slate|red|purple|gray|blue|yellow|green|orange|teal|pink)-\d/

const summary = (over: Partial<HandSummary> = {}): HandSummary => ({
    teamAPoints: 90, teamBPoints: 72, teamADeclPoints: 20, teamBDeclPoints: 0, teamATricksWon: 5, teamBTricksWon: 3,
    padanje: false, capot: false, finalScoreA: 110, finalScoreB: 72, ...over,
})
let order = 0
const move = (player: string, card: string, legal: boolean | null = true): MoveDTO => ({ order: ++order, player, card, legal })
const trick = (trickNo: number, ...moves: MoveDTO[]): TrickDTO => ({ trickNo, winnerId: null, points: 0, moves, lastTrickBonus: false })

// Three passes, then ana must call Tref; two fouls (one more move's legality is not known: null)
const FELL: HandDTO = {
    handNo: 1,
    trumpCalls: [{ order: 1, player: 'cy', trump: 'PASS' }, { order: 2, player: 'bob', trump: 'PASS' }, { order: 3, player: 'dan', trump: 'PASS' }, { order: 4, player: 'ana', trump: 'TREF' }],
    tricks: [trick(1, move('cy', 'AS of KARA', false), move('bob', 'DESETKA of KARA', null), move('dan', 'KRALJ of KARA', false), move('ana', 'SEDMICA of TREF'))],
    challenges: [],
    handSummary: summary({ teamAPoints: 0, teamBPoints: 162, teamADeclPoints: 0, padanje: true, finalScoreA: 0, finalScoreB: 162 }),
}
// cy calls Herc at once; Team A takes every trick
const CAPOT: HandDTO = {
    handNo: 2,
    trumpCalls: [{ order: 1, player: 'cy', trump: 'HERC' }],
    tricks: [trick(1, move('cy', 'AS of HERC'), move('bob', 'DESETKA of HERC'), move('dan', 'KRALJ of HERC'), move('ana', 'SEDMICA of HERC'))],
    challenges: [],
    handSummary: summary({ teamAPoints: 252, teamBPoints: 0, teamADeclPoints: 20, capot: true, finalScoreA: 272, finalScoreB: 162 }),
}

function renderHands(hands: HandDTO[]) {
    return render(<HandHistory hands={hands} />)
}

/** A hand's row: a button named "Hand n, …" (its tags and running score follow the number). */
const handRow = (n: number) => screen.getByRole('button', { name: new RegExp(`^Hand ${n}(,|$)`) })

describe('Game history rows (spec §4.9 item 5)', () => {
    test('one row per hand: its number, "Hand n", PADANJE, "{n} ILLEGAL" for legal === false only, the running score, the first two calls and "+n"', () => {
        const { container } = renderHands([FELL, CAPOT])
        expect(screen.getByRole('heading', { name: 'Game history (2 hands)' })).toBeInTheDocument()
        const fell = handRow(1)
        expect(fell).toHaveAccessibleName('Hand 1, PADANJE, 2 ILLEGAL, 0 - 162')
        expect(within(fell).getByText('PADANJE').closest('.ui-tag')).toHaveClass('bg-warn-fill')
        expect(within(fell).getByText('2 ILLEGAL').closest('.ui-tag')).toHaveClass('bg-danger-fill')
        expect(within(fell).getByText('0 - 162')).toBeInTheDocument()
        expect(within(fell).getAllByText('PASS')).toHaveLength(2)
        expect(within(fell).getByText('+2')).toBeInTheDocument()

        const capot = handRow(2)
        expect(capot).toHaveAccessibleName('Hand 2, 272 - 162')
        expect(within(capot).queryByText('PADANJE')).not.toBeInTheDocument()
        expect(within(capot).queryByText(/ILLEGAL/)).not.toBeInTheDocument()
        expect(within(capot).getByText('272 - 162')).toBeInTheDocument()
        expect(within(capot).getByText('Herc').closest('.ui-tag')).toHaveClass('bg-suit-herc')
        expect(within(capot).queryByText(/^\+/)).not.toBeInTheDocument()
        expect(container.innerHTML).not.toMatch(RAW_PALETTE)
    })

    test('a row opens and closes its hand, and its chevron turns', async () => {
        renderHands([FELL, CAPOT])
        const row = handRow(2)
        const chevron = row.querySelector('svg:last-child')
        expect(row).toHaveAttribute('aria-expanded', 'false')
        expect(chevron).not.toHaveClass('rotate-90')
        expect(screen.queryByRole('region', { name: 'Hand summary' })).not.toBeInTheDocument()
        const user = userEvent.setup()
        await user.click(row)
        expect(row).toHaveAttribute('aria-expanded', 'true')
        expect(chevron).toHaveClass('rotate-90')
        expect(screen.getAllByRole('region', { name: 'Hand summary' })).toHaveLength(1)
        await user.click(row)
        expect(row).toHaveAttribute('aria-expanded', 'false')
        expect(screen.queryByRole('region', { name: 'Hand summary' })).not.toBeInTheDocument()
    })

    test('the hand summary: each team’s points with its declarations, the tricks, the trump calls, CAPOT and HAND AWARDED (PADANJE)', async () => {
        renderHands([FELL, CAPOT])
        const user = userEvent.setup()
        await user.click(handRow(2))
        const capot = screen.getByRole('region', { name: 'Hand summary' })
        expect(within(capot).getByText('Team A: 252 pts (20 decl)')).toHaveClass('text-team-a')
        expect(within(capot).getByText('Team B: 0 pts')).toHaveClass('text-team-b')
        expect(within(capot).getByText('Tricks: 1')).toBeInTheDocument()
        expect(within(capot).getByText('Trump calls: 1')).toBeInTheDocument()
        expect(within(capot).getByText('CAPOT')).toBeInTheDocument()
        expect(within(capot).queryByText('HAND AWARDED (PADANJE)')).not.toBeInTheDocument()

        await user.click(handRow(2))
        await user.click(handRow(1))
        const fell = screen.getByRole('region', { name: 'Hand summary' })
        expect(within(fell).getByText('Trump calls: 4')).toBeInTheDocument()
        expect(within(fell).getByText('HAND AWARDED (PADANJE)').closest('.ui-tag')).toHaveClass('bg-warn-fill')
        expect(within(fell).queryByText('CAPOT')).not.toBeInTheDocument()
    })

    test('hands without a number count from 1; a hand without a summary has no score; "1 hand"', async () => {
        renderHands([{ ...CAPOT, handNo: null, handSummary: null }])
        expect(screen.getByRole('heading', { name: 'Game history (1 hand)' })).toBeInTheDocument()
        const row = handRow(1)
        expect(row).toHaveAccessibleName('Hand 1')
        expect(within(row).queryByText(/ - /)).not.toBeInTheDocument()
        await userEvent.setup().click(row)
        expect(screen.queryByRole('region', { name: 'Hand summary' })).not.toBeInTheDocument()
    })
})
