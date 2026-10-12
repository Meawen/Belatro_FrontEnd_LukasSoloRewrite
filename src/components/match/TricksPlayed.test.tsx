import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TricksPlayed } from './TricksPlayed'
import { HandHistory } from './HandHistory'
import type { HandDTO, MatchDTO, MoveDTO, TrickDTO } from '../../types/match'

afterEach(() => vi.unstubAllGlobals())

// Tailwind's own colour scale (bg-emerald-900, text-red-300, …): the design uses tokens only (spec §3.2)
const RAW_PALETTE = /\b(?:bg|text|border|from|to|via)-(?:amber|emerald|slate|red|purple|gray|blue|yellow|green|orange|teal|pink)-\d/
const ILLEGAL_HINT = 'This play violated rules; points only awarded if challenge succeeds.'

// Seat (turn) order A1, B1, A2, B2: ana, cy, bob, dan; I am ana
const MATCH: MatchDTO = {
    id: 'm1', gameMode: 'CASUAL', result: 'Team B wins 870–1001', originLobby: null,
    teamA: [{ id: 'u1', username: 'ana' }, { id: 'u2', username: 'bob' }],
    teamB: [{ id: 'u3', username: 'cy' }, { id: 'u4', username: 'dan' }],
    startTime: null, endTime: null,
}
let order = 0
const move = (player: string, card: string, legal: boolean | null = true): MoveDTO => ({ order: ++order, player, card, legal })
const trick = (trickNo: number, winnerId: string | null, ...moves: MoveDTO[]): TrickDTO => ({ trickNo, winnerId, points: 0, moves, lastTrickBonus: false })
// dan calls Tref
const HAND: HandDTO = {
    handNo: 3,
    trumpCalls: [{ order: 1, player: 'bob', trump: 'PASS' }, { order: 2, player: 'dan', trump: 'TREF' }],
    tricks: [
        // bob leads: bob, dan, ana, cy; dan's trump wins (the server says so)
        trick(1, 'dan', move('bob', 'SEDMICA of PIK'), move('dan', 'DECKO of TREF'), move('ana', 'AS of PIK'), move('cy', 'KRALJ of PIK')),
        // no winnerId: the rule picks dan's ace of the led suit; ana's 7 is a foul, cy's is not known yet (null)
        trick(2, null, move('dan', 'AS of KARA'), move('ana', 'SEDMICA of KARA', false), move('cy', 'DESETKA of KARA', null), move('bob', 'KRALJ of KARA')),
        // the hand ended after two cards
        trick(3, null, move('dan', 'AS of HERC'), move('ana', 'DESETKA of HERC')),
    ],
    challenges: [],
    handSummary: null,
}

function renderReplay() {
    return render(<TricksPlayed hand={HAND} match={MATCH} me="ana" />)
}
const trickGroup = (n: number) => screen.getByRole('group', { name: `Trick ${n}` })
const cellOf = (n: number, player: string) => within(trickGroup(n)).getAllByTestId('trick-cell').find((cell) => cell.dataset.player === player)!

