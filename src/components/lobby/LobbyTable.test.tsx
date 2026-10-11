import { describe, test, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LobbyTable } from './LobbyTable'
import type { LobbyDTO } from '../../types/lobby'

const mira = { id: 'u9', username: 'mira_z', bot: false }
const luka = { id: 'u2', username: 'luka', bot: false }
const ivo = { id: 'u3', username: 'ivo', bot: false }
const tea = { id: 'u4', username: 'tea_r', bot: false }
const botAna = { id: 'b1', username: 'Bot-Ana', bot: true }

function lobby(overrides: Partial<LobbyDTO> = {}): LobbyDTO {
    return {
        id: 'l1', name: 'Kod Mire', gameMode: 'CASUAL', status: 'WAITING', createdAt: null, hostUser: mira,
        teamAPlayers: [mira, luka], teamBPlayers: [ivo], unassignedPlayers: [tea], privateLobby: false, password: null,
        ...overrides,
    }
}

// a seat's column holds its button, then the host's "+ Bot" when there is one
const seatAt = (position: string) => document.querySelector(`[data-position="${position}"] > button`) as HTMLElement
const POSITIONS = ['bottom', 'right', 'top', 'left']

describe('LobbyTable (spec §4.7)', () => {
    test('a seated viewer sits at the bottom, the next in turn order on the right, the partner on top (AC 11)', () => {
        render(<LobbyTable lobby={lobby()} viewerId="u3" />)
        expect(seatAt('bottom')).toHaveAccessibleName('ivo (you), team B')
        expect(seatAt('right')).toHaveAccessibleName('luka, team A')
        expect(seatAt('top')).toHaveAccessibleName('Open seat, team B')
        expect(seatAt('left')).toHaveAccessibleName('mira_z, team A, host')
    })

    test('names for a member who is not seated, and for an outsider (AC 10)', () => {
        const { unmount } = render(<LobbyTable lobby={lobby()} viewerId="u4" />)
        expect(seatAt('bottom')).toHaveAccessibleName('mira_z, team A, host')
        expect(seatAt('right')).toHaveAccessibleName('ivo, team B')
        expect(seatAt('top')).toHaveAccessibleName('luka, team A')
        expect(seatAt('left')).toHaveAccessibleName('Sit here, team B')
        expect(seatAt('left')).toHaveTextContent('Sit here')
        unmount()
        render(<LobbyTable lobby={lobby()} viewerId="u7" />)
        expect(seatAt('left')).toHaveAccessibleName('Open seat, team B')
        expect(seatAt('left')).toHaveAttribute('aria-disabled', 'true')
    })

    test('a tap on an empty seat of the other team asks to sit there; a seat without an action does nothing', async () => {
        const user = userEvent.setup()
        const onSeat = vi.fn()
        render(<LobbyTable lobby={lobby()} viewerId="u4" onSeat={onSeat} />)
        await user.click(screen.getByRole('button', { name: 'Sit here, team B' }))
        expect(onSeat).toHaveBeenCalledWith(expect.objectContaining({ key: 'B2', team: 'B', player: null }))
        const luka = screen.getByRole('button', { name: 'luka, team A' })
        expect(luka).toHaveAttribute('aria-disabled', 'true')
        await user.click(luka)
        expect(onSeat).toHaveBeenCalledTimes(1)
    })

    test('the host can tap another player and their own seat', async () => {
        const user = userEvent.setup()
        const onSeat = vi.fn()
        render(<LobbyTable lobby={lobby()} viewerId="u9" onSeat={onSeat} />)
        await user.click(screen.getByRole('button', { name: 'luka, team A' }))
        await user.click(screen.getByRole('button', { name: 'mira_z (you), team A' }))
        expect(onSeat.mock.calls.map(([seat]) => seat.player.username)).toEqual(['luka', 'mira_z'])
    })

    test('a seat in flight is aria-busy, reads its label, and nothing takes a second tap', async () => {
        const user = userEvent.setup()
        const onSeat = vi.fn()
        render(<LobbyTable lobby={lobby()} viewerId="u4" busy={{ key: 'B2', label: 'Joining…' }} onSeat={onSeat} />)
        const seat = screen.getByRole('button', { name: 'Joining…' })
        expect(seat).toHaveAttribute('aria-busy', 'true')
        expect(seat).toHaveTextContent('Joining…')
        await user.click(seat)
        expect(onSeat).not.toHaveBeenCalled()
        expect(screen.getAllByRole('button').filter((b) => b.getAttribute('aria-busy') === 'true')).toHaveLength(1)
    })

    test('the centre counts the seated players and says when the table is ready to deal', () => {
        const { unmount } = render(<LobbyTable lobby={lobby()} viewerId="u4" />)
        expect(screen.getByText('3/4')).toBeInTheDocument()
        expect(screen.getByText('seated')).toBeInTheDocument()
        unmount()
        render(<LobbyTable lobby={lobby({ teamBPlayers: [ivo, tea], unassignedPlayers: [] })} viewerId="u4" />)
        expect(screen.getByText('4/4')).toBeInTheDocument()
        expect(screen.getByText('Ready to deal')).toBeInTheDocument()
    })

    test('in the room the centre counts seats, bots included: the host with three bots is ready to deal', () => {
        render(<LobbyTable lobby={lobby({ teamAPlayers: [mira, botAna], teamBPlayers: [{ ...ivo, id: 'b2', username: 'Bot-Tin', bot: true }, { ...tea, id: 'b3', username: 'Bot-Nika', bot: true }], unassignedPlayers: [] })} viewerId="u9" />)
        expect(screen.getByText('4/4')).toBeInTheDocument()
        expect(screen.getByText('Ready to deal')).toBeInTheDocument()
        expect(screen.queryByText(/ of 4/)).not.toBeInTheDocument()
    })

    test('the host wears the crown, you are marked You, the others by team', () => {
        render(<LobbyTable lobby={lobby()} viewerId="u3" />)
        expect(seatAt('left')).toHaveTextContent('mira_zHost')
        expect(seatAt('bottom')).toHaveTextContent('ivoYou')
        expect(seatAt('right')).toHaveTextContent('lukaTeam A')
        expect(seatAt('left').querySelectorAll('svg').length).toBeGreaterThan(0)
    })

    test('the host gets a "+ Bot" chip on each empty seat, a button of its own beside the seat\'s tap', async () => {
        const user = userEvent.setup()
        const onSeat = vi.fn()
        const onAddBot = vi.fn()
        render(<LobbyTable lobby={lobby({ teamAPlayers: [mira], teamBPlayers: [], unassignedPlayers: [] })} viewerId="u9" onSeat={onSeat} onAddBot={onAddBot} />)
        expect(screen.getAllByRole('button', { name: /^Add a bot to team/ }).map((chip) => chip.textContent)).toEqual(['Bot', 'Bot', 'Bot'])
        expect(screen.getAllByRole('button', { name: 'Add a bot to team B' })).toHaveLength(2)
        await user.click(screen.getByRole('button', { name: 'Add a bot to team A' }))
        expect(onAddBot).toHaveBeenCalledWith(expect.objectContaining({ key: 'A2', team: 'A', player: null }))
        expect(onSeat).not.toHaveBeenCalled()
        // the seat itself still sits (R9): the host's tap on a Team B seat moves them there
        await user.click(within(document.querySelector('[data-position="right"]') as HTMLElement).getByRole('button', { name: 'Sit here, team B' }))
        expect(onSeat).toHaveBeenCalledWith(expect.objectContaining({ key: 'B1', team: 'B' }))
        expect(onAddBot).toHaveBeenCalledTimes(1)
    })

    test('nobody but the host sees the chip, nor the mini table, nor a taken seat', () => {
        const { unmount } = render(<LobbyTable lobby={lobby({ unassignedPlayers: [] })} viewerId="u9" onAddBot={vi.fn()} />)
        expect(screen.getAllByRole('button', { name: /^Add a bot/ })).toHaveLength(1)
        unmount()
        // three members and an empty seat: a seated member, an outsider, nobody signed in, an unassigned member
        const views: [LobbyDTO, string | null][] = [
            [lobby({ unassignedPlayers: [] }), 'u2'],
            [lobby({ unassignedPlayers: [] }), 'u7'],
            [lobby({ unassignedPlayers: [] }), null],
            [lobby({ teamBPlayers: [], unassignedPlayers: [tea] }), 'u4'],
        ]
        for (const [view, viewer] of views) {
            const { unmount: next } = render(<LobbyTable lobby={view} viewerId={viewer} onAddBot={vi.fn()} />)
            expect(screen.queryByRole('button', { name: /^Add a bot/ })).not.toBeInTheDocument()
            next()
        }
        render(<LobbyTable lobby={lobby({ unassignedPlayers: [] })} viewerId="u9" mini />)
        expect(screen.queryByText('Bot')).not.toBeInTheDocument()
    })

    test('no chip without a handler: a "+ Bot" that does nothing is never drawn (R18)', () => {
        render(<LobbyTable lobby={lobby({ teamAPlayers: [mira], teamBPlayers: [], unassignedPlayers: [] })} viewerId="u9" onSeat={vi.fn()} />)
        expect(screen.getAllByRole('button', { name: /^Sit here|^Open seat/ }).length).toBeGreaterThan(0)
        expect(screen.queryByRole('button', { name: /^Add a bot/ })).not.toBeInTheDocument()
    })

    test('while a request runs the chips take no tap', async () => {
        const user = userEvent.setup()
        const onAddBot = vi.fn()
        render(<LobbyTable lobby={lobby({ teamAPlayers: [mira], teamBPlayers: [], unassignedPlayers: [] })} viewerId="u9" busy={{ key: 'A2', label: 'Adding…' }} onAddBot={onAddBot} />)
        expect(screen.getByRole('button', { name: 'Adding…' })).toHaveAttribute('aria-busy', 'true')
        const chip = screen.getAllByRole('button', { name: 'Add a bot to team B' })[0]
        expect(chip).toBeDisabled()
        await user.click(chip)
        expect(onAddBot).not.toHaveBeenCalled()
    })

    test('the host\'s "+ Bot" is a small secondary button: the team\'s 6-px square at its leading edge, the robot, "Bot" (R32)', () => {
        render(<LobbyTable lobby={lobby({ teamAPlayers: [mira], teamBPlayers: [], unassignedPlayers: [] })} viewerId="u9" onAddBot={vi.fn()} />)
        const chip = screen.getByRole('button', { name: 'Add a bot to team A' })
        expect(chip).toHaveClass('ui-btn', 'ui-btn--secondary', 'ui-btn--sm')
        expect(chip).toHaveTextContent(/^Bot$/)
        const square = chip.querySelector('.bg-team-a') as HTMLElement
        expect(square).toHaveClass('size-1.5')
        expect(square).toHaveAttribute('aria-hidden', 'true')
        expect(square.compareDocumentPosition(chip.querySelector('svg') as SVGElement) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        for (const teamB of screen.getAllByRole('button', { name: 'Add a bot to team B' })) expect(teamB.querySelector('.bg-team-b')).not.toBeNull()
        // it paints 26 px (the board plate's height) and its tap box reaches 44 without adding layout height
        expect(chip).toHaveClass('h-6.5', 'min-h-0', 'after:-inset-y-[9px]')
    })

    test('one rule for all four seats: a seat\'s "+ Bot" is the last line of its column, under its name plate (R32)', () => {
        render(<LobbyTable lobby={lobby({ teamAPlayers: [], teamBPlayers: [], unassignedPlayers: [mira] })} viewerId="u9" onSeat={vi.fn()} onAddBot={vi.fn()} />)
        for (const position of POSITIONS) {
            const column = document.querySelector(`[data-position="${position}"]`) as HTMLElement
            expect(column).toHaveClass('flex', 'flex-col', 'items-center')
            expect(column.children).toHaveLength(2)
            expect(column.children[0]).toHaveAccessibleName(/^Sit here, team [AB]$/)
            expect(column.children[1]).toHaveAccessibleName(/^Add a bot to team [AB]$/)
            expect(column.children[1]).not.toHaveClass('absolute')
        }
    })

    test('the host\'s view of a lobby that takes bots has a 348-px phone felt, for its chips, all the lobby\'s life; every other view keeps 330 (R32)', () => {
        const felt = () => screen.getByTestId('lobby-table')
        const { rerender } = render(<LobbyTable lobby={lobby({ teamAPlayers: [mira], teamBPlayers: [], unassignedPlayers: [] })} viewerId="u9" onAddBot={vi.fn()} />)
        expect(felt()).toHaveClass('h-[348px]', 'md:h-[420px]')
        // the last chip gone, and the match starting: the same felt
        rerender(<LobbyTable lobby={lobby({ teamBPlayers: [ivo, tea], unassignedPlayers: [] })} viewerId="u9" />)
        expect(felt()).toHaveClass('h-[348px]')
        rerender(<LobbyTable lobby={lobby({ teamBPlayers: [ivo, tea], unassignedPlayers: [] })} viewerId="u9" launching />)
        expect(felt()).toHaveClass('h-[348px]')
        // a member, an outsider, a ranked lobby's host, a host on a backend before bots
        const older = { id: 'u9', username: 'mira_z' }
        const others: [LobbyDTO, string][] = [
            [lobby(), 'u2'],
            [lobby(), 'u7'],
            [lobby({ gameMode: 'RANKED' }), 'u9'],
            [lobby({ hostUser: older, teamAPlayers: [older, luka] }), 'u9'],
        ]
        for (const [view, viewer] of others) {
            rerender(<LobbyTable lobby={view} viewerId={viewer} onAddBot={vi.fn()} />)
            expect(felt()).toHaveClass('h-[330px]', 'md:h-[420px]')
        }
    })

    test('while a request runs, every seat but the busy one and every "+ Bot" show disabled at 0.45; the count and the felt don\'t dim (R33)', () => {
        const alone = lobby({ teamAPlayers: [mira], teamBPlayers: [], unassignedPlayers: [] })
        const dimmed = () => POSITIONS.filter((position) => seatAt(position).classList.contains('opacity-45!'))
        const chips = () => screen.getAllByRole('button', { name: /^Add a bot/ })
        const { rerender } = render(<LobbyTable lobby={alone} viewerId="u9" onSeat={vi.fn()} onAddBot={vi.fn()} />)
        expect(dimmed()).toEqual([])
        expect(chips().filter((chip) => chip.hasAttribute('disabled'))).toHaveLength(0)
        // a bot on its way to A2, the top seat: it alone stays bright and reads what is happening
        rerender(<LobbyTable lobby={alone} viewerId="u9" busy={{ key: 'A2', label: 'Adding…' }} onSeat={vi.fn()} onAddBot={vi.fn()} />)
        expect(dimmed()).toEqual(['bottom', 'right', 'left'])
        expect(seatAt('top')).toHaveAccessibleName('Adding…')
        expect(seatAt('right')).toHaveAttribute('aria-disabled', 'true')
        expect(chips()).toHaveLength(3)
        for (const chip of chips()) expect(chip).toBeDisabled()
        expect(screen.getByTestId('lobby-table').className).not.toMatch(/opacity/)
        expect((screen.getByText('1/4').parentElement as HTMLElement).className).not.toMatch(/opacity/)
        // a fill is about no one seat: they all dim
        rerender(<LobbyTable lobby={alone} viewerId="u9" busy={{ key: null, label: 'Filling with bots…' }} onSeat={vi.fn()} onAddBot={vi.fn()} />)
        expect(dimmed()).toEqual(POSITIONS)
    })

    test('a bot\'s seat: the robot in place of the initial, its name, "Bot · Team B", and ", bot" in its name, which the host\'s starts "Remove"', () => {
        render(<LobbyTable lobby={lobby({ teamBPlayers: [ivo, botAna], unassignedPlayers: [] })} viewerId="u9" />)
        const bot = seatAt('left')
        expect(bot).toHaveAccessibleName('Remove Bot-Ana, team B, bot')
        // the tag names the team too, so it shows by more than colour (spec §3.9, R35); one line, never wrapped
        expect(bot).toHaveTextContent(/^Bot-AnaBot · Team B$/)
        expect(within(bot).getByText('Bot · Team B')).toHaveClass('t-caption', 'whitespace-nowrap')
        const avatar = bot.querySelector('.ui-avatar') as HTMLElement
        expect(avatar).toHaveTextContent(/^$/)
        expect(avatar.querySelector('svg')).not.toBeNull()
        expect(seatAt('right').querySelector('.ui-avatar')).toHaveTextContent(/^I$/)
        expect(screen.queryByRole('button', { name: /^Add a bot/ })).not.toBeInTheDocument()
    })

    test('the mini table (the quick-look) draws the same seats without buttons', () => {
        render(<LobbyTable lobby={lobby()} viewerId="u4" mini />)
        expect(screen.queryAllByRole('button')).toHaveLength(0)
        expect(document.querySelector('[data-position="bottom"]')).toHaveTextContent('mira_z')
        expect(document.querySelector('[data-position="left"]')).toHaveTextContent('Open seat')
        expect(screen.getByTestId('lobby-table')).toHaveClass('h-[198px]')
        // its centre counts people, as the list does, not the room's seats (casual bots spec §7), in the room's two
        // lines: the count in the score face, then "players" (R34)
        expect(screen.getByText('4/4')).toHaveClass('t-score', 'tabular-nums')
        expect(screen.getByText('players')).toHaveClass('t-footnote')
        expect(screen.queryByText('3/4')).not.toBeInTheDocument()
        expect(screen.queryByText('seated')).not.toBeInTheDocument()
    })

    test('the mini table\'s count is people of four, then its bots: "players · 1 bot", "players · 3 bots" (R34)', () => {
        const botTin = { id: 'b2', username: 'Bot-Tin', bot: true }
        const botNika = { id: 'b3', username: 'Bot-Nika', bot: true }
        const { rerender } = render(<LobbyTable lobby={lobby({ teamBPlayers: [ivo, botAna], unassignedPlayers: [] })} viewerId="u4" mini />)
        expect(screen.getByText('3/4')).toHaveClass('t-score')
        expect(screen.getByText('players · 1 bot')).toHaveClass('t-footnote')
        rerender(<LobbyTable lobby={lobby({ teamAPlayers: [mira, botAna], teamBPlayers: [botTin, botNika], unassignedPlayers: [] })} viewerId="u4" mini />)
        expect(screen.getByText('1/4')).toBeInTheDocument()
        expect(screen.getByText('players · 3 bots')).toBeInTheDocument()
        expect(screen.queryByText(/ of 4/)).not.toBeInTheDocument()
    })
})
