import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { NeedsAccountPage } from './NeedsAccountPage'
import { AuthPage } from '../components/auth/AuthPage'
import { ApiError } from '../services/api'
import { clearPendingGoogle, peekPendingGoogle } from '../services/googleSignIn'
import { setLang } from '../i18n/lang'
import { CLIENT_ID, dropGoogleScripts, gsiScripts, stubGoogle, tokenFor } from '../test/googleStub'

// a guest's browser: Google's two steps, through useAuth (their requests are useAuth.test's and authService.test's)
const auth = vi.hoisted(() => ({ googleSignIn: vi.fn(), googleSignup: vi.fn(), signup: vi.fn() }))
vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({ ...auth, isAuthenticated: true, isGuest: true, isSignupLoading: false }),
}))
const bots = vi.hoisted(() => ({ startBotGame: vi.fn() }))
vi.mock('../services/botGame', () => ({ startBotGame: bots.startBotGame }))
// Ruling 6, P-2: whether signup takes new accounts now
const beta = vi.hoisted(() => ({ signupStatus: vi.fn(), joinWaitlist: vi.fn() }))
vi.mock('../services/betaService', () => ({ betaService: beta }))

const CREDENTIAL = tokenFor('jura@gmail.com')
const SIGNED_IN = { token: 'm-tok', user: { id: 'u1', username: 'jura', guest: false }, needsName: false }

/** Where the router is, and the state it carries. */
function Where() {
    const { pathname, search, state } = useLocation()
    return <p data-testid="where">{`${pathname}${search} ${JSON.stringify(state)}`}</p>
}

/** The guest prompt at /friends, and /signup as App routes it (AuthPage, so the name step and its success are the real ones). */
function renderPrompt(path = '/friends') {
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/friends" element={<NeedsAccountPage area="friends" />} />
                <Route path="/signup" element={<AuthPage initialMode="signup" redirectTo="/dashboard" />} />
                <Route path="/login" element={<h1>Sign-in page</h1>} />
            </Routes>
            <Where />
        </MemoryRouter>,
    )
}

beforeEach(() => {
    // reset, not clear: no queued answer from one test reaches the next
    vi.resetAllMocks()
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', CLIENT_ID)
    beta.signupStatus.mockResolvedValue({ open: true })
})

afterEach(() => {
    cleanup()
    dropGoogleScripts()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    clearPendingGoogle()
    setLang('en')
})

