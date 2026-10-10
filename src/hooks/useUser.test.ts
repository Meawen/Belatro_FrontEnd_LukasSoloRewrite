import { describe, test, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { userService } from '../services/userService'
import { useMe, useUsersPage } from './useUser'
import type { UserDto } from '../types/user'

const me: UserDto = { id: 'u1', username: 'ana', email: 'ana@example.com', roles: ['ROLE_ADMIN'], deletionRequested: false }

afterEach(() => vi.restoreAllMocks())

describe('useMe', () => {
    test('returns no data once disabled, even after fetching while enabled', async () => {
        const getMe = vi.spyOn(userService, 'getMe').mockResolvedValue(me)
        const { result, rerender } = renderHook(({ on }) => useMe(on), { initialProps: { on: true } })
        await waitFor(() => expect(result.current.data).toEqual(me))
        expect(getMe).toHaveBeenCalledTimes(1)

        rerender({ on: false })

        expect(result.current.data).toBeNull()
    })
})

// spec §4.12: the leaderboard is ranked by the server (§6.2), never re-sorted on the client
describe('useUsersPage', () => {
    test('asks the server for one page of 20 in the Elo order (sort=elo), with the search term', async () => {
        const getUsersPage = vi.spyOn(userService, 'getUsersPage').mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 2, size: 20 })
        renderHook(() => useUsersPage(2, 'bo'))
        await waitFor(() => expect(getUsersPage).toHaveBeenCalledWith({ page: 2, size: 20, q: 'bo', sort: 'elo' }))
    })
})
