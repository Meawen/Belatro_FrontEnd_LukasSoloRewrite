import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, type InitialEntry } from 'react-router-dom'
import { SignupForm } from './SignupForm'
import { AuthPage } from './AuthPage'
import { ApiError } from '../../services/api'
import { clearPendingGoogle, peekPendingGoogle, setPendingGoogle } from '../../services/googleSignIn'
import { setLang } from '../../i18n/lang'
import { captureConsole } from '../../test/captureConsole'
import { CLIENT_ID, dropGoogleScripts, stubGoogle, tokenFor } from '../../test/googleStub'

const auth = vi.hoisted(() => ({ signup: vi.fn(), googleSignIn: vi.fn(), googleSignup: vi.fn(), isGuest: false }))
vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ ...auth, isAuthenticated: false, isSignupLoading: false }),
}))
// spec §2.2 (B7): whether /signup takes signups now, and joining the waitlist
const beta = vi.hoisted(() => ({ signupStatus: vi.fn(), joinWaitlist: vi.fn() }))
vi.mock('../../services/betaService', () => ({ betaService: beta }))

const ADDRESS = 'ana@gmail.com'
const CREDENTIAL = tokenFor(ADDRESS)
const RULE = 'Username must be 3–20 characters: letters (including č ć š ž đ), digits or _'
const FAILED = "Google sign-in didn't open. Try again, or use your name and password."
const GENERIC = 'Something went wrong. Try again.'
/** Step 2's 200 (B2): signup's answer, for a new account and a sign-in alike. */
const MEMBER = { token: 'm-tok', user: { id: 'u1', username: 'jura', guest: false }, message: null }

const refusal = (status: number, code?: string, message = 'refused') => new ApiError({ status, message, code })

/** Where the router is, and the state it carries. */
function Where() {
    const { pathname, search, state } = useLocation()
    return <p data-testid="where">{`${pathname}${search} ${JSON.stringify(state)}`}</p>
}

/** /signup as App routes it, after Google answered needsName for ana@gmail.com (P-1: the credential waits in memory). */
function renderStep(entry: InitialEntry = '/signup', onSuccess = vi.fn(), email = ADDRESS) {
    setPendingGoogle({ credential: CREDENTIAL, email })
    render(
        <MemoryRouter initialEntries={[entry]}>
            <Routes>
                <Route path="/signup" element={<><SignupForm onSuccess={onSuccess} /><Where /></>} />
                <Route path="/login" element={<><h1>Sign-in page</h1><Where /></>} />
            </Routes>
        </MemoryRouter>,
    )
    return onSuccess
}

/** The step on screen, once the signup status is in. */
async function openStep(entry?: InitialEntry, onSuccess?: () => void) {
    const done = renderStep(entry, onSuccess)
    await screen.findByRole('heading', { level: 1 })
    return done
}

const nameField = () => screen.getByLabelText('Username')
const makeAccount = () => screen.getByRole('button', { name: 'Make my account' })

