import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GoogleSection } from './GoogleSection'
import { userService } from '../../services/userService'
import { ApiError } from '../../services/api'
import { setLang } from '../../i18n/lang'
import { captureConsole } from '../../test/captureConsole'
import { CLIENT_ID, dropGoogleScripts, gsiScripts, stubGoogle, tokenFor } from '../../test/googleStub'

vi.mock('../../services/userService', () => ({ userService: { connectGoogle: vi.fn(), disconnectGoogle: vi.fn() } }))

const CREDENTIAL = tokenFor('ana@gmail.com')
const PASSWORD = 'long-enough-1'
const HINT = 'Type your current password, then choose your Google account.'
const REQUIRED = 'Current password is required'
const WRONG = 'Current password is incorrect'
const TAKEN = 'This Google account is connected to another Stiglja account. Sign in to that account, or use another Google account.'
const UNAVAILABLE = "Google sign-in isn't available right now. Try again later."
const GENERIC = 'Something went wrong. Try again.'
const CONNECTED_NOTICE = 'Google is connected. You can now sign in with Google or with your password.'
const ONLY_WAY_IN = 'Google is your only way to sign in, so it stays connected until you set a password.'

const refusal = (status: number, code?: string, message = 'refused') => new ApiError({ status, message, code })
const onChanged = vi.fn()

function renderSection({ connected = false, passwordless = false } = {}) {
    return render(<GoogleSection connected={connected} passwordless={passwordless} onChanged={onChanged} />)
}

const passwordField = () => screen.getByLabelText('Current password')
const connectButton = () => screen.getByRole('button', { name: 'Connect Google' })
/** Focus moves in an effect once the answer is drawn, so the test waits for document.activeElement to get there. */
const focusMovesTo = (target: () => Element) => waitFor(() => expect(document.activeElement).toBe(target()))

/** Not connected, with Connect Google tapped and Google's button drawn; the password typed when given. */
async function openForm(password?: string) {
    const user = userEvent.setup()
    const google = stubGoogle()
    renderSection()
    await user.click(connectButton())
    await screen.findByTestId('google-button')
    if (password) await user.type(passwordField(), password)
    return { user, google }
}

beforeEach(() => {
    // reset, not clear: an answer queued with mockResolvedValueOnce that a failing test never used must not reach the next
    vi.resetAllMocks()
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', CLIENT_ID)
})

afterEach(() => {
    cleanup()
    dropGoogleScripts()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    setLang('en')
})