describe('Tricks played (spec §4.9 item 6; D-31)', () => {
    test('the "Trump: {suit}" banner in the suit’s colour, columns from me with "YOU · TEAM A" / "TEAM B", tinted, and the legend', () => {
        const { container } = renderReplay()
        const replay = screen.getByRole('region', { name: 'Tricks played' })
        expect(within(replay).getByText('Trump: Tref').closest('.ui-chip')).toHaveClass('bg-suit-tref')
        const headers = [...container.querySelectorAll('.mh-cols > *')]
        expect(headers.map((header) => header.textContent)).toEqual(['AanaYOU · TEAM A', 'CcyTEAM B', 'BbobTEAM A', 'DdanTEAM B'])
        expect(headers.map((header) => header.classList.contains('mh-team-a') ? 'A' : header.classList.contains('mh-team-b') ? 'B' : '-')).toEqual(['A', 'B', 'A', 'B'])
        expect(within(replay).getByText(/^Columns are players in seat order\. The number is the order the card was played; the crown marks the trick’s winner; trumps carry a ring and a chip in the trump suit’s colour\.$/)).toBeInTheDocument()
        expect(container.innerHTML).not.toMatch(RAW_PALETTE)
    })

    test('one row per trick: "Trick n", "({n} cards)", each card in its player’s column with its play order', () => {
        renderReplay()
        const first = trickGroup(1)
        expect(within(first).getByText('Trick 1')).toBeInTheDocument()
        expect(within(first).getByText('(4 cards)')).toBeInTheDocument()
        expect(within(first).getAllByTestId('trick-cell').map((cell) => cell.dataset.player)).toEqual(['ana', 'cy', 'bob', 'dan'])
        expect(within(first).getAllByTitle('Play order').map((badge) => badge.textContent)).toEqual(['3', '4', '1', '2'])
        expect(within(cellOf(1, 'ana')).getByRole('img', { name: 'As Pik' })).toBeInTheDocument()
        expect(within(cellOf(1, 'cy')).getByRole('img', { name: 'Kralj Pik' })).toBeInTheDocument()
    })

    test('a partial trick says PARTIAL TRICK (HAND ENDED) and leaves outlined empty cells', () => {
        renderReplay()
        const last = trickGroup(3)
        expect(within(last).getByText('(2 cards)')).toBeInTheDocument()
        expect(within(last).getByText('PARTIAL TRICK (HAND ENDED)').closest('.ui-tag')).toHaveClass('bg-warn-fill')
        expect(cellOf(3, 'cy')).toHaveClass('mh-cell--empty')
        expect(cellOf(3, 'bob')).toHaveClass('mh-cell--empty')
        expect(within(cellOf(3, 'bob')).queryByRole('img')).not.toBeInTheDocument()
        expect(cellOf(3, 'ana')).not.toHaveClass('mh-cell--empty')
        expect(within(trickGroup(1)).queryByText('PARTIAL TRICK (HAND ENDED)')).not.toBeInTheDocument()
    })

    test('the winner’s cell has the gold ring and the crown; a trump card has its suit’s ring around the card and the TRUMP chip — never the same element', () => {
        renderReplay()
        const winner = cellOf(1, 'dan')
        expect(winner).toHaveClass('mh-cell--won')
        expect(within(winner).getByRole('img', { name: 'Won the trick' })).toBeInTheDocument()
        const ring = winner.querySelector('.mh-card--trump') as HTMLElement
        expect(ring).not.toBe(winner)
        expect(ring.style.getPropertyValue('--mh-suit')).toBe('var(--suit-tref)')
        expect(within(winner).getByText('TRUMP').closest('.ui-tag')).toHaveClass('bg-suit-tref')
        for (const player of ['ana', 'cy', 'bob']) {
            expect(cellOf(1, player)).not.toHaveClass('mh-cell--won')
            expect(within(cellOf(1, player)).queryByRole('img', { name: 'Won the trick' })).not.toBeInTheDocument()
            expect(cellOf(1, player).querySelector('.mh-card--trump')).toBeNull()
        }
    })

    test('with winnerId null, the client-computed winner is crowned (AC 9)', () => {
        renderReplay()
        expect(cellOf(2, 'dan')).toHaveClass('mh-cell--won')
        expect(within(trickGroup(2)).getAllByRole('img', { name: 'Won the trick' })).toHaveLength(1)
        // a partial trick has no winner
        expect(within(trickGroup(3)).queryByRole('img', { name: 'Won the trick' })).not.toBeInTheDocument()
    })

    test('ILLEGAL only for legal === false, with its tooltip (AC 4; R-16)', () => {
        renderReplay()
        const illegal = within(trickGroup(2)).getAllByText('ILLEGAL')
        expect(illegal).toHaveLength(1)
        expect(cellOf(2, 'ana')).toContainElement(illegal[0])
        expect(illegal[0].closest('.ui-tag')).toHaveAttribute('title', ILLEGAL_HINT)
        expect(within(cellOf(2, 'cy')).queryByText('ILLEGAL')).not.toBeInTheDocument()
    })

    test('cards are 71 px wide on a desktop and 47.33-px thumbnails on a phone (crisp at its density)', () => {
        vi.stubGlobal('innerWidth', 1440)
        vi.stubGlobal('devicePixelRatio', 1)
        const desktop = renderReplay()
        expect(parseFloat((cellOf(1, 'ana').querySelector('.ui-card') as HTMLElement).style.width)).toBe(71)
        desktop.unmount()
        vi.stubGlobal('innerWidth', 375)
        vi.stubGlobal('devicePixelRatio', 3)
        renderReplay()
        expect(parseFloat((cellOf(1, 'ana').querySelector('.ui-card') as HTMLElement).style.width)).toBeCloseTo(47.33, 2)
    })
})

describe('Tricks played in the game history (spec §4.9 item 6)', () => {
    test('an open hand shows its tricks after the declarations and challenges', async () => {
        render(<HandHistory hands={[HAND]} match={MATCH} me="ana" />)
        expect(screen.queryByRole('region', { name: 'Tricks played' })).not.toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole('button', { name: /^Hand 3(,|$)/ }))
        const regions = screen.getAllByRole('region').map((region) => region.getAttribute('aria-label'))
        expect(regions).toEqual(['Game history', 'Trump declarations', 'Tricks played'])
    })
})
