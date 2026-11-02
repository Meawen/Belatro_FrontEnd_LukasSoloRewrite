import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SignupForm } from './SignupForm'
import { ApiError } from '../../services/api'
import { captureConsole } from '../../test/captureConsole'
import { setLang } from '../../i18n/lang'

const auth = vi.hoisted(() => ({ signup: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ signup: auth.signup, isSignupLoading: false }),
}))

beforeEach(() => vi.clearAllMocks())
afterEach(() => setLang('en'))

/** The form links to /login, so it renders inside a router. */
function renderForm(onSuccess = vi.fn()) {
    render(<MemoryRouter><SignupForm onSuccess={onSuccess} /></MemoryRouter>)
    return onSuccess
}

async function fill(username: string, password: string, confirm = password) {
    const user = userEvent.setup()
    const onSuccess = renderForm()
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
        renderForm()
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
        expect(screen.queryByText(/We sent/)).not.toBeInTheDocument()
        expect(onSuccess).not.toHaveBeenCalled()
        await user.click(screen.getByRole('button', { name: 'Continue' }))
        expect(onSuccess).toHaveBeenCalledTimes(1)
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
    test('links the Terms and the Privacy notice under Create Account', () => {
        renderForm()
        expect(screen.getByText(/By creating an account you accept the/)).toHaveTextContent(
            'By creating an account you accept the Terms; see the Privacy notice.')
        expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
        expect(screen.getByRole('link', { name: 'Privacy notice' })).toHaveAttribute('href', '/privacy')
    })
})

describe('SignupForm invite code (R-11)', () => {
    async function fillWithInvite(invite: string) {
        const user = userEvent.setup()
        renderForm()
        await user.type(screen.getByLabelText('Username'), 'ana')
        await user.type(screen.getByLabelText('Email'), 'ana@example.com')
        await user.type(screen.getByLabelText('Password'), 'long-enough-1')
        await user.type(screen.getByLabelText('Confirm Password'), 'long-enough-1')
        await user.type(screen.getByLabelText('Invite code'), invite)
        await user.click(screen.getByRole('button', { name: /create account/i }))
    }

    test('the code is sent as inviteCode, trimmed', async () => {
        auth.signup.mockResolvedValue({ token: 't', user: { id: 'u1', username: 'ana' }, message: null })
        await fillWithInvite('  friends-2026  ')
        expect(auth.signup).toHaveBeenCalledWith({
            username: 'ana', email: 'ana@example.com', password: 'long-enough-1', inviteCode: 'friends-2026',
        })
    })

    test('a 403 "Invalid invite code" shows on the invite field', async () => {
        auth.signup.mockRejectedValue(new ApiError({ status: 403, message: 'Invalid invite code' }))
        await fillWithInvite('wrong')
        expect(await screen.findByText('Invalid invite code')).toBeInTheDocument()
        // on the field: its own error line, which describes the input to assistive tech
        expect(screen.getByLabelText('Invite code')).toHaveAccessibleDescription('Invalid invite code')
        expect(screen.getAllByText('Invalid invite code')).toHaveLength(1)
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
        renderForm()
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
        renderForm()
        await fillInCroatian('long-enough-1', 'long-enough-1')
        expect(await screen.findByRole('heading', { level: 1, name: 'Provjeri poštu' })).toBeInTheDocument()
        expect(screen.getByText(/poveznica za potvrdu stiže na/)).toHaveTextContent(
            'Ako se ova adresa može koristiti, poveznica za potvrdu stiže na ana@example.com. Provjeri poštu (i neželjenu poštu). Potvrdi adresu za rangirane partije; nerangirane možeš igrati odmah.')
        expect(screen.getByRole('button', { name: 'Nastavi' })).toBeInTheDocument()
    })

    test('a reserved name in Croatian', async () => {
        setLang('hr')
        auth.signup.mockRejectedValue(new ApiError({ status: 400, message: 'That username is reserved', code: 'USERNAME_RESERVED' }))
        renderForm()
        await fillInCroatian('long-enough-1', 'long-enough-1', 'obrisan_x')
        expect(await screen.findByText('Imena koja počinju s obrisan_ rezervirana su. Odaberi drugo ime.')).toBeInTheDocument()
    })
})
