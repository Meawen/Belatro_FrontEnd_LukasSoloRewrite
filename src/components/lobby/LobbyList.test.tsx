import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LobbyList, type LobbyListProps } from './LobbyList'
import type { LobbyDTO } from '../../types/lobby'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' } }) }))

const ana = { id: 'u1', username: 'ana' }
const mira = { id: 'u9', username: 'mira_z' }
const luka = { id: 'u2', username: 'luka' }
const ivo = { id: 'u3', username: 'ivo' }
const tea = { id: 'u4', username: 'tea_r' }

function lobby(overrides: Partial<LobbyDTO> = {}): LobbyDTO {
    return {
        id: 'l1', name: 'Kod Mire', gameMode: 'CASUAL', status: 'WAITING', createdAt: '2026-10-09T18:00:00Z', hostUser: mira,
        teamAPlayers: [mira, luka], teamBPlayers: [ivo], unassignedPlayers: [], privateLobby: true, password: null,
        ...overrides,
    }
}

const onRetry = vi.fn()

function props(lobbies: LobbyDTO[] | null, more: Partial<LobbyListProps> = {}): LobbyListProps {
    return { lobbies, failed: false, pollFailed: false, onRetry, ...more }
}

function renderList(lobbies: LobbyDTO[] | null, more: Partial<LobbyListProps> = {}) {
    const view = render(<LobbyList {...props(lobbies, more)} />, { wrapper: MemoryRouter })
    return { ...view, poll: (next: LobbyDTO[]) => view.rerender(<LobbyList {...props(next, more)} />) }
}

/** The rows' lobby names, top to bottom. */
const order = () => within(screen.getByRole('list', { name: 'Open lobbies' })).getAllByRole('button').map((row) => row.getAttribute('aria-label')!.split(',')[0])

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.useRealTimers())

describe('LobbyList (spec §4.6)', () => {
    test('rows are buttons named by lobby, host, members and privacy, with four seat squares (AC 6)', () => {
        renderList([lobby(), lobby({ id: 'l2', name: 'Petak', privateLobby: false, unassignedPlayers: [ana] })])
        const kod = screen.getByRole('button', { name: 'Kod Mire, host mira_z, 3 of 4, private' })
        expect(kod).toHaveTextContent('Kod Mire')
        expect(kod).toHaveTextContent('Private')
        expect(kod).toHaveTextContent('host mira_z')
        expect(kod).toHaveTextContent('3/4')
        expect(kod.querySelectorAll('[data-seat]')).toHaveLength(4)
        expect([...kod.querySelectorAll('[data-seat]')].map((square) => square.getAttribute('data-seat'))).toEqual(['A taken', 'A taken', 'B taken', 'B free'])
        const petak = screen.getByRole('button', { name: "Petak, host mira_z, 4 of 4, you're in" })
        expect(petak).toHaveTextContent('4/4')
        expect(petak).toHaveTextContent('Full')
        expect(petak).toHaveTextContent("You're in")
        expect(kod).not.toHaveTextContent("You're in")
    })

    test('search finds a lobby by name or host; "Most players" orders by members, descending (AC 2)', async () => {
        const user = userEvent.setup()
        renderList([
            lobby({ id: 'a', name: 'Alpha', teamAPlayers: [mira], teamBPlayers: [], createdAt: '2026-10-09T19:00:00Z' }),
            lobby({ id: 'b', name: 'Bravo', hostUser: tea, teamAPlayers: [tea], teamBPlayers: [ivo, luka], createdAt: '2026-10-09T17:00:00Z' }),
        ])
        expect(order()).toEqual(['Alpha', 'Bravo'])
        await user.selectOptions(screen.getByLabelText('Sort by'), 'Most players')
        expect(order()).toEqual(['Bravo', 'Alpha'])
        await user.type(screen.getByLabelText('Search lobbies'), 'TEA')
        expect(order()).toEqual(['Bravo'])
        await user.clear(screen.getByLabelText('Search lobbies'))
        await user.type(screen.getByLabelText('Search lobbies'), 'nobody')
        expect(screen.getByText('No lobbies match your search.')).toBeInTheDocument()
    })

    test('a row opens its quick-look, which follows the lobby across polls and says when it has gone', async () => {
        const { poll } = renderList([lobby()])
        await userEvent.setup().click(screen.getByRole('button', { name: /^Kod Mire, host mira_z/ }))
        const sheet = screen.getByRole('dialog', { name: 'Kod Mire' })
        expect(within(sheet).queryByText('tea_r')).not.toBeInTheDocument()
        poll([lobby({ teamBPlayers: [ivo, tea] })])
        expect(within(screen.getByRole('dialog', { name: 'Kod Mire' })).getByText('tea_r')).toBeInTheDocument()
        poll([])
        expect(within(screen.getByRole('dialog', { name: 'Kod Mire' })).getByText('This lobby is no longer open')).toBeInTheDocument()
    })

    test('a poll never reorders rows while the quick-look is open or a finger is on the list; the next poll after does', async () => {
        const user = userEvent.setup()
        const one = (members: number) => [mira, luka, ivo, tea].slice(0, members)
        const pair = (x: number, y: number) => [
            lobby({ id: 'x', name: 'X', teamAPlayers: one(x), teamBPlayers: [] }),
            lobby({ id: 'y', name: 'Y', teamAPlayers: one(y), teamBPlayers: [] }),
        ]
        const { poll } = renderList(pair(1, 2))
        await user.selectOptions(screen.getByLabelText('Sort by'), 'Most players')
        expect(order()).toEqual(['Y', 'X'])

        await user.click(screen.getByRole('button', { name: /^Y, host/ }))
        poll(pair(3, 2))
        expect(order()).toEqual(['Y', 'X'])
        await user.click(within(screen.getByRole('dialog', { name: 'Y' })).getByRole('button', { name: 'Close' }))
        expect(order()).toEqual(['Y', 'X'])
        poll(pair(3, 2))
        expect(order()).toEqual(['X', 'Y'])

        fireEvent.pointerDown(screen.getByRole('list', { name: 'Open lobbies' }))
        poll(pair(1, 4))
        expect(order()).toEqual(['X', 'Y'])
        fireEvent.pointerUp(window)
        expect(order()).toEqual(['X', 'Y'])
        poll(pair(1, 4))
        expect(order()).toEqual(['Y', 'X'])
    })

    test('first load, a failed first load with Try again, an empty list, and a failed poll', async () => {
        const { unmount } = renderList(null)
        expect(screen.getByText('Loading lobbies…')).toBeInTheDocument()
        unmount()

        const failed = renderList(null, { failed: true })
        expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load the lobbies")
        await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
        expect(onRetry).toHaveBeenCalled()
        failed.unmount()

        const empty = renderList([])
        expect(screen.getByText('No open lobbies.')).toBeInTheDocument()
        expect(screen.getByText('Create one and invite friends.')).toBeInTheDocument()
        empty.unmount()

        renderList([lobby()], { pollFailed: true })
        expect(screen.getByRole('alert')).toHaveTextContent("Couldn't refresh — showing the last list")
        expect(screen.getByRole('button', { name: /^Kod Mire/ })).toBeInTheDocument()
    })
})