beforeEach(() => {
    vi.clearAllMocks()
    auth.isGuest = false
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

describe('the name step after Google (Google sign-in spec §3.3, §8 "Name step")', () => {
    test('the Google address, the name field with the rule as its hint, the Terms line, Make my account and the way back', async () => {
        await openStep()
        const heading = screen.getByRole('heading', { level: 1, name: 'Choose your username' })
        // it took the form's place: reading starts again at its heading
        expect(heading).toHaveFocus()
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
        expect(screen.getByText(/^Signing up as/)).toHaveTextContent(`Signing up as ${ADDRESS}`)
        expect(screen.getByText(ADDRESS).tagName).toBe('STRONG')
        expect(nameField()).toHaveValue('')
        expect(nameField()).toHaveAccessibleDescription(RULE)
        expect(nameField()).not.toBeInvalid()
        expect(screen.getByText(/By creating an account you accept the/)).toHaveTextContent('By creating an account you accept the Terms; see the Privacy notice.')
        expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
        expect(screen.getByRole('link', { name: 'Privacy notice' })).toHaveAttribute('href', '/privacy')
        expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Make my account', 'Use another way to sign up'])
        // the step, not the form
        expect(screen.queryByRole('heading', { name: 'Create Account' })).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    })

    test('a long Google address wraps anywhere, and an empty one leaves the line out', async () => {
        const long = `${'a'.repeat(60)}@${'b'.repeat(40)}.example.com`
        renderStep('/signup', vi.fn(), long)
        expect(await screen.findByText(long)).toHaveClass('wrap-anywhere')
        cleanup()
        // B1 never answers needsName without an address; if one came, no "Signing up as" with nothing after it
        renderStep('/signup', vi.fn(), '')
        await screen.findByRole('heading', { level: 1, name: 'Choose your username' })
        expect(screen.queryByText(/Signing up as/)).not.toBeInTheDocument()
    })

    test('validates the name live: the rule becomes the error once the field is left, and goes the moment the name fits (A-5)', async () => {
        const user = userEvent.setup()
        await openStep()
        await user.type(nameField(), 'ab')
        // while the first name is typed, still the hint
        expect(nameField()).not.toBeInvalid()
        await user.tab()
        expect(nameField()).toBeInvalid()
        expect(nameField()).toHaveAccessibleDescription(RULE)
        expect(screen.getByText(RULE)).toHaveClass('text-danger-text')
        await user.type(nameField(), 'c')
        expect(nameField()).not.toBeInvalid()
        expect(screen.getByText(RULE)).not.toHaveClass('text-danger-text')
        await user.type(nameField(), '.')
        expect(nameField()).toBeInvalid()
        expect(auth.googleSignup).not.toHaveBeenCalled()
    })

    test('nothing goes out while the name breaks the rule; an empty one is required', async () => {
        const user = userEvent.setup()
        await openStep()
        await user.click(makeAccount())
        expect(nameField()).toBeInvalid()
        expect(nameField()).toHaveAccessibleDescription('Username is required')
        await user.type(nameField(), 'miño')
        expect(nameField()).toHaveAccessibleDescription(RULE)
        await user.click(makeAccount())
        expect(nameField()).toBeInvalid()
        expect(auth.googleSignup).not.toHaveBeenCalled()
    })

    test("sends Google's token with the trimmed name in the site's language, and ?invite='s token and wasGuest as the form does", async () => {
        const user = userEvent.setup()
        auth.googleSignup.mockResolvedValue(MEMBER)
        await openStep()
        await user.type(nameField(), '  jura  ')
        await user.click(makeAccount())
        expect(auth.googleSignup).toHaveBeenCalledWith({ credential: CREDENTIAL, username: 'jura', language: 'en' })
        cleanup()

        setLang('hr')
        auth.isGuest = true
        await openStep('/signup?invite=tok-1')
        // a decomposed č (c + U+030C) passes the rule, which is checked in NFC; useAuth sends it in NFC (useAuth.test)
        await user.type(screen.getByLabelText('Korisničko ime'), 'Matič')
        await user.click(screen.getByRole('button', { name: 'Izradi moj račun' }))
        expect(auth.googleSignup).toHaveBeenLastCalledWith({
            credential: CREDENTIAL, username: 'Matič', language: 'hr', waitlistToken: 'tok-1', wasGuest: true,
        })
        // with a personal link nothing is asked first (spec §2.2)
        expect(beta.signupStatus).toHaveBeenCalledTimes(1)
    })

    test("success: the credential goes and on it goes, as the form's success does, with no frame of anything else (A-3)", async () => {
        const user = userEvent.setup()
        auth.googleSignup.mockResolvedValue(MEMBER)
        const onSuccess = await openStep()
        await user.type(nameField(), 'jura')
        await user.click(makeAccount())
        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
        expect(peekPendingGoogle()).toBeNull()
        // the step stays, busy, until the page moves on: no check-inbox panel, no form
        expect(screen.getByRole('heading', { level: 1, name: 'Choose your username' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Creating your account…' })).toBeDisabled()
        expect(screen.queryByRole('heading', { name: 'Create Account' })).not.toBeInTheDocument()
        expect(screen.queryByText('Check your inbox')).not.toBeInTheDocument()
    })

    test("on AuthPage the success lands on the return path, where a sign-up from the form goes (spec §6.3)", async () => {
        const user = userEvent.setup()
        auth.googleSignup.mockResolvedValue(MEMBER)
        setPendingGoogle({ credential: CREDENTIAL, email: ADDRESS })
        render(
            <MemoryRouter initialEntries={[{ pathname: '/signup', state: { from: '/lobby/abc' } }]}>
                <Routes>
                    <Route path="/signup" element={<AuthPage initialMode="signup" redirectTo="/dashboard" />} />
                    <Route path="/lobby/:id" element={<><h1>The table</h1><Where /></>} />
                </Routes>
            </MemoryRouter>,
        )
        await user.type(await screen.findByLabelText('Username'), 'jura')
        await user.click(makeAccount())
        expect(await screen.findByRole('heading', { name: 'The table' })).toBeInTheDocument()
        expect(screen.getByTestId('where')).toHaveTextContent('/lobby/abc')
    })

    test.each([
        ['USERNAME_TAKEN', refusal(409, 'USERNAME_TAKEN', 'Username is already taken'),
            'Username is already taken. Names that differ only in capitals or in the marks on č ć š ž đ count as the same name. Choose another one.'],
        ['USERNAME_RESERVED', refusal(400, 'USERNAME_RESERVED', 'That username is reserved'), 'Names starting with obrisan_ are reserved. Choose another one.'],
        ['the rule, from the server (400 VALIDATION with a username entry)', refusal(400, 'VALIDATION', RULE), RULE],
        ['IN_GAME (a guest still seated under its own name, Ruling 5)', refusal(409, 'IN_GAME', "You can't change your name while at a table or in a game"),
            'This name is still at a table or in a game. You can keep it once you leave the table or the game ends, or pick another name now.'],
    ])('%s: the line under the field, the name and the credential kept, and another try sends again (US-G5)', async (_, failure, line) => {
        const user = userEvent.setup()
        auth.googleSignup.mockRejectedValueOnce(failure).mockResolvedValueOnce(MEMBER)
        const onSuccess = await openStep()
        await user.type(nameField(), 'ana')
        await user.click(makeAccount())
        await waitFor(() => expect(nameField()).toHaveAccessibleDescription(line))
        expect(nameField()).toBeInvalid()
        expect(nameField()).toHaveValue('ana')
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(peekPendingGoogle()).toEqual({ credential: CREDENTIAL, email: ADDRESS })
        expect(makeAccount()).toBeEnabled()
        // the next keystroke takes the line away
        await user.type(nameField(), '2')
        expect(nameField()).not.toBeInvalid()
        expect(nameField()).toHaveAccessibleDescription(RULE)
        await user.click(makeAccount())
        expect(auth.googleSignup).toHaveBeenCalledTimes(2)
        expect(auth.googleSignup).toHaveBeenLastCalledWith({ credential: CREDENTIAL, username: 'ana2', language: 'en' })
        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    })

    test('a double tap sends once', async () => {
        const user = userEvent.setup()
        auth.googleSignup.mockReturnValue(new Promise(() => {}))
        await openStep()
        await user.type(nameField(), 'jura')
        const form = nameField().closest('form')!
        // both land before React draws the button busy
        act(() => {
            fireEvent.submit(form)
            fireEvent.submit(form)
        })
        expect(auth.googleSignup).toHaveBeenCalledTimes(1)
        expect(screen.getByRole('button', { name: 'Creating your account…' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Use another way to sign up' })).toBeDisabled()
    })

    test("logs neither Google's token nor the address in it (spec §6.1)", async () => {
        const user = userEvent.setup()
        const logs = captureConsole()
        auth.googleSignup.mockRejectedValueOnce(refusal(409, 'USERNAME_TAKEN', 'Username is already taken')).mockResolvedValueOnce(MEMBER)
        const onSuccess = await openStep()
        await user.type(nameField(), 'ana')
        await user.click(makeAccount())
        await user.type(nameField(), '2')
        await user.click(makeAccount())
        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
        expect(logs.leaked(CREDENTIAL, ADDRESS)).toEqual([])
    })

    test('in Croatian', async () => {
        setLang('hr')
        renderStep()
        expect(await screen.findByRole('heading', { level: 1, name: 'Odaberi korisničko ime' })).toBeInTheDocument()
        expect(screen.getByText(/^Registriraš se s e-adresom/)).toHaveTextContent(`Registriraš se s e-adresom ${ADDRESS}`)
        expect(screen.getByLabelText('Korisničko ime')).toHaveAccessibleDescription(
            'Korisničko ime mora imati 3–20 znakova: slova (uključujući č ć š ž đ), brojke ili donju crtu.')
        expect(screen.getByText(/Izradom računa prihvaćaš/)).toHaveTextContent('Izradom računa prihvaćaš Uvjete korištenja; pročitaj i Obavijest o privatnosti.')
        expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Izradi moj račun', 'Registriraj se na drugi način'])
        // gone before the language is reset after the test
        cleanup()
    })
})

describe('an expired Google token (review focus 4, spec §8)', () => {
    beforeEach(() => vi.stubEnv('VITE_GOOGLE_CLIENT_ID', CLIENT_ID))

    /** The step after step 2 answered GOOGLE_INVALID for `name`. */
    async function expiredWith(name: string) {
        const user = userEvent.setup()
        const google = stubGoogle()
        auth.googleSignup.mockRejectedValueOnce(refusal(401, 'GOOGLE_INVALID', 'Google sign-in failed, please try again'))
        const onSuccess = await openStep()
        await user.type(nameField(), name)
        await user.click(makeAccount())
        await screen.findByTestId('google-button')
        return { user, google, onSuccess }
    }

    test('an expired Google token keeps the typed name and asks for Google again', async () => {
        const { google, onSuccess } = await expiredWith('jura')
        expect(peekPendingGoogle()).toBeNull()
        expect(nameField()).toHaveValue('jura')
        expect(screen.getByRole('alert')).toHaveTextContent("Google sign-in didn't go through. Try Google again.")
        // Google's button in place of Make my account; the heading, the address and the way back stay
        expect(screen.queryByRole('button', { name: 'Make my account' })).not.toBeInTheDocument()
        expect(google.renderButton).toHaveBeenCalledTimes(1)
        expect(screen.getByRole('heading', { level: 1, name: 'Choose your username' })).toBeInTheDocument()
        expect(screen.getByText(ADDRESS)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Use another way to sign up' })).toBeEnabled()

        // the next tap, the same Google account: straight on with the same name, no other click (A-2)
        const fresh = tokenFor(ADDRESS, { iat: 2 })
        auth.googleSignup.mockResolvedValueOnce(MEMBER)
        await google.answer(fresh)
        expect(auth.googleSignup).toHaveBeenCalledTimes(2)
        expect(auth.googleSignup).toHaveBeenLastCalledWith({ credential: fresh, username: 'jura', language: 'en' })
        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
        expect(peekPendingGoogle()).toBeNull()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    test('another Google account picked in its window: nothing goes out, its address shows, and Make my account comes back (A-2)', async () => {
        const { user, google } = await expiredWith('jura')
        const ivo = tokenFor('ivo@gmail.com')
        await google.answer(ivo)
        expect(auth.googleSignup).toHaveBeenCalledTimes(1)
        expect(screen.getByText(/^Signing up as/)).toHaveTextContent('Signing up as ivo@gmail.com')
        expect(nameField()).toHaveValue('jura')
        expect(peekPendingGoogle()).toEqual({ credential: ivo, email: 'ivo@gmail.com' })
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(screen.queryByTestId('google-button')).not.toBeInTheDocument()
        auth.googleSignup.mockResolvedValueOnce(MEMBER)
        await user.click(makeAccount())
        expect(auth.googleSignup).toHaveBeenLastCalledWith({ credential: ivo, username: 'jura', language: 'en' })
    })

    test('the same account while the name now breaks the rule: nothing goes out, and the rule shows', async () => {
        const { user, google } = await expiredWith('jura')
        await user.clear(nameField())
        await user.type(nameField(), 'ju')
        const fresh = tokenFor(ADDRESS, { iat: 2 })
        await google.answer(fresh)
        expect(auth.googleSignup).toHaveBeenCalledTimes(1)
        expect(nameField()).toBeInvalid()
        expect(nameField()).toHaveAccessibleDescription(RULE)
        expect(makeAccount()).toBeEnabled()
        expect(peekPendingGoogle()).toEqual({ credential: fresh, email: ADDRESS })
    })
})

describe('the way back, and a reload (spec §3.3, §6.3, P-1)', () => {
    test('"Use another way to sign up" lets the credential go and shows the plain form, the invite link kept', async () => {
        vi.stubEnv('VITE_GOOGLE_CLIENT_ID', CLIENT_ID)
        stubGoogle()
        const user = userEvent.setup()
        await openStep('/signup?invite=tok-1')
        await user.type(nameField(), 'jura')
        await user.click(screen.getByRole('button', { name: 'Use another way to sign up' }))
        expect(peekPendingGoogle()).toBeNull()
        expect(screen.getByRole('heading', { level: 1, name: 'Create Account' })).toBeInTheDocument()
        expect(screen.getByText('A place has opened for you. Create your account with this link.')).toBeInTheDocument()
        expect(await screen.findByTestId('google-button')).toBeInTheDocument()
        // the name stays with the step
        expect(nameField()).toHaveValue('')
        expect(screen.getByTestId('where')).toHaveTextContent('/signup?invite=tok-1')
        expect(auth.googleSignup).not.toHaveBeenCalled()
    })

    test('with no credential in memory (after a reload: a fresh module has none, googleSignIn.test) /signup is the plain form', async () => {
        render(<MemoryRouter initialEntries={['/signup']}><SignupForm /></MemoryRouter>)
        expect(await screen.findByRole('heading', { level: 1, name: 'Create Account' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Choose your username' })).not.toBeInTheDocument()
    })
})

describe('the cap and the waitlist (spec §4, §8)', () => {
    test.each([
        ['signup full meanwhile (409 SIGNUP_FULL)', refusal(409, 'SIGNUP_FULL', 'Signup is full'), '/signup',
            "Signup is full, so no account was created. Join the waitlist below, and we'll email you when a place opens."],
        ['a dead invite link while full (400 INVITE_LINK_INVALID)', refusal(400, 'INVITE_LINK_INVALID', 'Invite link invalid'), '/signup?invite=dead',
            'This signup link is invalid or has expired, and signup is full right now. Join the waitlist again below, or play as a guest.'],
    ])('%s at step 2: the waitlist, saying so, with the Google address in it; the credential goes (US-G8)', async (_, failure, entry, line) => {
        const user = userEvent.setup()
        auth.googleSignup.mockRejectedValue(failure)
        await openStep(entry)
        await user.type(nameField(), 'jura')
        await user.click(makeAccount())
        expect(await screen.findByRole('heading', { level: 1, name: 'Waitlist' })).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent(line)
        expect(screen.getByLabelText('Email')).toHaveValue(ADDRESS)
        expect(screen.getByRole('button', { name: 'Play against bots as a guest' })).toBeInTheDocument()
        expect(peekPendingGoogle()).toBeNull()
    })

    test('signup full with a credential pending (Google at the cap from /login): the waitlist wins, prefilled, and the credential goes (S1 A-8)', async () => {
        beta.signupStatus.mockResolvedValue({ open: false })
        renderStep()
        expect(await screen.findByRole('heading', { level: 1, name: 'Waitlist' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Choose your username' })).not.toBeInTheDocument()
        await waitFor(() => expect(peekPendingGoogle()).toBeNull())
        // the waitlist read the address once, so it stays
        expect(screen.getByLabelText('Email')).toHaveValue(ADDRESS)
    })
})

describe('refusals no retry can fix (spec §3.3, §8; A-6)', () => {
    test.each([
        ['GOOGLE_EMAIL_IN_USE', refusal(409, 'GOOGLE_EMAIL_IN_USE'),
            'This email already belongs to a Stiglja account. Sign in to it with its password, or with the Google account connected to it; then you can connect Google in Settings.'],
        ['INVITE_CODE_INVALID (the private beta, US-G18)', refusal(403, 'INVITE_CODE_INVALID'), 'Invalid invite code. Check it and try again.'],
    ])('%s: its line, and Sign in in place of the field and Make my account; the credential goes', async (_, failure, line) => {
        const user = userEvent.setup()
        auth.googleSignup.mockRejectedValue(failure)
        await openStep({ pathname: '/signup', state: { from: '/lobby/abc' } })
        await user.type(nameField(), 'jura')
        await user.click(makeAccount())
        expect(await screen.findByRole('alert')).toHaveTextContent(line)
        expect(peekPendingGoogle()).toBeNull()
        expect(screen.queryByLabelText('Username')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Make my account' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Use another way to sign up' })).toBeEnabled()
        await user.click(screen.getByRole('button', { name: 'Sign in' }))
        expect(await screen.findByRole('heading', { name: 'Sign-in page' })).toBeInTheDocument()
        expect(screen.getByTestId('where')).toHaveTextContent('/login {"from":"/lobby/abc"}')
    })

    test('GOOGLE_EMAIL_UNVERIFIED: its line, and "Sign up with the form", which shows the form', async () => {
        const user = userEvent.setup()
        auth.googleSignup.mockRejectedValue(refusal(400, 'GOOGLE_EMAIL_UNVERIFIED'))
        await openStep()
        await user.type(nameField(), 'jura')
        await user.click(makeAccount())
        expect(await screen.findByRole('alert')).toHaveTextContent("Google hasn't confirmed this address. Sign up with the form instead.")
        expect(peekPendingGoogle()).toBeNull()
        expect(screen.queryByLabelText('Username')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Make my account' })).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Sign up with the form' }))
        expect(screen.getByRole('heading', { level: 1, name: 'Create Account' })).toBeInTheDocument()
        expect(screen.getByLabelText('Email')).toBeInTheDocument()
    })
})

describe('answers worth another try keep everything (spec §8)', () => {
    test.each([
        ['RATE_LIMITED', refusal(429, 'RATE_LIMITED'), 'Too many tries. Wait a little, then try again.'],
        ['EMAIL_TAKEN', refusal(409, 'EMAIL_TAKEN'), 'That email address is already in use. Use another one.'],
        ['a 404 (Google sign-in off on the server, S1 A-5)', refusal(404, undefined, 'Not Found'), FAILED],
        ['a server error', refusal(500, undefined, 'Internal Server Error'), GENERIC],
        ['no answer', refusal(0, undefined, 'Failed to fetch'), GENERIC],
        ['a missing credential (400 VALIDATION, B2-11)', refusal(400, 'VALIDATION', 'must not be blank'), "Something you entered isn't valid. Check the form and try again."],
    ])('%s: its line, with the name, the credential and Make my account kept', async (_, failure, line) => {
        const user = userEvent.setup()
        auth.googleSignup.mockRejectedValueOnce(failure).mockResolvedValueOnce(MEMBER)
        await openStep()
        await user.type(nameField(), 'jura')
        await user.click(makeAccount())
        expect(await screen.findByRole('alert')).toHaveTextContent(line)
        expect(screen.queryByText(failure.message)).not.toBeInTheDocument()
        expect(nameField()).toHaveValue('jura')
        expect(nameField()).not.toBeInvalid()
        expect(peekPendingGoogle()).toEqual({ credential: CREDENTIAL, email: ADDRESS })
        await user.click(makeAccount())
        expect(auth.googleSignup).toHaveBeenCalledTimes(2)
        await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    })
})
