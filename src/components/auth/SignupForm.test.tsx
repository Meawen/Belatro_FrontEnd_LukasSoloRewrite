import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SignupForm } from './SignupForm'
import { ApiError } from '../../services/api'
import { captureConsole } from '../../test/captureConsole'
import { setLang } from '../../i18n/lang'

const auth = vi.hoisted(() => ({ signup: vi.fn(), isGuest: false }))
vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ signup: auth.signup, isSignupLoading: false, isGuest: auth.isGuest }),
}))
// spec §2.2 (B7): whether the open form takes signups now, and joining the waitlist
const beta = vi.hoisted(() => ({ signupStatus: vi.fn(), joinWaitlist: vi.fn() }))
vi.mock('../../services/betaService', () => ({ betaService: beta }))

beforeEach(() => {
    vi.clearAllMocks()
    auth.isGuest = false
    beta.signupStatus.mockResolvedValue({ open: true })
})
afterEach(() => setLang('en'))

/** The form links to /login, so it renders inside a router; it waits for the signup status before its h1. */
async function renderForm(onSuccess = vi.fn(), path = '/signup') {
    render(<MemoryRouter initialEntries={[path]}><SignupForm onSuccess={onSuccess} /></MemoryRouter>)
    await screen.findByRole('heading', { level: 1 })
    return onSuccess
}

