import { StrictMode } from 'react'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { WaitlistConfirmPage } from './WaitlistConfirmPage'
import { ApiError } from '../services/api'
import { setLang } from '../i18n/lang'

// spec §2.2 (B7): POST /api/auth/waitlist/confirm; its request is betaService.test's
const beta = vi.hoisted(() => ({ confirmWaitlist: vi.fn() }))
vi.mock('../services/betaService', () => ({ betaService: beta }))
// The one-click bot game (spec §6): its request is botGame.test's; here a stub
const bots = vi.hoisted(() => ({ startBotGame: vi.fn() }))
vi.mock('../services/botGame', () => ({ startBotGame: bots.startBotGame }))

/** Where a button led. */
function Where() {
    return <p>at {useLocation().pathname}</p>
}

// StrictMode as in development: it runs mount effects twice, and nothing may confirm on load
function renderAt(path: string) {
    return render(
        <StrictMode>
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path="/waitlist/confirm" element={<WaitlistConfirmPage />} />
                    <Route path="/signup" element={<Where />} />
                    <Route path="/game/:gameId" element={<Where />} />
                </Routes>
            </MemoryRouter>
        </StrictMode>,
    )
}

const DEAD = 'This waitlist link is invalid or has expired. Join the waitlist again to get a new one.'

beforeEach(() => {
    vi.clearAllMocks()
    bots.startBotGame.mockReset()
})
afterEach(() => {
    // signed out first, so resetting the language sends nothing to the account
    localStorage.clear()
    setLang('en')
})

describe('WaitlistConfirmPage (/waitlist/confirm, spec §2.2)', () => {
    test('confirms on a click, never on load, then says so, with a game as the next step (spec §2.2, §8)', async () => {
        beta.confirmWaitlist.mockResolvedValue(undefined)
        bots.startBotGame.mockResolvedValue({ gameId: 'g7', lobbyId: 'l7' })
        // a guest's browser plays the bots as itself (a visitor's guest door is WaitlistForm.test's)
        localStorage.setItem('authToken', 'tok-g')
        localStorage.setItem('user', JSON.stringify({ id: 'g1', username: 'gost_4821', guest: true }))
        const { container } = renderAt('/waitlist/confirm?token=tok-w')
        expect(screen.getByRole('heading', { level: 1, name: 'Confirm your place on the waitlist' })).toBeInTheDocument()
        expect(beta.confirmWaitlist).not.toHaveBeenCalled()
        const button = screen.getByRole('button', { name: 'Confirm my place' })
        // both clicks land before React re-renders the button as disabled
        act(() => {
            button.click()
            button.click()
        })
        expect(beta.confirmWaitlist).toHaveBeenCalledTimes(1)
        expect(beta.confirmWaitlist).toHaveBeenCalledWith('tok-w')
        expect(await screen.findByText(
            "Your address is on the waitlist. When a place opens, we'll email you a personal signup link, valid for 7 days.")).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Confirm my place' })).not.toBeInTheDocument()
        const primary = container.querySelectorAll('.ui-btn--primary')
        expect(primary).toHaveLength(1)
        expect(primary[0]).toHaveTextContent('Play against bots as a guest')
        expect(document.title).toBe('Waitlist · Stiglja')
        await userEvent.setup().click(primary[0] as HTMLElement)
        expect(await screen.findByText('at /game/g7')).toBeInTheDocument()
    })

    test("an expired link (the server's WAITLIST_LINK_INVALID) says so, and offers to join again or play now (Ruling 42)", async () => {
        beta.confirmWaitlist.mockRejectedValue(new ApiError({ status: 400, message: 'This waitlist link is invalid or has expired', code: 'WAITLIST_LINK_INVALID' }))
        const { container } = renderAt('/waitlist/confirm?token=tok-old')
        const user = userEvent.setup()
        await user.click(screen.getByRole('button', { name: 'Confirm my place' }))
        expect(await screen.findByRole('alert')).toHaveTextContent(DEAD)
        expect(screen.queryByRole('button', { name: 'Confirm my place' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Play against bots as a guest' })).toBeInTheDocument()
        const primary = container.querySelectorAll('.ui-btn--primary')
        expect(primary).toHaveLength(1)
        expect(primary[0]).toHaveTextContent('Join the waitlist again')
        await user.click(screen.getByRole('button', { name: 'Join the waitlist again' }))
        expect(screen.getByText('at /signup')).toBeInTheDocument()
    })

    test('an invalid link (no token) gets the same line, with no request', async () => {
        renderAt('/waitlist/confirm')
        expect(screen.getByRole('alert')).toHaveTextContent(DEAD)
        expect(screen.getByRole('button', { name: 'Join the waitlist again' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Play against bots as a guest' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Confirm my place' })).not.toBeInTheDocument()
        await act(async () => {})
        expect(beta.confirmWaitlist).not.toHaveBeenCalled()
    })

    test('a 429 or a failed request leaves the link unspent: reload later, or reload', async () => {
        beta.confirmWaitlist.mockRejectedValueOnce(new ApiError({ status: 429, message: 'Too many requests, try again later', code: 'RATE_LIMITED' }))
        const { unmount } = renderAt('/waitlist/confirm?token=tok-w')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm my place' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Too many tries. Wait a little, then try again.')
        expect(screen.getByText('Reload this page later to try again.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Confirm my place' })).toBeDisabled()
        expect(screen.queryByRole('button', { name: 'Join the waitlist again' })).not.toBeInTheDocument()
        unmount()

        beta.confirmWaitlist.mockRejectedValueOnce(new ApiError({ status: 0, message: 'Failed to fetch' }))
        renderAt('/waitlist/confirm?token=tok-w')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm my place' }))
        expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't confirm your place.")
        expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument()
        expect(screen.getByText('Reload this page to try again.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Join the waitlist again' })).not.toBeInTheDocument()
    })

    test('in Croatian', async () => {
        setLang('hr')
        beta.confirmWaitlist.mockResolvedValueOnce(undefined)
        const { unmount } = renderAt('/waitlist/confirm?token=tok-w')
        expect(screen.getByRole('heading', { level: 1, name: 'Potvrdi adresu za Red za stol' })).toBeInTheDocument()
        expect(document.title).toBe('Red za stol · Stiglja')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Potvrdi svoje mjesto' }))
        expect(await screen.findByText(
            'Tvoja je e-adresa u Redu za stol. Kad se oslobodi mjesto, poslat ćemo ti osobnu poveznicu za registraciju, koja vrijedi 7 dana.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Igraj protiv botova kao gost' })).toBeInTheDocument()
        unmount()

        const dead = renderAt('/waitlist/confirm')
        expect(screen.getByRole('alert')).toHaveTextContent('Ova poveznica za Red za stol ne vrijedi ili je istekla. Ponovno se upiši u red i dobit ćeš novu.')
        expect(screen.getByRole('button', { name: 'Ponovno se upiši u red' })).toBeInTheDocument()
        // gone before the language is reset after the test
        dead.unmount()
    })
})
