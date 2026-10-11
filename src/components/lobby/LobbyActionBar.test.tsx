import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LobbyActionBar } from './LobbyActionBar'
import { viewport } from '../../test/viewport'

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.unstubAllGlobals())

describe('LobbyActionBar (spec §4.7)', () => {
    test('host: options, the reason line, and Start match only when 2 + 2 sit (AC 4)', async () => {
        const user = userEvent.setup()
        const onStart = vi.fn()
        const onOptions = vi.fn()
        const { rerender } = render(<LobbyActionBar role="host" line="Waiting for 1 more player." onStart={onStart} onOptions={onOptions} />)
        expect(screen.getByText('Waiting for 1 more player.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Start match' })).toBeDisabled()
        await user.click(screen.getByRole('button', { name: 'Lobby options' }))
        expect(onOptions).toHaveBeenCalled()
        rerender(<LobbyActionBar role="host" line="Everyone is seated." canStart onStart={onStart} onOptions={onOptions} />)
        await user.click(screen.getByRole('button', { name: 'Start match' }))
        expect(onStart).toHaveBeenCalled()
        expect(screen.queryByRole('button', { name: 'Leave' })).not.toBeInTheDocument()
    })

    test('host: "Fill with bots" with onFill, disabled while a request runs; none without onFill (no bots, no seat to fill) or for anyone else', async () => {
        const user = userEvent.setup()
        const onFill = vi.fn()
        const { rerender } = render(<LobbyActionBar role="host" line="Waiting for 3 more players." canFill onFill={onFill} />)
        await user.click(screen.getByRole('button', { name: 'Fill with bots' }))
        expect(onFill).toHaveBeenCalledTimes(1)
        rerender(<LobbyActionBar role="host" line="Waiting for 3 more players." canFill filling onFill={onFill} />)
        expect(screen.getByRole('button', { name: 'Fill with bots' })).toHaveAttribute('aria-busy', 'true')
        expect(screen.getByRole('button', { name: 'Fill with bots' })).toBeDisabled()
        rerender(<LobbyActionBar role="host" line="Waiting for 2 more players." canFill={false} onFill={onFill} />)
        expect(screen.getByRole('button', { name: 'Fill with bots' })).toBeDisabled()
        rerender(<LobbyActionBar role="host" line="Everyone is seated." canStart canFill />)
        expect(screen.queryByRole('button', { name: 'Fill with bots' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Start match' })).toBeEnabled()
        rerender(<LobbyActionBar role="member" line="Tap an open seat." canFill onFill={onFill} />)
        expect(screen.queryByRole('button', { name: 'Fill with bots' })).not.toBeInTheDocument()
        rerender(<LobbyActionBar role="outsider" line="" canFill onFill={onFill} />)
        expect(screen.queryByRole('button', { name: 'Fill with bots' })).not.toBeInTheDocument()
        expect(onFill).toHaveBeenCalledTimes(1)
    })

    test('member: the status line and Leave; outsider: Join lobby', async () => {
        const user = userEvent.setup()
        const onLeave = vi.fn()
        const onJoin = vi.fn()
        const { rerender } = render(<LobbyActionBar role="member" line="Tap an open seat." onLeave={onLeave} />)
        expect(screen.getByText('Tap an open seat.')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Leave' }))
        expect(onLeave).toHaveBeenCalled()
        expect(screen.queryByRole('button', { name: 'Start match' })).not.toBeInTheDocument()
        rerender(<LobbyActionBar role="outsider" line="" privateLobby onJoin={onJoin} />)
        await user.click(screen.getByRole('button', { name: 'Join lobby' }))
        expect(onJoin).toHaveBeenCalled()
    })

    test('a member following the started match sees only "Opening the match…"', () => {
        render(<LobbyActionBar role="member" line="You're on Team A." following />)
        expect(screen.getByText('Opening the match…')).toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    test('it sticks above the phone tab bar, and to the bottom of the screen otherwise', () => {
        viewport(375, 812)
        const { unmount } = render(<LobbyActionBar role="member" line="" />)
        expect(screen.getByRole('region', { name: 'Lobby actions' })).toHaveClass('sticky', 'material-bar', 'bottom-[calc(64px+var(--safe-bottom))]')
        unmount()
        viewport(1440, 900)
        render(<LobbyActionBar role="member" line="" />)
        expect(screen.getByRole('region', { name: 'Lobby actions' })).toHaveClass('sticky', 'bottom-0')
    })
})
