import { describe, test, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ForgotPasswordPage } from './ForgotPasswordPage'
import { authService } from '../../services/authService'
import { ApiError } from '../../services/api'

vi.mock('../../services/authService', () => ({ authService: { forgotPassword: vi.fn() } }))

function renderPage() {
    render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>)
}

const SENT = /If that address has an account, we sent a link/

beforeEach(() => vi.clearAllMocks())

describe('ForgotPasswordPage', () => {
    test('sends the address and answers the same way whether or not it has an account', async () => {
        const user = userEvent.setup()
        vi.mocked(authService.forgotPassword).mockResolvedValue(undefined)
        renderPage()
        await user.type(screen.getByLabelText('Email'), ' ana@example.com ')
        await user.click(screen.getByRole('button', { name: 'Send reset link' }))
        expect(authService.forgotPassword).toHaveBeenCalledWith('ana@example.com')
        expect(await screen.findByText(/If that address has an account, we sent a link/)).toBeInTheDocument()
    })

    test('two submits that land before a re-render send one request', async () => {
        const user = userEvent.setup()
        vi.mocked(authService.forgotPassword).mockReturnValue(new Promise(() => {}))
        renderPage()
        await user.type(screen.getByLabelText('Email'), 'ana@example.com')
        const button = screen.getByRole('button', { name: 'Send reset link' })
        // both clicks land before React re-renders the button as disabled
        act(() => {
            button.click()
            button.click()
        })
        expect(authService.forgotPassword).toHaveBeenCalledTimes(1)
    })

    test('after a failed request the form can be sent again', async () => {
        const user = userEvent.setup()
        vi.mocked(authService.forgotPassword).mockRejectedValueOnce(new ApiError({ status: 500, message: 'Internal Server Error' }))
        renderPage()
        await user.type(screen.getByLabelText('Email'), 'ana@example.com')
        await user.click(screen.getByRole('button', { name: 'Send reset link' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Try again.')
        vi.mocked(authService.forgotPassword).mockResolvedValue(undefined)
        await user.click(screen.getByRole('button', { name: 'Send reset link' }))
        expect(authService.forgotPassword).toHaveBeenCalledTimes(2)
        expect(await screen.findByText(SENT)).toBeInTheDocument()
    })

    test('a malformed address is caught before sending', async () => {
        const user = userEvent.setup()
        renderPage()
        await user.type(screen.getByLabelText('Email'), 'not-an-address')
        await user.click(screen.getByRole('button', { name: 'Send reset link' }))
        expect(screen.getByRole('alert')).toHaveTextContent('Email is invalid')
        expect(authService.forgotPassword).not.toHaveBeenCalled()
    })

    test('a rate limit shows the server message', async () => {
        const user = userEvent.setup()
        vi.mocked(authService.forgotPassword).mockRejectedValue(new ApiError({ status: 429, message: 'Too many requests, try again later' }))
        renderPage()
        await user.type(screen.getByLabelText('Email'), 'ana@example.com')
        await user.click(screen.getByRole('button', { name: 'Send reset link' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests, try again later')
        expect(screen.getByText('Wait a while, then try again.')).toBeInTheDocument()
        expect(screen.queryByText(SENT)).not.toBeInTheDocument()
    })

    test('an address the server refuses shows its field error and keeps the form usable', async () => {
        const user = userEvent.setup()
        // the 400 field map {"email":"must be a well-formed email address"}
        vi.mocked(authService.forgotPassword).mockRejectedValue(new ApiError({ status: 400, message: 'must be a well-formed email address' }))
        renderPage()
        await user.type(screen.getByLabelText('Email'), 'ana@@example.com')
        await user.click(screen.getByRole('button', { name: 'Send reset link' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('must be a well-formed email address')
        expect(screen.queryByText(SENT)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Send reset link' })).toBeEnabled()
    })

    test.each([
        [0, 'Failed to fetch'],
        [500, 'Internal Server Error'],
    ])('a failure with no usable answer (status %i) asks to try again', async (status, raw) => {
        const user = userEvent.setup()
        vi.mocked(authService.forgotPassword).mockRejectedValue(new ApiError({ status, message: raw }))
        renderPage()
        await user.type(screen.getByLabelText('Email'), 'ana@example.com')
        await user.click(screen.getByRole('button', { name: 'Send reset link' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Try again.')
        expect(screen.queryByText(raw)).not.toBeInTheDocument()
        expect(screen.queryByText(SENT)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Send reset link' })).toBeEnabled()
    })
})