describe('Settings, Google sign-in: not connected (Google sign-in spec §5.1, A-1)', () => {
    test("the status, what it is for and Connect Google; Google's script loads only after the tap", async () => {
        const user = userEvent.setup()
        renderSection()
        expect(screen.getByRole('heading', { level: 3, name: 'Google sign-in' })).toBeInTheDocument()
        expect(screen.getByText('Google: not connected')).toBeInTheDocument()
        expect(screen.getByText('Connect your Google account to sign in with one tap.')).toBeInTheDocument()
        expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument()
        expect(gsiScripts()).toHaveLength(0)

        stubGoogle()
        await user.click(connectButton())
        // the button went, so focus goes where the next step starts
        await focusMovesTo(passwordField)
        expect(passwordField()).toHaveAttribute('type', 'password')
        expect(passwordField()).toHaveAccessibleDescription(HINT)
        expect(await screen.findByTestId('google-button')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Connect Google' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })

    test('Cancel closes the form and clears the password and the lines; focus goes back to Connect Google', async () => {
        vi.mocked(userService.connectGoogle).mockRejectedValue(refusal(409, 'GOOGLE_TAKEN'))
        const { user, google } = await openForm(PASSWORD)
        await google.answer()
        expect(await screen.findByRole('alert')).toHaveTextContent(TAKEN)

        await user.click(screen.getByRole('button', { name: 'Cancel' }))
        expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument()
        expect(screen.queryByTestId('google-button')).not.toBeInTheDocument()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        await focusMovesTo(connectButton)

        await user.click(connectButton())
        expect(passwordField()).toHaveValue('')
        expect(passwordField()).toHaveAccessibleDescription(HINT)
    })

    test('connect sends the credential and the typed password once; a 204 shows the notice, connected, and refreshes', async () => {
        vi.mocked(userService.connectGoogle).mockResolvedValue(undefined)
        const { google } = await openForm(PASSWORD)
        await google.answer()
        expect(userService.connectGoogle).toHaveBeenCalledTimes(1)
        expect(userService.connectGoogle).toHaveBeenCalledWith({ credential: CREDENTIAL, currentPassword: PASSWORD })
        expect(onChanged).toHaveBeenCalledTimes(1)
        // the form went: focus to the line that says what happened
        await focusMovesTo(() => screen.getByRole('status'))
        expect(screen.getByRole('status')).toHaveTextContent(CONNECTED_NOTICE)
        expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument()
        // connected already, before GET /user/me says so (or if the refresh fails)
        expect(screen.getByText('Google: connected')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Disconnect Google' })).toBeInTheDocument()
        // never a Google address: Stiglja keeps none (spec §3.1)
        expect(document.body).not.toHaveTextContent('ana@gmail.com')
    })

    test('Google answering with the field blank sends nothing and asks for the password under the field', async () => {
        vi.mocked(userService.connectGoogle).mockResolvedValue(undefined)
        const { user, google } = await openForm()
        // focus is elsewhere, as after a tap on Google's button
        focusAway()
        await google.answer()
        expect(userService.connectGoogle).not.toHaveBeenCalled()
        expect(passwordField()).toHaveAccessibleDescription(REQUIRED)
        expect(passwordField()).toBeInvalid()
        await focusMovesTo(passwordField)
        // a second blank answer: the same line, and focus comes back to it again
        focusAway()
        await google.answer()
        expect(userService.connectGoogle).not.toHaveBeenCalled()
        await focusMovesTo(passwordField)

        await user.type(passwordField(), PASSWORD)
        expect(passwordField()).toHaveAccessibleDescription(HINT)
        await google.answer()
        expect(userService.connectGoogle).toHaveBeenCalledWith({ credential: CREDENTIAL, currentPassword: PASSWORD })
    })

    test('a wrong password: its line under the field until the next keystroke, the password kept, and the next answer sends', async () => {
        vi.mocked(userService.connectGoogle).mockRejectedValueOnce(refusal(401, 'WRONG_PASSWORD', WRONG)).mockResolvedValueOnce(undefined)
        const { user, google } = await openForm(PASSWORD)
        // the field still has focus from typing: it is left and taken again, so its new description is read
        const blurred = vi.fn()
        passwordField().addEventListener('blur', blurred)
        await google.answer()
        expect(passwordField()).toHaveAccessibleDescription(WRONG)
        expect(passwordField()).toBeInvalid()
        expect(passwordField()).toHaveValue(PASSWORD)
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        await focusMovesTo(passwordField)
        expect(blurred).toHaveBeenCalled()
        expect(onChanged).not.toHaveBeenCalled()
        expect(screen.getByTestId('google-button')).toBeInTheDocument()

        await user.type(passwordField(), '2')
        expect(passwordField()).toHaveAccessibleDescription(HINT)
        await google.answer()
        expect(userService.connectGoogle).toHaveBeenCalledTimes(2)
        expect(userService.connectGoogle).toHaveBeenLastCalledWith({ credential: CREDENTIAL, currentPassword: `${PASSWORD}2` })
        expect(await screen.findByRole('status')).toHaveTextContent(CONNECTED_NOTICE)
    })

    test("GOOGLE_TAKEN: its line under Google's button, which stays; the password kept, and another account can be picked", async () => {
        vi.mocked(userService.connectGoogle).mockRejectedValueOnce(refusal(409, 'GOOGLE_TAKEN')).mockResolvedValueOnce(undefined)
        const { google } = await openForm(PASSWORD)
        await google.answer()
        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent(TAKEN)
        await focusMovesTo(() => screen.getByRole('alert'))
        const button = screen.getByTestId('google-button')
        expect(button.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        // S1 A-6: not drawn again
        expect(google.renderButton).toHaveBeenCalledTimes(1)
        expect(passwordField()).toHaveValue(PASSWORD)
        expect(passwordField()).toHaveAccessibleDescription(HINT)
        expect(onChanged).not.toHaveBeenCalled()

        const other = tokenFor('ana.other@gmail.com')
        await google.answer(other)
        expect(userService.connectGoogle).toHaveBeenLastCalledWith({ credential: other, currentPassword: PASSWORD })
        expect(await screen.findByRole('status')).toHaveTextContent(CONNECTED_NOTICE)
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    test("the other answers show under Google's button: GOOGLE_INVALID, 429, Google off (404), 5xx and no answer", async () => {
        const cases: [ApiError, string][] = [
            [refusal(401, 'GOOGLE_INVALID', 'Google sign-in failed, please try again'), "Google sign-in didn't go through. Try Google again."],
            [refusal(429, 'RATE_LIMITED', 'Too many requests, try again later'), 'Too many tries. Wait a little, then try again.'],
            // Spring's body, no code: never "Not Found"
            [refusal(404, undefined, 'Not Found'), UNAVAILABLE],
            [refusal(500, undefined, 'Internal Server Error'), GENERIC],
            [refusal(0, undefined, 'Failed to fetch'), GENERIC],
        ]
        for (const [error, line] of cases) {
            vi.mocked(userService.connectGoogle).mockRejectedValueOnce(error)
            const { google } = await openForm(PASSWORD)
            await google.answer()
            expect(await screen.findByRole('alert'), line).toHaveTextContent(line)
            expect(passwordField()).toHaveValue(PASSWORD)
            expect(passwordField()).toHaveAccessibleDescription(HINT)
            expect(screen.getByTestId('google-button')).toBeInTheDocument()
            cleanup()
            dropGoogleScripts()
        }
        expect(onChanged).not.toHaveBeenCalled()
    })

    test('one answer at a time; the field and Cancel wait while it is sent', async () => {
        let done = () => {}
        vi.mocked(userService.connectGoogle).mockImplementation(() => new Promise<void>((resolve) => { done = resolve }))
        const { google } = await openForm(PASSWORD)
        await google.answer()
        await google.answer()
        expect(userService.connectGoogle).toHaveBeenCalledTimes(1)
        expect(passwordField()).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
        await act(async () => { done() })
        expect(await screen.findByRole('status')).toHaveTextContent(CONNECTED_NOTICE)
        expect(onChanged).toHaveBeenCalledTimes(1)
    })

    test("a blocked script shows Settings' own line with Try again, not the sign-in page's", async () => {
        const user = userEvent.setup()
        renderSection()
        await user.click(connectButton())
        await waitFor(() => expect(gsiScripts()).toHaveLength(1))
        act(() => { gsiScripts()[0].dispatchEvent(new Event('error')) })
        expect(await screen.findByRole('alert')).toHaveTextContent("Google sign-in didn't open. Try again.")
        expect(screen.getByRole('alert')).not.toHaveTextContent('name and password')
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
        // the field is still there for when the script comes
        expect(passwordField()).toBeInTheDocument()
    })

    test('in Croatian', async () => {
        setLang('hr')
        vi.mocked(userService.connectGoogle).mockRejectedValue(refusal(401, 'WRONG_PASSWORD', WRONG))
        const user = userEvent.setup()
        const google = stubGoogle()
        renderSection()
        expect(screen.getByRole('heading', { level: 3, name: 'Prijava putem Googlea' })).toBeInTheDocument()
        expect(screen.getByText('Google: nije povezan')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Poveži Google' }))
        await user.type(screen.getByLabelText('Trenutna lozinka'), PASSWORD)
        await google.answer()
        expect(screen.getByLabelText('Trenutna lozinka')).toHaveAccessibleDescription('Trenutna lozinka nije točna. Upiši je ponovno.')
    })

    test('nothing logged carries the credential or the password', async () => {
        const logs = captureConsole()
        vi.mocked(userService.connectGoogle).mockRejectedValueOnce(refusal(409, 'GOOGLE_TAKEN')).mockResolvedValueOnce(undefined)
        const { google } = await openForm(PASSWORD)
        await google.answer()
        await google.answer()
        expect(await screen.findByRole('status')).toHaveTextContent(CONNECTED_NOTICE)
        expect(logs.leaked(CREDENTIAL, PASSWORD)).toEqual([])
    })
})

describe('Settings, Google sign-in: connected, with a password (spec §5.2, A-5)', () => {
    const disconnectButton = () => screen.getByRole('button', { name: 'Disconnect Google' })
    const QUESTION = 'Disconnect Google? You will sign in with your username and password only.'

    test("Google: connected and Disconnect Google; no field, no Google button, no script", () => {
        renderSection({ connected: true })
        expect(screen.getByRole('heading', { level: 3, name: 'Google sign-in' })).toBeInTheDocument()
        expect(screen.getByText('Google: connected')).toBeInTheDocument()
        expect(disconnectButton()).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Connect Google' })).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument()
        expect(gsiScripts()).toHaveLength(0)
    })

    test("Disconnect Google carries Connect Google's mark, as decoration: its name stays the words", () => {
        const { rerender } = renderSection({ connected: true })
        expect(disconnectButton()).toHaveAccessibleName('Disconnect Google')
        const mark = disconnectButton().querySelector('svg')
        expect(mark).toHaveAttribute('aria-hidden', 'true')
        rerender(<GoogleSection connected={false} passwordless={false} onChanged={onChanged} />)
        expect(mark?.outerHTML).toBe(connectButton().querySelector('svg')?.outerHTML)
    })

    test('Disconnect asks first; Keep Google sends nothing and gives focus back', async () => {
        const user = userEvent.setup()
        renderSection({ connected: true })
        await user.click(disconnectButton())
        await focusMovesTo(() => screen.getByText(QUESTION))
        expect(screen.getByRole('button', { name: 'Keep Google' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Keep Google' }))
        expect(screen.queryByText(QUESTION)).not.toBeInTheDocument()
        expect(userService.disconnectGoogle).not.toHaveBeenCalled()
        await focusMovesTo(disconnectButton)
    })

    test('Disconnect sends once, then the notice, not connected, and a refresh', async () => {
        const user = userEvent.setup()
        vi.mocked(userService.disconnectGoogle).mockResolvedValue(undefined)
        renderSection({ connected: true })
        await user.click(disconnectButton())
        await user.click(screen.getByRole('button', { name: 'Disconnect' }))
        expect(userService.disconnectGoogle).toHaveBeenCalledTimes(1)
        expect(onChanged).toHaveBeenCalledTimes(1)
        await focusMovesTo(() => screen.getByRole('status'))
        expect(screen.getByRole('status')).toHaveTextContent('Google is disconnected.')
        expect(screen.getByText('Google: not connected')).toBeInTheDocument()
        expect(connectButton()).toBeInTheDocument()
    })

    test('NO_PASSWORD (a stale page): its line, a refresh, and the line stays once the page shows why', async () => {
        const user = userEvent.setup()
        vi.mocked(userService.disconnectGoogle).mockRejectedValue(refusal(409, 'NO_PASSWORD', 'Set a password first'))
        const { rerender } = renderSection({ connected: true })
        await user.click(disconnectButton())
        await user.click(screen.getByRole('button', { name: 'Disconnect' }))
        const line = 'Set a password first. Until then, Google is your only way to sign in, so it stays connected.'
        expect(await screen.findByRole('alert')).toHaveTextContent(line)
        await focusMovesTo(() => screen.getByRole('alert'))
        expect(onChanged).toHaveBeenCalledTimes(1)
        // what the refreshed GET /user/me says
        rerender(<GoogleSection connected passwordless onChanged={onChanged} />)
        expect(screen.getByText(ONLY_WAY_IN)).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent(line)
        expect(document.activeElement).toBe(screen.getByRole('alert'))
    })

    test('Google off (404) or no answer keeps the confirm open to try again', async () => {
        const user = userEvent.setup()
        vi.mocked(userService.disconnectGoogle)
            .mockRejectedValueOnce(refusal(404, undefined, 'Not Found'))
            .mockRejectedValueOnce(refusal(0, undefined, 'Failed to fetch'))
            .mockResolvedValueOnce(undefined)
        renderSection({ connected: true })
        await user.click(disconnectButton())
        await user.click(screen.getByRole('button', { name: 'Disconnect' }))
        expect(await screen.findByRole('alert')).toHaveTextContent(UNAVAILABLE)
        await focusMovesTo(() => screen.getByRole('alert'))
        await user.click(screen.getByRole('button', { name: 'Disconnect' }))
        expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC)
        expect(onChanged).not.toHaveBeenCalled()
        await user.click(screen.getByRole('button', { name: 'Disconnect' }))
        expect(await screen.findByRole('status')).toHaveTextContent('Google is disconnected.')
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
})

describe('Settings, Google sign-in: connected and passwordless (spec §5.2, A-9)', () => {
    test('says why Google stays connected; no Disconnect, no Google button', () => {
        renderSection({ connected: true, passwordless: true })
        expect(screen.getByText('Google: connected')).toBeInTheDocument()
        expect(screen.getByText(ONLY_WAY_IN)).toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
        expect(screen.queryByTestId('google-button')).not.toBeInTheDocument()
    })
})

describe('Settings, Google sign-in: no client id (spec §2, A-8)', () => {
    test('nothing at all in any state, and no script', () => {
        for (const raw of [undefined, '', '  ']) {
            vi.stubEnv('VITE_GOOGLE_CLIENT_ID', raw)
            for (const state of [{}, { connected: true }, { connected: true, passwordless: true }]) {
                const { container } = renderSection(state)
                expect(container, `${String(raw)} ${JSON.stringify(state)}`).toBeEmptyDOMElement()
                cleanup()
            }
        }
        expect(gsiScripts()).toHaveLength(0)
    })
})

/** Focus leaves the page's controls, as when Google's own button (its iframe) was tapped. */
function focusAway() {
    act(() => { (document.activeElement as HTMLElement | null)?.blur() })
}
