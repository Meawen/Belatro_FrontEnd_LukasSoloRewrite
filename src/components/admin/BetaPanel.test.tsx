import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
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

// spec §9 (B9): GET /admin/beta's counts, last in the answer; 14 Zagreb days, oldest first, the last today
const ZEROS = { casualWithHumans: 0, ranked: 0, guideStarted: 0, guideHand1: 0, guideHand2: 0, guestSignups: 0, invitesSent: 0, invitesUsed: 0 }
const day = (i: number) => new Date(Date.UTC(2026, 9, 21 + i)).toISOString().slice(0, 10)
const COUNTS = {
    returning7: 3, returning28: 1234, casualWithHumans7: 4, ranked7: 2, guideStarted7: 9, guideHand1_7: 6, guideHand2_7: 5,
    guestSignups7: 1, invitesSent7: 7, invitesUsed7: 8,
    perDay: Array.from({ length: 14 }, (_, i) => ({ day: day(i), ...ZEROS })).map((one, i) => {
        if (i === 0) return { ...one, casualWithHumans: 1, ranked: 2, guideStarted: 3, guideHand1: 4, guideHand2: 5, guestSignups: 6, invitesSent: 7, invitesUsed: 8 }
        if (i === 13) return { ...one, casualWithHumans: 11, ranked: 12, guideStarted: 1234, guideHand1: 14, guideHand2: 15, guestSignups: 16, invitesSent: 17, invitesUsed: 18 }
        return one
    }),
}
const DAYS_CAPTION = "The last 14 days in Zagreb time, newest first. Today's numbers can still grow."

/** A table row as [its header, its cells' text]. */
const row = (one: HTMLElement) => [within(one).getByRole('rowheader').textContent, within(one).getAllByRole('cell').map((cell) => cell.textContent)]

describe('BetaPanel: the beta counts (spec §9, US-18)', () => {
    test('the counts: ten numbers for 7 and 28 days, and the last 14 Zagreb days newest first (spec §9, US-18)', async () => {
        beta.getBeta.mockResolvedValue({ ...NUMBERS, counts: COUNTS })
        render(<BetaPanel />)
        const section = (await screen.findByRole('heading', { level: 2, name: 'Beta counts' })).closest('section')!
        expect(within(section).getByText(
            'Is the beta working? Each number covers the last 7 days, today included, unless it says 28. Players who came back finished games on two or more different days, as accounts or guests. A game with people had at least two humans at the table, guests included.',
        )).toBeInTheDocument()
        // S11's section is still there, whole
        expect(screen.getByRole('heading', { level: 2, name: 'Signups and the waitlist' })).toBeInTheDocument()
        expect(tiles()).toEqual([
            ['Accounts', '12 / 50'],
            ['Waiting (confirmed)', '3'],
            ['Not confirmed yet', '2'],
            ['Links sent, not used yet', '1'],
        ])
        expect([
            'Came back (7 days)', 'Came back (28 days)', 'Casual games with people', 'Ranked games', 'Bela school started',
            'Hand 1 finished', 'Hand 2 finished', 'Guests who signed up', 'Waitlist links sent', 'Waitlist links used',
        ].map((label) => [label, within(section).getByText(label).parentElement?.textContent?.replace(label, '')])).toEqual([
            ['Came back (7 days)', '3'],
            ['Came back (28 days)', '1,234'],
            ['Casual games with people', '4'],
            ['Ranked games', '2'],
            ['Bela school started', '9'],
            ['Hand 1 finished', '6'],
            ['Hand 2 finished', '5'],
            ['Guests who signed up', '1'],
            ['Waitlist links sent', '7'],
            ['Waitlist links used', '8'],
        ])
        const table = screen.getByRole('table', { name: DAYS_CAPTION })
        expect(section).toContainElement(table)
        expect(within(table).getAllByRole('row')).toHaveLength(15)
        const [head, ...rows] = within(table).getAllByRole('row')
        expect(within(head).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
            'Day', 'Casual with people', 'Ranked', 'School: started', 'School: hand 1', 'School: hand 2', 'Guest signups', 'Links sent', 'Links used',
        ])
        expect(row(rows[0])).toEqual(['Tue, Nov 3', ['11', '12', '1,234', '14', '15', '16', '17', '18']])
        expect(row(rows[1])).toEqual(['Mon, Nov 2', ['0', '0', '0', '0', '0', '0', '0', '0']])
        expect(row(rows[13])).toEqual(['Wed, Oct 21', ['1', '2', '3', '4', '5', '6', '7', '8']])
    })

    test("an older backend's answer without counts shows the cap and the four numbers, and no counts", async () => {
        render(<BetaPanel />)
        expect(await screen.findByRole('heading', { level: 2, name: 'Signups and the waitlist' })).toBeInTheDocument()
        expect(tile('Accounts')).toBe('12 / 50')
        expect(screen.queryByRole('heading', { name: 'Beta counts' })).not.toBeInTheDocument()
        expect(screen.queryByRole('table')).not.toBeInTheDocument()
        // null too (an older backend that names the field)
        cleanup()
        beta.getBeta.mockResolvedValue({ ...NUMBERS, counts: null })
        render(<BetaPanel />)
        await screen.findByRole('heading', { level: 2, name: 'Signups and the waitlist' })
        expect(screen.queryByRole('heading', { name: 'Beta counts' })).not.toBeInTheDocument()
        expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })

    test("a saved cap's answer brings fresh counts too", async () => {
        beta.getBeta.mockResolvedValue({ ...NUMBERS, counts: COUNTS })
        beta.setCap.mockResolvedValue({ ...NUMBERS, cap: 60, counts: { ...COUNTS, returning7: 4 } })
        const user = userEvent.setup()
        render(<BetaPanel />)
        const field = await screen.findByLabelText('Signup cap')
        expect(screen.getByText('Came back (7 days)').parentElement).toHaveTextContent('3')
        await user.clear(field)
        await user.type(field, '60')
        await user.click(screen.getByRole('button', { name: 'Save cap' }))
        expect(await screen.findByRole('status')).toHaveTextContent('Cap saved.')
        expect(tile('Came back (7 days)')).toBe('4')
    })

    test("in Croatian: the counts' heading, labels, Zagreb days and numbers", async () => {
        setLang('hr')
        beta.getBeta.mockResolvedValue({ ...NUMBERS, counts: COUNTS })
        const { unmount } = render(<BetaPanel />)
        const section = (await screen.findByRole('heading', { level: 2, name: 'Brojke bete' })).closest('section')!
        expect(within(section).getByText(/^Radi li beta\? Svaki broj obuhvaća zadnjih 7 dana/)).toBeInTheDocument()
        expect(screen.getByText('Vratili su se (28 dana)', { selector: 'dt' }).nextElementSibling?.textContent).toBe('1.234')
        expect(screen.getByText('Pokretanja Škole bele', { selector: 'dt' }).nextElementSibling?.textContent).toBe('9')
        const table = screen.getByRole('table', { name: 'Zadnjih 14 dana po zagrebačkom vremenu, najnoviji prvi. Današnje brojke još mogu rasti.' })
        expect(within(table).getByRole('columnheader', { name: 'Nerangirane s ljudima' })).toBeInTheDocument()
        const rows = within(table).getAllByRole('row').slice(1)
        expect(row(rows[0])).toEqual(['uto, 3. studenoga', ['11', '12', '1.234', '14', '15', '16', '17', '18']])
        expect(row(rows[13])[0]).toBe('sri, 21. listopada')
        // gone before the language is reset after the test
        unmount()
    })
})
