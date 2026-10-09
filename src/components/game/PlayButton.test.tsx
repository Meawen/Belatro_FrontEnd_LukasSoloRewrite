import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlayButton } from './PlayButton'
import { useEnhancedRanked } from '../../hooks/useEnhancedRanked'
import { ApiError } from '../../services/api'

vi.mock('../../hooks/useEnhancedRanked', () => ({ useEnhancedRanked: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true }) }))
vi.mock('../../services/userService', () => ({ userService: { resendEmailConfirmation: vi.fn() } }))

function ranked(joinError: ApiError | null) {
    vi.mocked(useEnhancedRanked).mockReturnValue({
        isInQueue: false, joinQueue: vi.fn(), leaveQueue: vi.fn(), isJoining: false, isLeaving: false,
        joinError, leaveError: null, isWebSocketConnected: true, isWebSocketConnecting: false, webSocketError: null,
    } as never)
}

beforeEach(() => vi.clearAllMocks())

describe('PlayButton', () => {
    test('a ranked 403 explains what to do and offers a resend', () => {
        ranked(new ApiError({ status: 403, message: 'Verify your email to play ranked' }))
        render(<PlayButton />)
        // no promise of a mail: an address another account holds never gets a link
        expect(screen.getByText(/Verify your email to play ranked/)).toHaveTextContent(
            'Verify your email to play ranked. Open your confirmation link if you have one, or ask for a new one, then try again.')
        expect(screen.getByRole('button', { name: 'Resend confirmation email' })).toBeInTheDocument()
        expect(screen.queryByText(/^Error:/)).not.toBeInTheDocument()
    })

    // the decline cooldown (R-25): the server says how long to wait
    test('a 429 shows the server message as it is', () => {
        ranked(new ApiError({ status: 429, message: 'You declined a match; you can queue again in 97 s' }))
        render(<PlayButton />)
        expect(screen.getByText('You declined a match; you can queue again in 97 s')).toBeInTheDocument()
        expect(screen.queryByText(/^Error:/)).not.toBeInTheDocument()
    })

    test('other failures keep the generic error line', () => {
        ranked(new ApiError({ status: 500, message: 'Internal Server Error' }))
        render(<PlayButton />)
        expect(screen.getByText('Error: Internal Server Error')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Resend confirmation email' })).not.toBeInTheDocument()
    })
})
