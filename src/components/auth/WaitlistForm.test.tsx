import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { WaitlistForm, type WaitlistFormProps } from './WaitlistForm'
import { authService } from '../../services/authService'
import { userService } from '../../services/userService'
import { ApiError } from '../../services/api'
import { setLang } from '../../i18n/lang'

// spec §2.2 (B7): POST /api/auth/waitlist; its request is betaService.test's
const beta = vi.hoisted(() => ({ joinWaitlist: vi.fn() }))
vi.mock('../../services/betaService', () => ({ betaService: beta }))
// The one-click bot game (spec §6): its request is botGame.test's; here a stub
const bots = vi.hoisted(() => ({ startBotGame: vi.fn() }))
vi.mock('../../services/botGame', () => ({ startBotGame: bots.startBotGame }))

/** Where a button led. */
function Where() {
    return <p>at {useLocation().pathname}</p>
}

function renderWaitlist(props: WaitlistFormProps = {}) {
    return render(
        <MemoryRouter initialEntries={['/signup']}>
            <Routes>
                <Route path="/signup" element={<WaitlistForm {...props} />} />
                <Route path="/game/:gameId" element={<Where />} />
            </Routes>
        </MemoryRouter>,
    )
}

beforeEach(() => {
    vi.clearAllMocks()
    bots.startBotGame.mockReset()
    // as S8's: the guest's token and user are stored before it answers
    vi.spyOn(authService, 'startGuest').mockImplementation(async () => {
        localStorage.setItem('authToken', 'g-new')
        localStorage.setItem('user', JSON.stringify({ id: 'g1', username: 'gost_4821', guest: true }))
        return { token: 'g-new', user: { id: 'g1', username: 'gost_4821', guest: true }, message: null }
    })
})
afterEach(() => {
    vi.restoreAllMocks()
    // signed out first (a test may have made a guest), so resetting the language sends nothing to the account
    localStorage.clear()
    setLang('en')
})