async function fill(username: string, password: string, confirm = password) {
    const user = userEvent.setup()
    const onSuccess = await renderForm()
    await user.type(screen.getByLabelText('Username'), username)
    await user.type(screen.getByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Password'), password)
    await user.type(screen.getByLabelText('Confirm Password'), confirm)
    await user.click(screen.getByRole('button', { name: /create account/i }))
    return { user, onSuccess }
}

describe('SignupForm credential rules', () => {
    test('a 7-character password is refused with the backend message', async () => {
        await fill('ana', 'short12')
        expect(screen.getByText('Password must be at least 8 characters and at most 72 bytes')).toBeInTheDocument()
        expect(auth.signup).not.toHaveBeenCalled()
    })

    test('a password over 72 bytes is refused', async () => {
        await fill('ana', 'ä'.repeat(37))
        expect(screen.getByText('Password must be at least 8 characters and at most 72 bytes')).toBeInTheDocument()
        expect(auth.signup).not.toHaveBeenCalled()
    })

    test('a username outside the pattern is refused', async () => {
        await fill('ana.b', 'long-enough-1')
        expect(screen.getByText('Username must be 3–20 characters: letters (including č ć š ž đ), digits or _')).toBeInTheDocument()
        expect(auth.signup).not.toHaveBeenCalled()
    })

    test('a username with č ć š ž đ is sent as typed; the server stores it lower-cased (spec §1.5)', async () => {
        auth.signup.mockResolvedValue({ token: 't', user: { id: 'u1', username: 'matić' }, message: null })
        await fill('Matić', 'long-enough-1')
        expect(auth.signup).toHaveBeenCalledWith({ username: 'Matić', email: 'ana@example.com', password: 'long-enough-1' })
    })

    test('a letter outside the alphabet is refused with the rule that names č ć š ž đ', async () => {
        await fill('miño', 'long-enough-1')
        expect(screen.getByText('Username must be 3–20 characters: letters (including č ć š ž đ), digits or _')).toBeInTheDocument()
        expect(auth.signup).not.toHaveBeenCalled()
    })

    // A guard: the email input already strips ASCII spaces (value sanitizing), and anything else
    // around the address fails its native validation, so this passes with or without the trim.
    test('a valid form sends the trimmed address, the one the panel names', async () => {
        const user = userEvent.setup()
        auth.signup.mockResolvedValue({ token: 't', user: { id: 'u1', username: 'ana' }, message: null })
        await renderForm()
        await user.type(screen.getByLabelText('Username'), 'ana')
        await user.type(screen.getByLabelText('Email'), '  ana@example.com  ')
        await user.type(screen.getByLabelText('Password'), 'long-enough-1')
        await user.type(screen.getByLabelText('Confirm Password'), 'long-enough-1')
        await user.click(screen.getByRole('button', { name: /create account/i }))
        expect(auth.signup).toHaveBeenCalledWith({ username: 'ana', email: 'ana@example.com', password: 'long-enough-1' })
    })

    test('a valid form sends the trimmed username', async () => {
        auth.signup.mockResolvedValue({ token: 't', user: { id: 'u1', username: 'ana' }, message: null })
        await fill('  ana  ', 'long-enough-1')
        expect(auth.signup).toHaveBeenCalledWith({ username: 'ana', email: 'ana@example.com', password: 'long-enough-1' })
    })
})

describe('SignupForm failures', () => {
    // With Redis down the backend answers signup with a 500 (lane-email contract: show a generic "try again")
    test.each([
        ['a server error', new ApiError({ status: 500, message: 'Internal Server Error' })],
        ['no answer', new ApiError({ status: 0, message: 'Failed to fetch' })],
    ])("%s shows a generic try-again, not the browser's or Spring's text", async (_, failure) => {
        auth.signup.mockRejectedValue(failure)
        await fill('ana', 'long-enough-1')
        expect(await screen.findByText('Something went wrong. Try again.')).toBeInTheDocument()
        expect(screen.queryByText(failure.message)).not.toBeInTheDocument()
    })

    test('a taken username still shows the server message', async () => {
        auth.signup.mockRejectedValue(new ApiError({ status: 409, message: 'Username is already taken' }))
        await fill('ana', 'long-enough-1')
        expect(await screen.findByText('Username is already taken')).toBeInTheDocument()
    })

    test("a guest still seated keeps its own name at signup: IN_GAME reads as its own line, not the rename one, and the form stays (Ruling 5)", async () => {
        captureConsole()
        auth.isGuest = true
        auth.signup.mockRejectedValue(new ApiError({ status: 409, message: "You can't change your name while at a table or in a game", code: 'IN_GAME' }))
        await fill('marko', 'long-enough-1')
        expect(await screen.findByRole('alert')).toHaveTextContent(
            "You're still at a table or in a game under this name. You can keep it once you leave the table or the game ends, or pick another name now.")
        expect(screen.queryByText(/change your name/)).not.toBeInTheDocument()
        expect(screen.getByLabelText('Username')).toHaveValue('marko')
        expect(screen.getByLabelText('Email')).toHaveValue('ana@example.com')
    })

    test('the IN_GAME line at signup in Croatian', async () => {
        captureConsole()
        setLang('hr')
        auth.isGuest = true
        auth.signup.mockRejectedValue(new ApiError({ status: 409, message: "You can't change your name while at a table or in a game", code: 'IN_GAME' }))
        const user = userEvent.setup()
        await renderForm()
        await user.type(screen.getByLabelText('Korisničko ime'), 'marko')
        await user.type(screen.getByLabelText('E-adresa'), 'ana@example.com')
        await user.type(screen.getByLabelText('Lozinka'), 'long-enough-1')
        await user.type(screen.getByLabelText('Potvrda lozinke'), 'long-enough-1')
        await user.click(screen.getByRole('button', { name: 'Izradi račun' }))
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Pod ovim imenom još sjediš za stolom ili igraš partiju. Ime možeš zadržati kad napustiš stol ili kad partija završi, a možeš i odmah odabrati drugo.')
        expect(screen.getByLabelText('E-adresa')).toHaveValue('ana@example.com')
    })

    test("a reserved name is sent, and the server's refusal reads as its line (USERNAME_RESERVED)", async () => {
        auth.signup.mockRejectedValue(new ApiError({ status: 400, message: 'That username is reserved', code: 'USERNAME_RESERVED' }))
        await fill('obrisan_x', 'long-enough-1')
        expect(auth.signup).toHaveBeenCalledTimes(1)
        expect(await screen.findByText('Names starting with obrisan_ are reserved. Choose another one.')).toBeInTheDocument()
    })
})

describe('SignupForm after success', () => {
    test('asks to check the inbox before continuing', async () => {
        auth.signup.mockResolvedValue({ token: 't', user: { id: 'u1', username: 'ana' }, message: null })
        const { user, onSuccess } = await fill('ana', 'long-enough-1')
        expect(await screen.findByText('Check your inbox')).toBeInTheDocument()
        expect(screen.getByText('ana@example.com')).toBeInTheDocument()
        // no promise of a mail: an address another account holds gets no link
        expect(screen.getByText(/confirmation link is on its way/)).toHaveTextContent(
            'If this address can be used, a confirmation link is on its way to ana@example.com. Check your inbox (and spam).')
        // spec §2.1 (D-25, US-26): the 7 days, as the signup email says them
        expect(screen.getByText('If the address is not confirmed within 7 days, the account will be removed.')).toBeInTheDocument()
        expect(screen.queryByText(/We sent/)).not.toBeInTheDocument()
        expect(onSuccess).not.toHaveBeenCalled()
        await user.click(screen.getByRole('button', { name: 'Continue' }))
        expect(onSuccess).toHaveBeenCalledTimes(1)
    })

    test('the check-inbox panel replaces the form, and focus moves to its heading (review, Accessibility)', async () => {
        auth.signup.mockResolvedValue({ token: 't', user: { id: 'u1', username: 'ana' }, message: null })
        await fill('ana', 'long-enough-1')
        const heading = await screen.findByRole('heading', { level: 1, name: 'Check your inbox' })
        expect(heading).toHaveFocus()
    })
})

describe('SignupForm logging', () => {
    const PASSWORD = 'Sup3r-Secret-pw!'
    const TOKEN = 'tok.en.value'

    afterEach(() => vi.restoreAllMocks())

    test('a submitted signup logs neither the password nor the returned token', async () => {
        auth.signup.mockResolvedValue({ token: TOKEN, user: { id: 'u1', username: 'ana' }, message: null })
        const logs = captureConsole()
        await fill('ana', PASSWORD)
        await waitFor(() => expect(screen.getByText('Check your inbox')).toBeInTheDocument())
        expect(logs.leaked(PASSWORD, TOKEN)).toEqual([])
    })

    test('a signup refused by validation logs no password', async () => {
        const logs = captureConsole()
        await fill('ana', PASSWORD, 'not-the-same-pw')
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
        expect(auth.signup).not.toHaveBeenCalled()
        expect(logs.leaked(PASSWORD, 'not-the-same-pw')).toEqual([])
    })

    test('a sign-up writes nothing to the console (X-14)', async () => {
        auth.signup.mockResolvedValue({ token: TOKEN, user: { id: 'u1', username: 'ana' }, message: null })
        const logs = captureConsole()
        await fill('ana', PASSWORD)
        await waitFor(() => expect(screen.getByText('Check your inbox')).toBeInTheDocument())
        expect(logs.text()).toBe('')
    })
})

describe('SignupForm legal line (R-40)', () => {
    test('links the Terms and the Privacy notice under Create Account', async () => {
        await renderForm()
        expect(screen.getByText(/By creating an account you accept the/)).toHaveTextContent(
            'By creating an account you accept the Terms; see the Privacy notice.')
        expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
        expect(screen.getByRole('link', { name: 'Privacy notice' })).toHaveAttribute('href', '/privacy')
    })
})

describe('SignupForm, the cap and the waitlist (spec §2)', () => {
    const ACCOUNT = { username: 'ana', email: 'ana@example.com', password: 'long-enough-1' }

    /** Types a valid account into the rendered form and presses Create Account. */
    async function submitAccount(user = userEvent.setup()) {
        await user.type(screen.getByLabelText('Username'), 'ana')
        await user.type(screen.getByLabelText('Email'), 'ana@example.com')
        await user.type(screen.getByLabelText('Password'), 'long-enough-1')
        await user.type(screen.getByLabelText('Confirm Password'), 'long-enough-1')
        await user.click(screen.getByRole('button', { name: 'Create Account' }))
        return user
    }

    afterEach(() => vi.restoreAllMocks())

    test('the open form has no invite field and posts only the account (spec §2.1)', async () => {
        auth.signup.mockResolvedValue({ token: 't', user: { id: 'u1', username: 'ana' }, message: null })
        const { container } = render(<MemoryRouter initialEntries={['/signup']}><SignupForm /></MemoryRouter>)
        await screen.findByRole('heading', { level: 1, name: 'Create Account' })
        expect(screen.queryByLabelText('Invite code')).not.toBeInTheDocument()
        expect(container.querySelector('input[name="inviteCode"]')).toBeNull()
        await submitAccount()
        expect(auth.signup).toHaveBeenCalledWith(ACCOUNT)
        expect(beta.signupStatus).toHaveBeenCalledTimes(1)
    })

    test('while the status is asked the form waits, so no form flashes at the cap', () => {
        beta.signupStatus.mockReturnValue(new Promise(() => {}))
        render(<MemoryRouter initialEntries={['/signup']}><SignupForm /></MemoryRouter>)
        expect(screen.getByText('Shuffling…')).toBeInTheDocument()
        expect(screen.queryByLabelText('Username')).not.toBeInTheDocument()
        expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    })

    test('full: /signup is the waitlist; it says so, and offers a game as a guest now (spec §2.2)', async () => {
        beta.signupStatus.mockResolvedValue({ open: false })
        const { container } = render(<MemoryRouter initialEntries={['/signup']}><SignupForm /></MemoryRouter>)
        expect(await screen.findByRole('heading', { level: 1, name: 'Waitlist' })).toBeInTheDocument()
        expect(screen.getByText("Signup is full for now. Leave your email address and we'll write to you as soon as a place opens.")).toBeInTheDocument()
        expect(screen.getByLabelText('Email')).toBeInTheDocument()
        expect(screen.queryByLabelText('Username')).not.toBeInTheDocument()
        expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Join the waitlist', 'Play against bots as a guest'])
        const primary = container.querySelectorAll('.ui-btn--primary')
        expect(primary).toHaveLength(1)
        expect(primary[0]).toHaveTextContent('Join the waitlist')
        expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
    })

    test("joining sends the address and the site's language, and answers alike: check your inbox (spec §2.2)", async () => {
        beta.signupStatus.mockResolvedValue({ open: false })
        beta.joinWaitlist.mockResolvedValue(undefined)
        const { container } = render(<MemoryRouter initialEntries={['/signup']}><SignupForm /></MemoryRouter>)
        const user = userEvent.setup()
        await user.type(await screen.findByLabelText('Email'), 'ana@example.com')
        await user.click(screen.getByRole('button', { name: 'Join the waitlist' }))
        expect(beta.joinWaitlist).toHaveBeenCalledWith('ana@example.com', 'en')
        expect(await screen.findByRole('heading', { level: 1, name: 'Check your inbox' })).toBeInTheDocument()
        // B7 answers every address alike (202), so no promise of a mail
        expect(screen.getByText(/a link to confirm it is on its way/)).toHaveTextContent(
            "If this address can join the waitlist, a link to confirm it is on its way to ana@example.com. Check your inbox (and spam) and confirm it within 7 days. When a place opens, we'll email you a signup link.")
        const primary = container.querySelectorAll('.ui-btn--primary')
        expect(primary).toHaveLength(1)
        expect(primary[0]).toHaveTextContent('Play against bots as a guest')
    })

    test('a status that fails shows the form: the server still decides', async () => {
        beta.signupStatus.mockRejectedValue(new ApiError({ status: 0, message: 'Failed to fetch' }))
        render(<MemoryRouter initialEntries={['/signup']}><SignupForm /></MemoryRouter>)
        expect(await screen.findByLabelText('Username')).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 1, name: 'Create Account' })).toBeInTheDocument()
    })

    test('a signup refused as full meanwhile becomes the waitlist, keeping the address (Review focus 2)', async () => {
        captureConsole()
        auth.signup.mockRejectedValue(new ApiError({ status: 409, message: 'Signup is full', code: 'SIGNUP_FULL' }))
        await renderForm()
        await submitAccount()
        expect(await screen.findByRole('heading', { level: 1, name: 'Waitlist' })).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent(
            'Signup is full, so no account was created. Join the waitlist below, and we\'ll email you when a place opens.')
        expect(screen.getByLabelText('Email')).toHaveValue('ana@example.com')
        expect(screen.queryByLabelText('Username')).not.toBeInTheDocument()
    })

    test('an invite link asks no status and sends its token (spec §2.2)', async () => {
        auth.signup.mockResolvedValue({ token: 't', user: { id: 'u1', username: 'ana' }, message: null })
        await renderForm(vi.fn(), '/signup?invite=tok-1')
        expect(beta.signupStatus).not.toHaveBeenCalled()
        expect(screen.getByRole('heading', { level: 1, name: 'Create Account' })).toBeInTheDocument()
        expect(screen.getByText('A place has opened for you. Create your account with this link.')).toBeInTheDocument()
        expect(screen.queryByText('Join the game today')).not.toBeInTheDocument()
        await submitAccount()
        expect(auth.signup).toHaveBeenCalledWith({ ...ACCOUNT, waitlistToken: 'tok-1' })
    })

    test('a dead invite link while full becomes the waitlist, saying so, with the guest door (spec §8)', async () => {
        captureConsole()
        auth.signup.mockRejectedValue(new ApiError({ status: 400, message: 'This signup link is invalid or has expired', code: 'INVITE_LINK_INVALID' }))
        await renderForm(vi.fn(), '/signup?invite=tok-1')
        await submitAccount()
        expect(await screen.findByRole('heading', { level: 1, name: 'Waitlist' })).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent(
            'This signup link is invalid or has expired, and signup is full right now. Join the waitlist again below, or play as a guest.')
        expect(screen.getByRole('button', { name: 'Play against bots as a guest' })).toBeInTheDocument()
        expect(screen.getByLabelText('Email')).toHaveValue('ana@example.com')
    })

    test('from a guest browser the signup says wasGuest, and only from one (spec §9, Ruling 5)', async () => {
        auth.signup.mockResolvedValue({ token: 't', user: { id: 'u1', username: 'ana' }, message: null })
        auth.isGuest = true
        await renderForm()
        await submitAccount()
        expect(auth.signup).toHaveBeenCalledWith({ ...ACCOUNT, wasGuest: true })
    })

    test('the waitlist in Croatian (§1.4)', async () => {
        setLang('hr')
        beta.signupStatus.mockResolvedValue({ open: false })
        beta.joinWaitlist.mockResolvedValue(undefined)
        const { unmount } = render(<MemoryRouter initialEntries={['/signup']}><SignupForm /></MemoryRouter>)
        expect(await screen.findByRole('heading', { level: 1, name: 'Red za stol' })).toBeInTheDocument()
        expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Upiši se u red', 'Igraj protiv botova kao gost'])
        const user = userEvent.setup()
        await user.type(screen.getByLabelText('E-adresa'), 'ana@example.com')
        await user.click(screen.getByRole('button', { name: 'Upiši se u red' }))
        expect(beta.joinWaitlist).toHaveBeenCalledWith('ana@example.com', 'hr')
        expect(await screen.findByRole('heading', { level: 1, name: 'Provjeri poštu' })).toBeInTheDocument()
        // gone before the language is reset after the test
        unmount()
    })
})

