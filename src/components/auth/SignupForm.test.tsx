import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignupForm } from './SignupForm'
import { captureConsole } from '../../test/captureConsole'

const auth = vi.hoisted(() => ({ signup: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ signup: auth.signup, isSignupLoading: false }),
}))

beforeEach(() => vi.clearAllMocks())

async function fill(username: string, password: string, confirm = password) {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    render(<SignupForm onSuccess={onSuccess} />)
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
        expect(screen.getByText('Username must be 3-20 characters: letters, digits or underscore')).toBeInTheDocument()
        expect(auth.signup).not.toHaveBeenCalled()
    })

    test('a valid form sends the trimmed username', async () => {
        auth.signup.mockResolvedValue({ token: 't', user: { id: 'u1', username: 'ana' }, message: null })
        await fill('  ana  ', 'long-enough-1')
        expect(auth.signup).toHaveBeenCalledWith({ username: 'ana', email: 'ana@example.com', password: 'long-enough-1' })
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
})
