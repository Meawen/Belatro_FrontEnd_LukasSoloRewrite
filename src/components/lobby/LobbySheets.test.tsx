import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmSheet, OptionsSheet, PasswordSheet, SeatSheet } from './LobbySheets'
import { ApiError } from '../../services/api'

const onClose = vi.fn()

beforeEach(() => vi.clearAllMocks())

describe('lobby sheets (spec §4.7)', () => {
    test('a confirmation runs its request; a refusal shows the server message and the sheet stays; focus starts on Cancel', async () => {
        const user = userEvent.setup()
        const onConfirm = vi.fn().mockRejectedValueOnce(new ApiError({ status: 409, message: 'User is not part of this lobby.' })).mockResolvedValueOnce(undefined)
        render(
            <ConfirmSheet open onClose={onClose} title="Remove bob?" body="They leave the lobby at once and can join again from the list."
                confirmLabel="Remove bob" confirmIcon="x" onConfirm={onConfirm} fallbackError="Failed to kick player" />,
        )
        const sheet = screen.getByRole('dialog', { name: 'Remove bob?' })
        expect(within(sheet).getByText('They leave the lobby at once and can join again from the list.')).toBeInTheDocument()
        expect(within(sheet).getByRole('button', { name: 'Cancel' })).toHaveFocus()
        await user.click(within(sheet).getByRole('button', { name: 'Remove bob' }))
        expect(await within(sheet).findByRole('alert')).toHaveTextContent('User is not part of this lobby.')
        expect(onClose).not.toHaveBeenCalled()
        await user.click(within(sheet).getByRole('button', { name: 'Remove bob' }))
        expect(onConfirm).toHaveBeenCalledTimes(2)
        expect(within(sheet).queryByRole('alert')).not.toBeInTheDocument()
    })

    test('your seat: a member may stand up or leave; the host may only stand up (AC 12)', async () => {
        const user = userEvent.setup()
        const onStandUp = vi.fn()
        const onLeave = vi.fn().mockResolvedValue(undefined)
        const { rerender } = render(<SeatSheet open onClose={onClose} canLeave onStandUp={onStandUp} onLeave={onLeave} />)
        const sheet = screen.getByRole('dialog', { name: 'Your seat' })
        await user.click(within(sheet).getByRole('button', { name: 'Stand up' }))
        await user.click(within(sheet).getByRole('button', { name: 'Leave lobby' }))
        expect(onStandUp).toHaveBeenCalled()
        expect(onLeave).toHaveBeenCalled()
        rerender(<SeatSheet open onClose={onClose} canLeave={false} onStandUp={onStandUp} onLeave={onLeave} />)
        expect(within(screen.getByRole('dialog', { name: 'Your seat' })).queryByRole('button', { name: 'Leave lobby' })).not.toBeInTheDocument()
        expect(screen.getByText('Stand up to free the seat.')).toBeInTheDocument()
    })

    test('the host\'s options: Copy invite link and Close lobby', async () => {
        const user = userEvent.setup()
        const onCopy = vi.fn()
        const onCloseLobby = vi.fn()
        render(<OptionsSheet open onClose={onClose} onCopy={onCopy} onCloseLobby={onCloseLobby} />)
        const sheet = screen.getByRole('dialog', { name: 'Lobby options' })
        expect(within(sheet).getByText('Only you can see these.')).toBeInTheDocument()
        await user.click(within(sheet).getByRole('button', { name: 'Copy invite link' }))
        await user.click(within(sheet).getByRole('button', { name: 'Close lobby' }))
        expect(onCopy).toHaveBeenCalled()
        expect(onCloseLobby).toHaveBeenCalled()
    })

    test('the private lobby\'s password: Join sends it; a refusal clears it and says why', async () => {
        const user = userEvent.setup()
        const onJoin = vi.fn().mockRejectedValue(new ApiError({ status: 403, message: 'Invalid lobby password' }))
        render(<PasswordSheet open onClose={onClose} onJoin={onJoin} />)
        const sheet = screen.getByRole('dialog', { name: 'Private lobby' })
        await user.type(within(sheet).getByLabelText('Password'), 'pw-1')
        await user.click(within(sheet).getByRole('button', { name: 'Join' }))
        expect(onJoin).toHaveBeenCalledWith('pw-1')
        expect(await within(sheet).findByRole('alert')).toHaveTextContent('Invalid lobby password')
        expect(within(sheet).getByLabelText('Password')).toHaveValue('')
    })
})
