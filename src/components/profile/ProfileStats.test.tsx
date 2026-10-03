import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProfileStats } from './ProfileStats'
import type { User, UserDto } from '../../types/user'

const player: User = { id: 'u1', username: 'ana', eloRating: 1450, level: 3, gamesPlayed: 42 }
const me: UserDto = { id: 'u1', username: 'ana', email: 'ana@example.com', pendingEmail: null, emailVerified: true, roles: ['ROLE_ADMIN'], deletionRequested: false }

describe('ProfileStats', () => {
    test("someone else's profile shows stats but no email or roles", () => {
        render(<ProfileStats user={player} />)
        expect(screen.getByText('ana')).toBeInTheDocument()
        expect(screen.getByText('1450')).toBeInTheDocument()
        expect(screen.queryByText('Email:')).not.toBeInTheDocument()
        expect(screen.queryByText('Roles:')).not.toBeInTheDocument()
    })

    test('own profile shows email and roles from /user/me', () => {
        render(<ProfileStats user={player} me={me} />)
        expect(screen.getByText('Email:')).toBeInTheDocument()
        expect(screen.getByText('ana@example.com')).toBeInTheDocument()
        expect(screen.getByText('ADMIN')).toBeInTheDocument()
    })

    test('no experience-points tile: the API no longer serves expPoints', () => {
        render(<ProfileStats user={player} me={me} />)
        expect(screen.queryByText('Experience Points')).not.toBeInTheDocument()
        expect(screen.queryByText('Experience Progress')).not.toBeInTheDocument()
    })

    test('a pending address waits for confirmation and offers the resend action', () => {
        render(<ProfileStats user={player} me={{ ...me, pendingEmail: 'new@example.com' }} confirmAction={<button>Resend confirmation email</button>} />)
        expect(screen.getByTestId('pending-email')).toHaveTextContent('Waiting for confirmation: new@example.com')
        expect(screen.getByRole('button', { name: 'Resend confirmation email' })).toBeInTheDocument()
    })

    test('a legacy unconfirmed address is marked and can be confirmed', () => {
        render(<ProfileStats user={player} me={{ ...me, emailVerified: false }} confirmAction={<button>Resend confirmation email</button>} />)
        expect(screen.getByText('(not confirmed)')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Resend confirmation email' })).toBeInTheDocument()
    })

    test('a confirmed address with nothing pending offers no resend', () => {
        render(<ProfileStats user={player} me={me} confirmAction={<button>Resend confirmation email</button>} />)
        expect(screen.queryByRole('button', { name: 'Resend confirmation email' })).not.toBeInTheDocument()
    })

    test('an account without any address offers no resend', () => {
        render(<ProfileStats user={player} me={{ ...me, email: null, emailVerified: false }} confirmAction={<button>Resend confirmation email</button>} />)
        expect(screen.getByText('Not set')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Resend confirmation email' })).not.toBeInTheDocument()
    })
})
