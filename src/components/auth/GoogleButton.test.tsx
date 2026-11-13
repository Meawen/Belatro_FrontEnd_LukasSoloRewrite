import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, type InitialEntry } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LoginForm } from './LoginForm'
import { SignupForm } from './SignupForm'
import { ApiError } from '../../services/api'
import { clearPendingGoogle, peekPendingGoogle, subscribePendingGoogle } from '../../services/googleSignIn'
import { setLang } from '../../i18n/lang'
import { captureConsole } from '../../test/captureConsole'
import { CLIENT_ID, dropGoogleScripts, gsiScripts, stubGoogle, tokenFor } from '../../test/googleStub'

const auth = vi.hoisted(() => ({ login: vi.fn(), signup: vi.fn(), googleSignIn: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ ...auth, isLoginLoading: false, isSignupLoading: false, isGuest: false }),
}))
// spec §2.2 (B7): whether /signup takes signups now, and joining the waitlist
const beta = vi.hoisted(() => ({ signupStatus: vi.fn(), joinWaitlist: vi.fn() }))
vi.mock('../../services/betaService', () => ({ betaService: beta }))

const FAILED = "Google sign-in didn't open. Try again, or use your name and password."
const GENERIC = 'Something went wrong. Try again.'

const CREDENTIAL = tokenFor('ana@gmail.com')

/** A signed-in answer (B1: the login response's token and user). */
const SIGNED_IN = { token: 'm-tok', user: { id: 'u1', username: 'ana', guest: false }, needsName: false }

/** Where the router is, and the state it carries. */
function Where() {
    const { pathname, search, state } = useLocation()
    return <p data-testid="where">{`${pathname}${search} ${JSON.stringify(state)}`}</p>
}

/** /login and /signup as App routes them (AuthPage passes its handleSuccess as onSuccess). */
function renderAt(entry: InitialEntry, onSuccess = vi.fn()) {
    render(
        <MemoryRouter initialEntries={[entry]}>
            <Routes>
                <Route path="/login" element={<><LoginForm onSuccess={onSuccess} /><Where /></>} />
                <Route path="/signup" element={<><SignupForm onSuccess={onSuccess} /><Where /></>} />
            </Routes>
        </MemoryRouter>,
    )
    return onSuccess
}

/** The page with Google's button drawn on it. */
async function withButton(entry: InitialEntry, onSuccess = vi.fn()) {
    const google = stubGoogle()
    renderAt(entry, onSuccess)
    await screen.findByTestId('google-button')
    return google
}

const refusal = (status: number, code?: string, message = 'refused') => new ApiError({ status, message, code })

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', CLIENT_ID)
    beta.signupStatus.mockResolvedValue({ open: true })
})

afterEach(() => {
    cleanup()
    dropGoogleScripts()
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    clearPendingGoogle()
    setLang('en')
})

