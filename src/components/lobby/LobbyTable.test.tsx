import { describe, test, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LobbyTable } from './LobbyTable'
import type { LobbyDTO } from '../../types/lobby'

const mira = { id: 'u9', username: 'mira_z' }
const luka = { id: 'u2', username: 'luka' }
const ivo = { id: 'u3', username: 'ivo' }
const tea = { id: 'u4', username: 'tea_r' }

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

    test('the host wears the crown, you are marked You, the others by team', () => {
        render(<LobbyTable lobby={lobby()} viewerId="u3" />)
        expect(seatAt('left')).toHaveTextContent('mira_zHost')
        expect(seatAt('bottom')).toHaveTextContent('ivoYou')
        expect(seatAt('right')).toHaveTextContent('lukaTeam A')
        expect(seatAt('left').querySelectorAll('svg').length).toBeGreaterThan(0)
    })

    test('the mini table (the quick-look) draws the same seats without buttons', () => {
        render(<LobbyTable lobby={lobby()} viewerId="u4" mini />)
        expect(screen.queryAllByRole('button')).toHaveLength(0)
        expect(document.querySelector('[data-position="bottom"]')).toHaveTextContent('mira_z')
        expect(document.querySelector('[data-position="left"]')).toHaveTextContent('Open seat')
        expect(screen.getByTestId('lobby-table')).toHaveClass('h-[198px]')
    })
})
