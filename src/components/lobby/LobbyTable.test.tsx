import { describe, test, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LobbyTable } from './LobbyTable'
import type { LobbyDTO } from '../../types/lobby'

const mira = { id: 'u9', username: 'mira_z' }
const luka = { id: 'u2', username: 'luka' }
const ivo = { id: 'u3', username: 'ivo' }
const tea = { id: 'u4', username: 'tea_r' }
const botAna = { id: 'b1', username: 'Bot-Ana', bot: true }

function lobby(overrides: Partial<LobbyDTO> = {}): LobbyDTO {
    return {
        id: 'l1', name: 'Kod Mire', gameMode: 'CASUAL', status: 'WAITING', createdAt: null, hostUser: mira,
        teamAPlayers: [mira, luka], teamBPlayers: [ivo], unassignedPlayers: [tea], privateLobby: false, password: null,
        ...overrides,
    }
}

const seatAt = (position: string) => within(document.querySelector(`[data-position="${position}"]`) as HTMLElement).getByRole('button')

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
        expect(chip).toHaveAttribute('aria-disabled', 'true')
        await user.click(chip)
        expect(onAddBot).not.toHaveBeenCalled()
    })

    test('a bot\'s seat: the robot in place of the initial, its name, "Bot", and ", bot" in its name', () => {
        render(<LobbyTable lobby={lobby({ teamBPlayers: [ivo, botAna], unassignedPlayers: [] })} viewerId="u9" />)
        const bot = seatAt('left')
        expect(bot).toHaveAccessibleName('Bot-Ana, team B, bot')
        expect(bot).toHaveTextContent(/^Bot-AnaBot$/)
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
        // its centre counts people, as the list does, not the room's seats (casual bots spec §7)
        expect(screen.getByText('4 of 4')).toBeInTheDocument()
        expect(screen.queryByText('3/4')).not.toBeInTheDocument()
        expect(screen.queryByText('seated')).not.toBeInTheDocument()
    })
})