describe('WaitlistForm, "Red za stol" (spec §2.2)', () => {
    test("an empty or malformed address is refused in the site's language, and nothing is sent", async () => {
        const user = userEvent.setup()
        renderWaitlist()
        await user.click(screen.getByRole('button', { name: 'Join the waitlist' }))
        expect(screen.getByText('Email is required')).toBeInTheDocument()
        await user.type(screen.getByLabelText('Email'), 'ana')
        await user.click(screen.getByRole('button', { name: 'Join the waitlist' }))
        expect(screen.getByText('Email is invalid')).toBeInTheDocument()
        expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(/Email is invalid/)
        expect(beta.joinWaitlist).not.toHaveBeenCalled()
    })

    test('a refused join says what to do (429, no answer), and the form stays', async () => {
        const user = userEvent.setup()
        beta.joinWaitlist
            .mockRejectedValueOnce(new ApiError({ status: 429, message: 'Too many requests, try again later', code: 'RATE_LIMITED' }))
            .mockRejectedValueOnce(new ApiError({ status: 0, message: 'Failed to fetch' }))
        renderWaitlist()
        await user.type(screen.getByLabelText('Email'), 'ana@example.com')
        await user.click(screen.getByRole('button', { name: 'Join the waitlist' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Too many tries. Wait a little, then try again.')
        await user.click(screen.getByRole('button', { name: 'Join the waitlist' }))
        expect(await screen.findByText('Something went wrong. Try again.')).toBeInTheDocument()
        expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 1, name: 'Waitlist' })).toBeInTheDocument()
        expect(screen.getByLabelText('Email')).toHaveValue('ana@example.com')
        expect(beta.joinWaitlist).toHaveBeenCalledTimes(2)
    })

    test('a second press while the first is on its way sends once', () => {
        beta.joinWaitlist.mockReturnValue(new Promise(() => {}))
        renderWaitlist({ initialEmail: 'ana@example.com' })
        const button = screen.getByRole('button', { name: 'Join the waitlist' })
        // both presses land before React re-renders the button as loading
        act(() => {
            button.click()
            button.click()
        })
        expect(beta.joinWaitlist).toHaveBeenCalledTimes(1)
    })

    test('a visitor with no session becomes a guest, then plays the bots at once (spec §2.2, §6)', async () => {
        bots.startBotGame.mockResolvedValue({ gameId: 'g7', lobbyId: 'l7' })
        renderWaitlist()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Play against bots as a guest' }))
        expect(await screen.findByText('at /game/g7')).toBeInTheDocument()
        expect(authService.startGuest).toHaveBeenCalledTimes(1)
        expect(authService.startGuest).toHaveBeenCalledWith('en')
        expect(vi.mocked(authService.startGuest).mock.invocationCallOrder[0]).toBeLessThan(bots.startBotGame.mock.invocationCallOrder[0])
    })

    test('a guest plays the bots as itself', async () => {
        localStorage.setItem('authToken', 'tok-g')
        localStorage.setItem('user', JSON.stringify({ id: 'g1', username: 'gost_4821', guest: true }))
        bots.startBotGame.mockResolvedValue({ gameId: 'g7', lobbyId: 'l7' })
        renderWaitlist()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Play against bots as a guest' }))
        expect(await screen.findByText('at /game/g7')).toBeInTheDocument()
        expect(authService.startGuest).not.toHaveBeenCalled()
    })

    test('the joined panel replaces the form, and focus moves to its heading (review, Accessibility)', async () => {
        beta.joinWaitlist.mockResolvedValue(undefined)
        const user = userEvent.setup()
        renderWaitlist()
        await user.type(screen.getByLabelText('Email'), 'ana@example.com')
        await user.click(screen.getByRole('button', { name: 'Join the waitlist' }))
        const heading = await screen.findByRole('heading', { level: 1, name: 'Check your inbox' })
        expect(heading).toHaveFocus()
    })

    test('a guest whose game still runs: ALREADY_IN_GAME offers the way back to it, and it leads there (review Minor 9)', async () => {
        localStorage.setItem('authToken', 'tok-g')
        localStorage.setItem('user', JSON.stringify({ id: 'g1', username: 'gost_4821', guest: true }))
        const active = vi.spyOn(userService, 'getActiveGame').mockResolvedValue('g1')
        bots.startBotGame.mockRejectedValue(new ApiError({ status: 409, message: 'You already have a game in progress', code: 'ALREADY_IN_GAME' }))
        const user = userEvent.setup()
        renderWaitlist()
        // nothing is asked before the refusal
        expect(active).not.toHaveBeenCalled()
        expect(screen.queryByRole('button', { name: 'Return to your game' })).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Play against bots as a guest' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('You already have a game in progress. Go back to it first.')
        await user.click(await screen.findByRole('button', { name: 'Return to your game' }))
        expect(screen.getByText('at /game/g1')).toBeInTheDocument()
        expect(active).toHaveBeenCalledTimes(1)
    })

    test('the notice sits above the form, and the typed address is kept', () => {
        renderWaitlist({ initialEmail: 'ana@example.com', notice: 'Signup is full, so no account was created.' })
        const notice = screen.getByRole('alert')
        expect(notice).toHaveTextContent('Signup is full, so no account was created.')
        const field = screen.getByLabelText('Email')
        expect(field).toHaveValue('ana@example.com')
        expect(notice.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    test('in Croatian', () => {
        setLang('hr')
        const { unmount } = renderWaitlist()
        expect(screen.getByRole('heading', { level: 1, name: 'Red za stol' })).toBeInTheDocument()
        expect(screen.getByText('Zasad nema slobodnih mjesta. Ostavi e-adresu i javit ćemo ti se čim se oslobodi mjesto.')).toBeInTheDocument()
        expect(screen.getByLabelText('E-adresa')).toHaveAccessibleDescription(
            'Najprije ćemo ti poslati poveznicu za potvrdu. Mjesto ti čuvamo tek kad potvrdiš adresu.')
        expect(screen.getByText('Ne želiš čekati? Igraj odmah, kao gost.')).toBeInTheDocument()
        expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Upiši se u red', 'Igraj protiv botova kao gost'])
        expect(screen.getByRole('link', { name: 'Prijavi se' })).toHaveAttribute('href', '/login')
        // gone before the language is reset after the test
        unmount()
    })
})
