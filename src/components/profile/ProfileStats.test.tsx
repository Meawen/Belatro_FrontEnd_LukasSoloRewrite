import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProfileStats } from './ProfileStats'
import type { User, UserDto } from '../../types/user'

const player: User = { id: 'u1', username: 'ana', eloRating: 1450, level: 3, gamesPlayed: 42 }
const me: UserDto = { id: 'u1', username: 'ana', email: 'ana@example.com', roles: ['ROLE_ADMIN'], deletionRequested: false }

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
})
