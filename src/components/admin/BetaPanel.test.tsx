import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BetaPanel } from './BetaPanel'
import { ApiError } from '../../services/api'
import { setLang } from '../../i18n/lang'

// spec §2.2 (B7): GET /admin/beta and PUT /admin/beta/cap; their requests are betaService.test's
const beta = vi.hoisted(() => ({ getBeta: vi.fn(), setCap: vi.fn() }))
vi.mock('../../services/betaService', () => ({ betaService: beta }))

const NUMBERS = { cap: 50, accounts: 12, waiting: 3, unconfirmed: 2, invitesOutstanding: 1 }

/** A tile's number: the <dd> beside its <dt> label (AdminStats' markup). */
const tile = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent

/** The four tiles as [label, number], in order. */
const tiles = () => ['Accounts', 'Waiting (confirmed)', 'Not confirmed yet', 'Links sent, not used yet'].map((label) => [label, tile(label)])

beforeEach(() => {
    vi.clearAllMocks()
    beta.getBeta.mockResolvedValue(NUMBERS)
})
afterEach(() => setLang('en'))

describe('BetaPanel: the signup cap and the waitlist (spec §2.2, US-17)', () => {
    test('shows accounts against the cap and the three waitlist numbers (spec §2.2)', async () => {
        render(<BetaPanel />)
        expect(await screen.findByRole('heading', { level: 2, name: 'Signups and the waitlist' })).toBeInTheDocument()
        expect(tiles()).toEqual([
            ['Accounts', '12 / 50'],
            ['Waiting (confirmed)', '3'],
            ['Not confirmed yet', '2'],
            ['Links sent, not used yet', '1'],
        ])
        expect(screen.getByLabelText('Signup cap')).toHaveValue('50')
        expect(screen.getByLabelText('Signup cap')).toHaveAttribute('inputmode', 'numeric')
        expect(beta.getBeta).toHaveBeenCalledTimes(1)
    })

    test('with no cap, the accounts stand alone and the field is empty', async () => {
        beta.getBeta.mockResolvedValue({ ...NUMBERS, cap: null, accounts: 1234 })
        render(<BetaPanel />)
        await screen.findByRole('heading', { level: 2, name: 'Signups and the waitlist' })
        expect(tile('Accounts')).toBe('1,234')
        expect(screen.getByLabelText('Signup cap')).toHaveValue('')
    })

    test('saving sends the cap and shows the fresh numbers (US-17)', async () => {
        beta.setCap.mockResolvedValue({ cap: 60, accounts: 12, waiting: 0, unconfirmed: 2, invitesOutstanding: 3 })
        const user = userEvent.setup()
        render(<BetaPanel />)
        const field = await screen.findByLabelText('Signup cap')
        await user.clear(field)
        await user.type(field, '60')
        await user.click(screen.getByRole('button', { name: 'Save cap' }))
        expect(beta.setCap).toHaveBeenCalledWith(60)
        expect(await screen.findByRole('status')).toHaveTextContent('Cap saved.')
        expect(tiles()).toEqual([
            ['Accounts', '12 / 60'],
            ['Waiting (confirmed)', '0'],
            ['Not confirmed yet', '2'],
            ['Links sent, not used yet', '3'],
        ])
        expect(field).toHaveValue('60')
        // typing again clears the saved line
        await user.type(field, '1')
        expect(screen.queryByText('Cap saved.')).not.toBeInTheDocument()
    })

    test('an empty field removes the cap', async () => {
        beta.setCap.mockResolvedValue({ ...NUMBERS, cap: null })
        const user = userEvent.setup()
        render(<BetaPanel />)
        await user.clear(await screen.findByLabelText('Signup cap'))
        await user.click(screen.getByRole('button', { name: 'Save cap' }))
        expect(beta.setCap).toHaveBeenCalledWith(null)
        expect(await screen.findByText('Cap saved.')).toBeInTheDocument()
        expect(tile('Accounts')).toBe('12')
    })

    test("a cap that isn't a whole number, 0 or more, is refused before sending, with the server's line", async () => {
        const user = userEvent.setup()
        render(<BetaPanel />)
        const field = await screen.findByLabelText('Signup cap')
        for (const typed of ['-1', '2.5', 'abc', '1234567890']) {
            await user.clear(field)
            await user.type(field, typed)
            await user.click(screen.getByRole('button', { name: 'Save cap' }))
            expect(field, typed).toHaveAccessibleDescription('The signup cap must be a whole number, 0 or more. Leave it empty for no cap.')
        }
        expect(beta.setCap).not.toHaveBeenCalled()
    })

    test("the server's CAP_INVALID and a failed save each say what to do", async () => {
        beta.setCap
            .mockRejectedValueOnce(new ApiError({ status: 400, message: 'The signup cap must be 0 or more', code: 'CAP_INVALID' }))
            .mockRejectedValueOnce(new ApiError({ status: 0, message: 'Failed to fetch' }))
        const user = userEvent.setup()
        render(<BetaPanel />)
        await screen.findByLabelText('Signup cap')
        await user.click(screen.getByRole('button', { name: 'Save cap' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('The signup cap must be a whole number, 0 or more. Leave it empty for no cap.')
        await user.click(screen.getByRole('button', { name: 'Save cap' }))
        expect(await screen.findByText("The cap wasn't saved. Try again.")).toBeInTheDocument()
        expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument()
        expect(screen.queryByText('Cap saved.')).not.toBeInTheDocument()
        // the numbers stay as loaded
        expect(tile('Accounts')).toBe('12 / 50')
    })

    test('a failed load offers a retry', async () => {
        beta.getBeta.mockRejectedValueOnce(new ApiError({ status: 503, message: 'Service Unavailable' }))
        const user = userEvent.setup()
        render(<BetaPanel />)
        expect(await screen.findByText("Couldn't load the signup numbers")).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Try again' }))
        expect(await screen.findByRole('heading', { level: 2, name: 'Signups and the waitlist' })).toBeInTheDocument()
        expect(tile('Accounts')).toBe('12 / 50')
        expect(beta.getBeta).toHaveBeenCalledTimes(2)
    })

    test('in Croatian', async () => {
        setLang('hr')
        beta.getBeta.mockResolvedValue({ ...NUMBERS, accounts: 1234, cap: 2000 })
        const { unmount } = render(<BetaPanel />)
        expect(await screen.findByRole('heading', { level: 2, name: 'Registracije i Red za stol' })).toBeInTheDocument()
        expect(screen.getByText('Računi', { selector: 'dt' }).nextElementSibling?.textContent).toBe('1.234 / 2.000')
        expect(screen.getByText('Čekaju u redu (potvrđeni)', { selector: 'dt' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Spremi ograničenje' })).toBeInTheDocument()
        expect(screen.getByLabelText('Najveći broj računa')).toHaveValue('2000')
        // gone before the language is reset after the test
        unmount()
    })
})
