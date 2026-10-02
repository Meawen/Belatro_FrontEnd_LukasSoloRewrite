import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LoginForm } from './LoginForm'

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
})