describe('Continue with Google on the guest prompt (Google sign-in spec §2, P-2, US-G3)', () => {
    test.each([
        ['open', () => beta.signupStatus.mockResolvedValue({ open: true })],
        ["unknown (the status couldn't be read: /signup shows the form then)", () => beta.signupStatus.mockRejectedValue(new ApiError({ status: 0, message: 'Failed to fetch' }))],
    ])("while signup is %s: Google's button after Sign up and the bots, with no \"or\"", async (_, status) => {
        status()
        const google = stubGoogle(CREDENTIAL)
        renderPrompt()
        const button = await screen.findByTestId('google-button')
        expect(google.renderButton).toHaveBeenCalledTimes(1)
        const order = [screen.getByRole('button', { name: 'Sign up' }), screen.getByRole('button', { name: 'Play against bots as a guest' }), button]
        for (let i = 1; i < order.length; i++) {
            expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING, String(i)).toBeTruthy()
        }
        expect(screen.queryByText('or')).not.toBeInTheDocument()
    })

    test('with no client id, nothing at all: not even an empty line under the two buttons (spec §2)', async () => {
        vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
        renderPrompt()
        await act(async () => {})
        const actions = screen.getByRole('button', { name: 'Sign up' }).parentElement!
        expect([...actions.children].map((child) => child.textContent)).toEqual(['Sign up', 'Play against bots as a guest'])
    })

    test('not while signup is full (P-2), nor while the status is still asked', async () => {
        const google = stubGoogle(CREDENTIAL)
        beta.signupStatus.mockResolvedValue({ open: false })
        renderPrompt()
        expect(await screen.findByRole('button', { name: 'Waitlist' })).toBeInTheDocument()
        expect(screen.queryByTestId('google-button')).not.toBeInTheDocument()
        cleanup()
        beta.signupStatus.mockReturnValue(new Promise(() => {}))
        renderPrompt()
        await act(async () => {})
        expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument()
        expect(screen.queryByTestId('google-button')).not.toBeInTheDocument()
        expect(google.renderButton).not.toHaveBeenCalled()
    })

    test("a new account: the name step at /signup, carrying this page, and the step's success comes back to it (spec §6.3)", async () => {
        const user = userEvent.setup()
        auth.googleSignIn.mockResolvedValue({ needsName: true, email: 'jura@gmail.com' })
        auth.googleSignup.mockResolvedValue({ token: 'm-tok', user: { id: 'u1', username: 'jura', guest: false }, message: null })
        const google = stubGoogle(CREDENTIAL)
        renderPrompt()
        await screen.findByTestId('google-button')
        await google.answer()
        expect(await screen.findByRole('heading', { level: 1, name: 'Choose your username' })).toBeInTheDocument()
        expect(screen.getByTestId('where')).toHaveTextContent('/signup {"from":"/friends"}')
        expect(peekPendingGoogle()).toEqual({ credential: CREDENTIAL, email: 'jura@gmail.com' })
        await user.type(screen.getByLabelText('Username'), 'jura')
        await user.click(screen.getByRole('button', { name: 'Make my account' }))
        // spec §3.4, US-G10: from a guest's browser, as the form sends it
        expect(auth.googleSignup).toHaveBeenCalledWith({ credential: CREDENTIAL, username: 'jura', language: 'en', wasGuest: true })
        expect(await screen.findByRole('heading', { level: 1, name: 'Friends' })).toBeInTheDocument()
        expect(screen.getByTestId('where')).toHaveTextContent('/friends')
    })

    test('signed in to an existing account: the page it was on loads again, now as a member (A-7)', async () => {
        const assign = vi.fn()
        vi.stubGlobal('location', { ...window.location, assign })
        auth.googleSignIn.mockResolvedValue(SIGNED_IN)
        const google = stubGoogle(CREDENTIAL)
        renderPrompt('/friends?tab=requests')
        await screen.findByTestId('google-button')
        await google.answer()
        expect(assign).toHaveBeenCalledTimes(1)
        expect(assign).toHaveBeenCalledWith('/friends?tab=requests')
    })

    test('GOOGLE_EMAIL_UNVERIFIED: its line, and the link to the sign-up form carries this page (S1 A-12)', async () => {
        const user = userEvent.setup()
        auth.googleSignIn.mockRejectedValue(new ApiError({ status: 400, message: 'refused', code: 'GOOGLE_EMAIL_UNVERIFIED' }))
        const google = stubGoogle(CREDENTIAL)
        renderPrompt()
        await screen.findByTestId('google-button')
        await google.answer()
        expect(await screen.findByRole('alert')).toHaveTextContent("Google hasn't confirmed this address. Sign up with the form instead.")
        await user.click(screen.getByRole('link', { name: 'Sign up with the form' }))
        expect(await screen.findByRole('heading', { level: 1, name: 'Create Account' })).toBeInTheDocument()
        expect(screen.getByTestId('where')).toHaveTextContent('/signup {"from":"/friends"}')
    })

    test("GOOGLE_EMAIL_IN_USE: its line, and Sign in under it, carrying this page (spec §8: \"Sign in with that account\")", async () => {
        const user = userEvent.setup()
        auth.googleSignIn.mockRejectedValue(new ApiError({ status: 409, message: 'refused', code: 'GOOGLE_EMAIL_IN_USE' }))
        const google = stubGoogle(CREDENTIAL)
        renderPrompt()
        await screen.findByTestId('google-button')
        await google.answer()
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'This email already belongs to a Stiglja account. Sign in to it with its password, or with the Google account connected to it; then you can connect Google in Settings.')
        const signIn = screen.getByRole('link', { name: 'Sign in' })
        // a 44-px target, as the form link's
        expect(signIn).toHaveClass('min-h-11')
        // only for this refusal: the others have no sign-in link
        expect(screen.queryByRole('link', { name: 'Sign up with the form' })).not.toBeInTheDocument()
        await user.click(signIn)
        expect(await screen.findByRole('heading', { level: 1, name: 'Sign-in page' })).toBeInTheDocument()
        expect(screen.getByTestId('where')).toHaveTextContent('/login {"from":"/friends"}')
    })

    test.each([
        ["Google's script failing", async () => {
            renderPrompt()
            await waitFor(() => expect(gsiScripts()).toHaveLength(1))
            act(() => { gsiScripts()[0].dispatchEvent(new Event('error')) })
        }],
        ['Google sign-in off on the server (a 404)', async () => {
            auth.googleSignIn.mockRejectedValue(new ApiError({ status: 404, message: 'Not Found' }))
            const google = stubGoogle(CREDENTIAL)
            renderPrompt()
            await screen.findByTestId('google-button')
            await google.answer()
        }],
    ])('%s: a line that fits a guest, who has no form here and no password', async (_, fail) => {
        await fail()
        expect(await screen.findByRole('alert')).toHaveTextContent(/^Google sign-in didn't open\. Try again\.$/)
        expect(screen.getByRole('alert')).not.toHaveTextContent(/password/)
        // the page's own ways on stay
        expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Play against bots as a guest' })).toBeInTheDocument()
    })

    test('signup full by the time Google answers: the waitlist at /signup with the Google address, carrying this page', async () => {
        auth.googleSignIn.mockRejectedValue(new ApiError({ status: 409, message: 'Signup is full', code: 'SIGNUP_FULL' }))
        beta.signupStatus.mockResolvedValueOnce({ open: true }).mockResolvedValue({ open: false })
        const google = stubGoogle(CREDENTIAL)
        renderPrompt()
        await screen.findByTestId('google-button')
        await google.answer()
        expect(await screen.findByRole('heading', { level: 1, name: 'Waitlist' })).toBeInTheDocument()
        expect(screen.getByLabelText('Email')).toHaveValue('jura@gmail.com')
        expect(screen.getByTestId('where')).toHaveTextContent('/signup {"from":"/friends"}')
    })
})
