import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LoginForm } from './LoginForm'
import { captureConsole } from '../../test/captureConsole'

const auth = vi.hoisted(() => ({ login: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ login: auth.login, isLoginLoading: false }),
}))

beforeEach(() => vi.clearAllMocks())

describe('LoginForm', () => {
    test('sends the trimmed username (the backend matches the raw value)', async () => {
        const user = userEvent.setup()
        auth.login.mockResolvedValue({ token: 't', user: { id: 'u1', username: 'ana' }, message: null })
        render(<MemoryRouter><LoginForm onSuccess={vi.fn()} /></MemoryRouter>)
        await user.type(screen.getByLabelText('Username'), ' ana ')
        await user.type(screen.getByLabelText('Password'), 'long-enough-1')
        await user.click(screen.getByRole('button', { name: /sign in/i }))
        expect(auth.login).toHaveBeenCalledWith({ username: 'ana', password: 'long-enough-1' })
    })

    test('links to the forgot-password page', () => {
        render(<MemoryRouter><LoginForm onSuccess={vi.fn()} /></MemoryRouter>)
        expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password')
    })
})

describe('LoginForm logging', () => {
    const PASSWORD = 'Sup3r-Secret-pw!'
    const TOKEN = 'tok.en.value'

    afterEach(() => vi.restoreAllMocks())

    test('a submitted login logs neither the password nor the returned token', async () => {
        const user = userEvent.setup()
        const onSuccess = vi.fn()
        auth.login.mockResolvedValue({ token: TOKEN, user: { id: 'u1', username: 'ana' }, message: null })
        const logs = captureConsole()
        render(<MemoryRouter><LoginForm onSuccess={onSuccess} /></MemoryRouter>)
        await user.type(screen.getByLabelText('Username'), 'ana')
        await user.type(screen.getByLabelText('Password'), PASSWORD)
        await user.click(screen.getByRole('button', { name: /sign in/i }))
        await waitFor(() => expect(onSuccess).toHaveBeenCalled())
        expect(logs.leaked(PASSWORD, TOKEN)).toEqual([])
    })

    test('a login refused by validation logs no password', async () => {
        const user = userEvent.setup()
        const logs = captureConsole()
        render(<MemoryRouter><LoginForm onSuccess={vi.fn()} /></MemoryRouter>)
        await user.type(screen.getByLabelText('Password'), PASSWORD)
        await user.click(screen.getByRole('button', { name: /sign in/i }))
        expect(screen.getByText('Username is required')).toBeInTheDocument()
        expect(auth.login).not.toHaveBeenCalled()
        expect(logs.leaked(PASSWORD)).toEqual([])
    })
})
