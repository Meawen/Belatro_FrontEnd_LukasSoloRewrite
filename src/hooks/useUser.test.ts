import { describe, test, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { userService } from '../services/userService'
import { useMe } from './useUser'
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