describe('Continue with Google: where it shows (Google sign-in spec §2)', () => {
    test("no client id, no button: no slot, no \"or\", and Google's script is never asked for", async () => {
        for (const raw of [undefined, '', '  ']) {
            vi.stubEnv('VITE_GOOGLE_CLIENT_ID', raw)
            renderAt('/login')
            expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
            expect(screen.queryByText('or'), String(raw)).not.toBeInTheDocument()
            cleanup()
            renderAt('/signup')
            expect(await screen.findByRole('heading', { level: 1, name: 'Create Account' })).toBeInTheDocument()
            expect(screen.queryByText('or'), String(raw)).not.toBeInTheDocument()
            cleanup()
        }
        // Google isn't there, so a load would have added its script
        expect(gsiScripts()).toHaveLength(0)
        const google = stubGoogle()
        renderAt('/login')
        await act(async () => {})
        expect(google.initialize).not.toHaveBeenCalled()
        expect(google.renderButton).not.toHaveBeenCalled()
    })

    test("index.html never loads Google's script (spec §6.3: on demand only)", () => {
        const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
        expect(readFileSync(join(repoRoot, 'index.html'), 'utf8')).not.toContain('accounts.google.com')
    })

    test('on sign in, under the heading: Google\'s button, then "or", then the form (A-3)', async () => {
        const google = await withButton('/login')
        expect(google.renderButton).toHaveBeenCalledTimes(1)
        expect(google.renderButton).toHaveBeenCalledWith(expect.any(HTMLElement), {
            type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', locale: 'en',
        })
        expect(google.initialize).toHaveBeenCalledWith({ client_id: CLIENT_ID, callback: expect.any(Function) })
        const order = [
            screen.getByRole('heading', { level: 1, name: 'Welcome Back' }),
            screen.getByTestId('google-button'),
            screen.getByText('or'),
            screen.getByLabelText('Username'),
        ]
        for (let i = 1; i < order.length; i++) {
            expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING, String(i)).toBeTruthy()
        }
        // Google was already there: nothing was loaded
        expect(gsiScripts()).toHaveLength(0)
    })

    test('on the open sign-up form too, above its fields', async () => {
        const google = await withButton('/signup')
        expect(google.renderButton).toHaveBeenCalledTimes(1)
        expect(screen.getByText('or').compareDocumentPosition(screen.getByLabelText('Username')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    test('never on the waitlist: at the cap /signup has no Google button (spec §2)', async () => {
        beta.signupStatus.mockResolvedValue({ open: false })
        const google = stubGoogle()
        renderAt('/signup')
        expect(await screen.findByRole('heading', { level: 1, name: 'Waitlist' })).toBeInTheDocument()
        expect(google.renderButton).not.toHaveBeenCalled()
        expect(screen.queryByText('or')).not.toBeInTheDocument()
    })

    test('nor on the check-inbox panel after a sign-up', async () => {
        const user = userEvent.setup()
        auth.signup.mockResolvedValue(SIGNED_IN)
        await withButton('/signup')
        await user.type(screen.getByLabelText('Username'), 'ana')
        await user.type(screen.getByLabelText('Email'), 'ana@example.com')
        await user.type(screen.getByLabelText('Password'), 'long-enough-1')
        await user.type(screen.getByLabelText('Confirm Password'), 'long-enough-1')
        await user.click(screen.getByRole('button', { name: 'Create Account' }))
        expect(await screen.findByRole('heading', { level: 1, name: 'Check your inbox' })).toBeInTheDocument()
        expect(screen.queryByTestId('google-button')).not.toBeInTheDocument()
        expect(screen.queryByText('or')).not.toBeInTheDocument()
    })

    test("in the site's language, and drawn again on a switch; Google is set up once", async () => {
        setLang('hr')
        const google = await withButton('/login')
        expect(google.renderButton).toHaveBeenLastCalledWith(expect.any(HTMLElement), expect.objectContaining({ locale: 'hr' }))
        expect(screen.getByText('ili')).toBeInTheDocument()
        act(() => setLang('en'))
        await waitFor(() => expect(google.renderButton).toHaveBeenCalledTimes(2))
        expect(google.renderButton).toHaveBeenLastCalledWith(expect.any(HTMLElement), expect.objectContaining({ locale: 'en' }))
        expect(screen.getAllByTestId('google-button')).toHaveLength(1)
        expect(google.initialize).toHaveBeenCalledTimes(1)
    })

    test("at the slot's width; with no ResizeObserver (jsdom), drawn again once a window resize that changed it settles (A-2)", async () => {
        expect(typeof ResizeObserver).toBe('undefined')
        let width = 352
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ width }) as DOMRect)
        const google = await withButton('/login')
        expect(google.renderButton).toHaveBeenLastCalledWith(expect.any(HTMLElement), expect.objectContaining({ width: '352' }))
        vi.useFakeTimers()
        // a phone turned: one resize, then the button at the new width once it has settled
        width = 295
        act(() => { window.dispatchEvent(new Event('resize')) })
        expect(google.renderButton).toHaveBeenCalledTimes(1)
        act(() => { vi.advanceTimersByTime(1000) })
        expect(google.renderButton).toHaveBeenCalledTimes(2)
        expect(google.renderButton).toHaveBeenLastCalledWith(expect.any(HTMLElement), expect.objectContaining({ width: '295' }))
        // the same width again: nothing to draw
        act(() => {
            window.dispatchEvent(new Event('resize'))
            vi.advanceTimersByTime(1000)
        })
        expect(google.renderButton).toHaveBeenCalledTimes(2)
    })

    test("follows the slot itself through a ResizeObserver: one redraw at the new width once it settles, none for the same width (A-2)", async () => {
        // the slot can narrow with no window resize, e.g. when a scrollbar comes as a refusal line makes the page taller
        const observers: { callback: () => void; observed: Element[]; disconnect: ReturnType<typeof vi.fn> }[] = []
        vi.stubGlobal('ResizeObserver', class {
            callback: () => void
            observed: Element[] = []
            disconnect = vi.fn()
            constructor(callback: () => void) {
                this.callback = callback
                observers.push(this)
            }
            observe(el: Element) { this.observed.push(el) }
            unobserve() {}
        })
        let width = 352
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ width }) as DOMRect)
        const google = await withButton('/login')
        expect(google.renderButton).toHaveBeenLastCalledWith(expect.any(HTMLElement), expect.objectContaining({ width: '352' }))
        expect(observers).toHaveLength(1)
        expect(observers[0].observed).toEqual([google.renderButton.mock.lastCall![0]])
        vi.useFakeTimers()
        const resized = (to: number) => {
            width = to
            act(() => observers[0].callback())
        }
        // a drag narrows the slot frame by frame: Google's iframe is made again once, at the last width
        for (const to of [340, 320, 300]) resized(to)
        expect(google.renderButton).toHaveBeenCalledTimes(1)
        act(() => { vi.advanceTimersByTime(1000) })
        expect(google.renderButton).toHaveBeenCalledTimes(2)
        expect(google.renderButton).toHaveBeenLastCalledWith(expect.any(HTMLElement), expect.objectContaining({ width: '300' }))
        // the same width: nothing to draw
        resized(300)
        act(() => { vi.advanceTimersByTime(1000) })
        expect(google.renderButton).toHaveBeenCalledTimes(2)
        // wider than Google allows: drawn at 400, and wider still is the same 400, so nothing more
        resized(640)
        act(() => { vi.advanceTimersByTime(1000) })
        expect(google.renderButton).toHaveBeenLastCalledWith(expect.any(HTMLElement), expect.objectContaining({ width: '400' }))
        resized(800)
        act(() => { vi.advanceTimersByTime(1000) })
        expect(google.renderButton).toHaveBeenCalledTimes(3)
        cleanup()
        expect(observers[0].disconnect).toHaveBeenCalled()
    })
})