describe('SignupForm in Croatian (open beta §1.1)', () => {
    async function fillInCroatian(password: string, confirm: string, username = 'ana') {
        const user = userEvent.setup()
        await user.type(screen.getByLabelText('Korisničko ime'), username)
        await user.type(screen.getByLabelText('E-adresa'), 'ana@example.com')
        await user.type(screen.getByLabelText('Lozinka'), password)
        await user.type(screen.getByLabelText('Potvrda lozinke'), confirm)
        await user.click(screen.getByRole('button', { name: 'Izradi račun' }))
    }

    test('sign-up in Croatian: the form, the legal line, a mismatch, and the inbox after a sign-up', async () => {
        setLang('hr')
        await renderForm()
        expect(screen.getByRole('heading', { level: 1, name: 'Izradi račun' })).toBeInTheDocument()
        expect(screen.getByText(/Izradom računa prihvaćaš/)).toHaveTextContent('Izradom računa prihvaćaš Uvjete korištenja; pročitaj i Obavijest o privatnosti.')
        expect(screen.getByRole('link', { name: 'Uvjete korištenja' })).toHaveAttribute('href', '/terms')
        expect(screen.getByRole('link', { name: 'Prijavi se' })).toHaveAttribute('href', '/login')
        await fillInCroatian('long-enough-1', 'long-enough-2')
        expect(screen.getByText('Lozinke se ne podudaraju.')).toBeInTheDocument()
        expect(auth.signup).not.toHaveBeenCalled()
    })

    test('after a sign-up in Croatian: check your inbox', async () => {
        setLang('hr')
        auth.signup.mockResolvedValue({ token: 't', user: { id: 'u1', username: 'ana' }, message: null })
        await renderForm()
        await fillInCroatian('long-enough-1', 'long-enough-1')
        expect(await screen.findByRole('heading', { level: 1, name: 'Provjeri poštu' })).toBeInTheDocument()
        expect(screen.getByText(/poveznica za potvrdu stiže na/)).toHaveTextContent(
            'Ako se ova adresa može koristiti, poveznica za potvrdu stiže na ana@example.com. Provjeri poštu (i neželjenu poštu). Potvrdi adresu za rangirane partije; nerangirane možeš igrati odmah.')
        expect(screen.getByText('Ako adresu ne potvrdiš u roku od 7 dana, račun ćemo obrisati.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Nastavi' })).toBeInTheDocument()
    })

    test('a reserved name in Croatian', async () => {
        setLang('hr')
        auth.signup.mockRejectedValue(new ApiError({ status: 400, message: 'That username is reserved', code: 'USERNAME_RESERVED' }))
        await renderForm()
        await fillInCroatian('long-enough-1', 'long-enough-1', 'obrisan_x')
        expect(await screen.findByText('Imena koja počinju s obrisan_ rezervirana su. Odaberi drugo ime.')).toBeInTheDocument()
    })
})
