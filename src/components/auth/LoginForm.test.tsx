import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { LoginForm } from './LoginForm'
import { ApiError } from '../../services/api'
import { captureConsole } from '../../test/captureConsole'
import { setLang } from '../../i18n/lang'

const auth = vi.hoisted(() => ({ login: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ login: auth.login, isLoginLoading: false }),
}))

beforeEach(() => vi.clearAllMocks())
afterEach(() => setLang('en'))

/** Where the router is, and the state it carries. */
function Where() {
    const { pathname, state } = useLocation()
    return <p data-testid="where">{`${pathname} ${JSON.stringify(state)}`}</p>
}

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

    // With Redis down the backend answers login with a 500 (lane-email contract: show a generic "try again")
    test.each([
        ['a server error', new ApiError({ status: 500, message: 'Internal Server Error' })],
        ['no answer', new ApiError({ status: 0, message: 'Failed to fetch' })],
    ])("%s shows a generic try-again, not the browser's or Spring's text", async (_, failure) => {
        const user = userEvent.setup()
        auth.login.mockRejectedValue(failure)
        render(<MemoryRouter><LoginForm onSuccess={vi.fn()} /></MemoryRouter>)
        await user.type(screen.getByLabelText('Username'), 'ana')
        await user.type(screen.getByLabelText('Password'), 'long-enough-1')
        await user.click(screen.getByRole('button', { name: /sign in/i }))
        expect(await screen.findByText('Something went wrong. Try again.')).toBeInTheDocument()
        expect(screen.queryByText(failure.message)).not.toBeInTheDocument()
    })

    test('wrong credentials still show the server message', async () => {
        const user = userEvent.setup()
        auth.login.mockRejectedValue(new ApiError({ status: 401, message: 'Bad credentials' }))
        render(<MemoryRouter><LoginForm onSuccess={vi.fn()} /></MemoryRouter>)
        await user.type(screen.getByLabelText('Username'), 'ana')
        await user.type(screen.getByLabelText('Password'), 'long-enough-1')
        await user.click(screen.getByRole('button', { name: /sign in/i }))
        expect(await screen.findByText('Bad credentials')).toBeInTheDocument()
    })

    test('a translated "Bad credentials" (HTTP_401) reads as a wrong username or password (Ruling 16)', async () => {
        const user = userEvent.setup()
        auth.login.mockRejectedValue(new ApiError({ status: 401, message: 'Ungültige Anmeldedaten', code: 'HTTP_401' }))
        render(<MemoryRouter><LoginForm onSuccess={vi.fn()} /></MemoryRouter>)
        await user.type(screen.getByLabelText('Username'), 'ana')
        await user.type(screen.getByLabelText('Password'), 'long-enough-1')
        await user.click(screen.getByRole('button', { name: /sign in/i }))
        expect(await screen.findByText('Wrong username or password. Check both and try again.')).toBeInTheDocument()
        expect(screen.queryByText('Ungültige Anmeldedaten')).not.toBeInTheDocument()
    })

    test('wrong credentials read in Croatian on a Croatian site', async () => {
        setLang('hr')
        const user = userEvent.setup()
        auth.login.mockRejectedValue(new ApiError({ status: 401, message: 'Bad credentials', code: 'BAD_CREDENTIALS' }))
        render(<MemoryRouter><LoginForm onSuccess={vi.fn()} /></MemoryRouter>)
        // the form's own labels are still English until S3
        await user.type(screen.getByLabelText('Username'), 'ana')
        await user.type(screen.getByLabelText('Password'), 'long-enough-1')
        await user.click(screen.getByRole('button', { name: /sign in/i }))
        expect(await screen.findByText('Pogrešno korisničko ime ili lozinka. Provjeri oboje i pokušaj ponovno.')).toBeInTheDocument()
        expect(screen.queryByText('Bad credentials')).not.toBeInTheDocument()
    })

    test('links to the forgot-password page', () => {
        render(<MemoryRouter><LoginForm onSuccess={vi.fn()} /></MemoryRouter>)
        expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password')
    })

    test('"Forgot password?" carries the return path along (spec §4.1)', async () => {
        render(
            <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: '/lobby/abc' } }]}>
                <Routes>
                    <Route path="/login" element={<LoginForm onSuccess={vi.fn()} />} />
                    <Route path="/forgot-password" element={<Where />} />
                </Routes>
            </MemoryRouter>,
        )
        await userEvent.setup().click(screen.getByRole('link', { name: 'Forgot password?' }))
        expect(screen.getByTestId('where')).toHaveTextContent('/forgot-password {"from":"/lobby/abc"}')
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

    test('a sign-in writes nothing to the console (X-14)', async () => {
        const user = userEvent.setup()
        const onSuccess = vi.fn()
        auth.login.mockResolvedValue({ token: TOKEN, user: { id: 'u1', username: 'ana' }, message: null })
        const logs = captureConsole()
        render(<MemoryRouter><LoginForm onSuccess={onSuccess} /></MemoryRouter>)
        await user.type(screen.getByLabelText('Username'), 'ana')
        await user.type(screen.getByLabelText('Password'), PASSWORD)
        await user.click(screen.getByRole('button', { name: /sign in/i }))
        await waitFor(() => expect(onSuccess).toHaveBeenCalled())
        expect(logs.text()).toBe('')
    })
})