describe("Google's script blocked or failing (review focus 1, spec §6.3)", () => {
    test('a script that fails to load shows the fallback line and leaves the form usable', async () => {
        const user = userEvent.setup()
        auth.login.mockResolvedValue({ token: 't', user: { id: 'u1', username: 'ana' }, message: null })
        const onSuccess = renderAt('/login')
        await waitFor(() => expect(gsiScripts()).toHaveLength(1))
        act(() => { gsiScripts()[0].dispatchEvent(new Event('error')) })
        expect(await screen.findByRole('alert')).toHaveTextContent(FAILED)
        // no empty hole and no spinner: the line, its Try again, and the form
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
        expect(document.querySelector('[aria-busy="true"]')).toBeNull()
        await user.type(screen.getByLabelText('Username'), 'ana')
        await user.type(screen.getByLabelText('Password'), 'long-enough-1')
        await user.click(screen.getByRole('button', { name: 'Sign In' }))
        expect(auth.login).toHaveBeenCalledWith({ username: 'ana', password: 'long-enough-1' })
        await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    })

    test('a script with no answer in 10 s shows the line', async () => {
        vi.useFakeTimers()
        renderAt('/login')
        await act(async () => { await vi.advanceTimersByTimeAsync(9_999) })
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        await act(async () => { await vi.advanceTimersByTimeAsync(1) })
        expect(screen.getByRole('alert')).toHaveTextContent(FAILED)
    })

    test("a script that loads without google.accounts.id (a blocker's stand-in) shows the line", async () => {
        renderAt('/signup')
        await waitFor(() => expect(gsiScripts()).toHaveLength(1))
        act(() => { gsiScripts()[0].dispatchEvent(new Event('load')) })
        expect(await screen.findByRole('alert')).toHaveTextContent(FAILED)
        expect(screen.getByLabelText('Username')).toBeInTheDocument()
    })

    test('Google failing to draw its button shows the line', async () => {
        const google = stubGoogle()
        google.renderButton.mockImplementation(() => { throw new Error('GSI_LOGGER: renderButton failed') })
        renderAt('/login')
        expect(await screen.findByRole('alert')).toHaveTextContent(FAILED)
    })

    test('"Try again" loads the script again, and the button shows when it arrives', async () => {
        const user = userEvent.setup()
        renderAt('/login')
        await waitFor(() => expect(gsiScripts()).toHaveLength(1))
        act(() => { gsiScripts()[0].dispatchEvent(new Event('error')) })
        await user.click(await screen.findByRole('button', { name: 'Try again' }))
        await waitFor(() => expect(gsiScripts()).toHaveLength(1))
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        const google = stubGoogle()
        act(() => { gsiScripts()[0].dispatchEvent(new Event('load')) })
        expect(await screen.findByTestId('google-button')).toBeInTheDocument()
        expect(google.renderButton).toHaveBeenCalledTimes(1)
    })
})

describe("Google's answer (spec §1, §6.3, §8)", () => {
    test("goes to the server with the site's language and ?invite='s token (spec §2.2)", async () => {
        auth.googleSignIn.mockResolvedValue(SIGNED_IN)
        setLang('hr')
        const google = await withButton('/signup?invite=tok-1')
        await google.answer()
        expect(auth.googleSignIn).toHaveBeenCalledWith({ credential: CREDENTIAL, language: 'hr', waitlistToken: 'tok-1' })
        cleanup()
        setLang('en')
        const login = await withButton('/login')
        await login.answer()
        expect(auth.googleSignIn).toHaveBeenLastCalledWith({ credential: CREDENTIAL, language: 'en' })
    })

    test.each(['/login', '/signup'])('signed in on %s: on as a password sign-in goes (the form\'s onSuccess, AuthPage navigates)', async (path) => {
        auth.googleSignIn.mockResolvedValue(SIGNED_IN)
        const onSuccess = vi.fn()
        const google = await withButton(path, onSuccess)
        await google.answer()
        expect(onSuccess).toHaveBeenCalledTimes(1)
        expect(peekPendingGoogle()).toBeNull()
    })

    test("a new account from /login: the credential and address wait in memory, and the page goes to /signup's name step with the return path (P-1)", async () => {
        auth.googleSignIn.mockResolvedValue({ needsName: true, email: 'ana@gmail.com' })
        const google = await withButton({ pathname: '/login', state: { from: '/lobby/abc' } })
        await google.answer()
        expect(await screen.findByRole('heading', { level: 1, name: 'Choose your username' })).toBeInTheDocument()
        expect(screen.getByText(/^Signing up as/)).toHaveTextContent('Signing up as ana@gmail.com')
        expect(screen.getByTestId('where')).toHaveTextContent('/signup {"from":"/lobby/abc"}')
        expect(peekPendingGoogle()).toEqual({ credential: CREDENTIAL, email: 'ana@gmail.com' })
        // never in the history entry
        expect(screen.getByTestId('where').textContent).not.toContain(CREDENTIAL)
    })

    test('a new account on /signup: it stays (the invite link with it), the store tells its subscribers, and the name step shows at once', async () => {
        auth.googleSignIn.mockResolvedValue({ needsName: true, email: 'ana@gmail.com' })
        const told = vi.fn()
        const unsubscribe = subscribePendingGoogle(told)
        const google = await withButton('/signup?invite=tok-1')
        await google.answer()
        expect(told).toHaveBeenCalledTimes(1)
        expect(peekPendingGoogle()).toEqual({ credential: CREDENTIAL, email: 'ana@gmail.com' })
        expect(screen.getByTestId('where')).toHaveTextContent('/signup?invite=tok-1 null')
        expect(screen.getByRole('heading', { level: 1, name: 'Choose your username' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Create Account' })).not.toBeInTheDocument()
        unsubscribe()
    })

    test.each([
        ['GOOGLE_INVALID (an expired token)', refusal(401, 'GOOGLE_INVALID', 'Google sign-in failed, please try again'), "Google sign-in didn't go through. Try Google again."],
        ['GOOGLE_EMAIL_IN_USE', refusal(409, 'GOOGLE_EMAIL_IN_USE'), 'This email already belongs to a Stiglja account. Sign in to it with its password, or with the Google account connected to it; then you can connect Google in Settings.'],
        ['GOOGLE_EMAIL_UNVERIFIED', refusal(400, 'GOOGLE_EMAIL_UNVERIFIED'), "Google hasn't confirmed this address. Sign up with the form instead."],
        ['INVITE_CODE_INVALID (the private beta)', refusal(403, 'INVITE_CODE_INVALID'), 'Invalid invite code. Check it and try again.'],
        ['RATE_LIMITED', refusal(429, 'RATE_LIMITED'), 'Too many tries. Wait a little, then try again.'],
        ['a 404 (Google sign-in off on the server, A-5)', refusal(404, undefined, 'Not Found'), FAILED],
        ['a server error', refusal(500, undefined, 'Internal Server Error'), GENERIC],
        ['no answer', refusal(0, undefined, 'Failed to fetch'), GENERIC],
    ])('%s shows its line under the button; the button and the form stay', async (_, failure, line) => {
        auth.googleSignIn.mockRejectedValue(failure)
        const google = await withButton('/login')
        await google.answer()
        expect(await screen.findByRole('alert')).toHaveTextContent(line)
        expect(screen.queryByText(failure.message)).not.toBeInTheDocument()
        expect(screen.getByTestId('google-button')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
        expect(screen.getByTestId('where')).toHaveTextContent('/login')
        // A-6: Google's button is not drawn again
        expect(google.renderButton).toHaveBeenCalledTimes(1)
    })

    test('a refusal in Croatian', async () => {
        setLang('hr')
        auth.googleSignIn.mockRejectedValue(refusal(401, 'GOOGLE_INVALID', 'Google sign-in failed, please try again'))
        const google = await withButton('/login')
        await google.answer()
        expect(await screen.findByRole('alert')).toHaveTextContent('Prijava putem Googlea nije uspjela. Pokušaj još jednom s Googleom.')
    })

    test('GOOGLE_EMAIL_UNVERIFIED on /login links to the sign-up form, with the return path (A-12); on /signup the line alone', async () => {
        const user = userEvent.setup()
        auth.googleSignIn.mockRejectedValue(refusal(400, 'GOOGLE_EMAIL_UNVERIFIED'))
        const google = await withButton({ pathname: '/login', state: { from: '/lobby/abc' } })
        await google.answer()
        await user.click(await screen.findByRole('link', { name: 'Sign up with the form' }))
        expect(await screen.findByRole('heading', { level: 1, name: 'Create Account' })).toBeInTheDocument()
        expect(screen.getByTestId('where')).toHaveTextContent('/signup {"from":"/lobby/abc"}')
        // /signup's own button, drawn by the same Google
        await waitFor(() => expect(google.renderButton).toHaveBeenCalledTimes(2))
        await google.answer()
        expect(await screen.findByRole('alert')).toHaveTextContent("Google hasn't confirmed this address. Sign up with the form instead.")
        expect(screen.queryByRole('link', { name: 'Sign up with the form' })).not.toBeInTheDocument()
    })

    test('signup full on /signup: the waitlist, saying so, with the Google address in it (spec §4, A-8)', async () => {
        auth.googleSignIn.mockRejectedValue(refusal(409, 'SIGNUP_FULL', 'Signup is full'))
        const google = await withButton('/signup')
        await google.answer()
        expect(await screen.findByRole('heading', { level: 1, name: 'Waitlist' })).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent("Signup is full, so no account was created. Join the waitlist below, and we'll email you when a place opens.")
        expect(screen.getByLabelText('Email')).toHaveValue('ana@gmail.com')
        expect(screen.queryByTestId('google-button')).not.toBeInTheDocument()
    })

    test('a dead invite link on /signup: the waitlist, saying so, with the Google address in it (spec §8)', async () => {
        auth.googleSignIn.mockRejectedValue(refusal(400, 'INVITE_LINK_INVALID', 'Invite link invalid'))
        const google = await withButton('/signup?invite=dead')
        await google.answer()
        expect(await screen.findByRole('heading', { level: 1, name: 'Waitlist' })).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent('This signup link is invalid or has expired, and signup is full right now. Join the waitlist again below, or play as a guest.')
        expect(screen.getByLabelText('Email')).toHaveValue('ana@gmail.com')
    })

    test("signup full from /login: to /signup, whose waitlist has the Google address in it, and the credential goes (A-8)", async () => {
        auth.googleSignIn.mockRejectedValue(refusal(409, 'SIGNUP_FULL', 'Signup is full'))
        beta.signupStatus.mockResolvedValue({ open: false })
        const google = await withButton({ pathname: '/login', state: { from: '/lobby/abc' } })
        await google.answer()
        expect(await screen.findByRole('heading', { level: 1, name: 'Waitlist' })).toBeInTheDocument()
        expect(screen.getByTestId('where')).toHaveTextContent('/signup {"from":"/lobby/abc"}')
        expect(screen.getByLabelText('Email')).toHaveValue('ana@gmail.com')
        // the waitlist read the address; the credential is of no more use (S2)
        await waitFor(() => expect(peekPendingGoogle()).toBeNull())
        expect(screen.getByLabelText('Email')).toHaveValue('ana@gmail.com')
    })

    test('a closed or cancelled Google window changes nothing (A-4)', async () => {
        const onSuccess = vi.fn()
        const google = await withButton('/login', onSuccess)
        // Google tells the page nothing when its window is closed: no answer comes
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)) })
        expect(auth.googleSignIn).not.toHaveBeenCalled()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(onSuccess).not.toHaveBeenCalled()
        expect(screen.getByTestId('where')).toHaveTextContent('/login null')
        expect(google.renderButton).toHaveBeenCalledTimes(1)
    })

    test('an answer while one is on its way is ignored; the next one clears the last line', async () => {
        let refuse!: (error: unknown) => void
        auth.googleSignIn.mockReturnValueOnce(new Promise((_, reject) => { refuse = reject }))
        const onSuccess = vi.fn()
        const google = await withButton('/login', onSuccess)
        await google.answer()
        await google.answer(tokenFor('other@gmail.com'))
        expect(auth.googleSignIn).toHaveBeenCalledTimes(1)
        await act(async () => refuse(refusal(401, 'GOOGLE_INVALID')))
        expect(await screen.findByRole('alert')).toHaveTextContent("Google sign-in didn't go through. Try Google again.")
        auth.googleSignIn.mockResolvedValue(SIGNED_IN)
        await google.answer()
        expect(auth.googleSignIn).toHaveBeenCalledTimes(2)
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(onSuccess).toHaveBeenCalledTimes(1)
    })

    test('logs neither Google\'s token nor the address in it (spec §6.1)', async () => {
        const logs = captureConsole()
        // a new account: the name step takes the form's place, and with it Google's button
        auth.googleSignIn.mockResolvedValueOnce({ needsName: true, email: 'ana@gmail.com' })
        const google = await withButton('/signup')
        await google.answer()
        expect(await screen.findByRole('heading', { level: 1, name: 'Choose your username' })).toBeInTheDocument()
        cleanup()
        clearPendingGoogle()
        // the cap: the waitlist, with the address
        auth.googleSignIn.mockRejectedValueOnce(refusal(409, 'SIGNUP_FULL', 'Signup is full'))
        renderAt('/signup')
        await screen.findByTestId('google-button')
        await google.answer()
        expect(await screen.findByRole('heading', { level: 1, name: 'Waitlist' })).toBeInTheDocument()
        expect(logs.leaked(CREDENTIAL, 'ana@gmail.com')).toEqual([])
    })
})
