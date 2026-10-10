import { describe, test, expect, vi, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { adminService } from '../services/adminService'
import { ApiError } from '../services/api'
import { useAdmin } from './useAdmin'
import type { UserDto } from '../types/user'

const ana: UserDto = { id: 'u1', username: 'ana', email: 'ana@example.com', roles: ['ROLE_ADMIN'], deletionRequested: false }
const bob: UserDto = { id: 'u2', username: 'bob', email: 'bob@example.com', roles: ['ROLE_USER'], deletionRequested: true }

afterEach(() => vi.restoreAllMocks())

// spec §8 (Admin), X-7: a failed delete shows its error; a delete that happened never does
describe('useAdmin().forgetUser', () => {
    test('a delete that went through resolves, even when the list refresh after it fails', async () => {
        const listUsers = vi.spyOn(adminService, 'listUsers')
            .mockResolvedValueOnce([ana, bob])
            .mockRejectedValueOnce(new ApiError({ status: 503, message: 'Service unavailable' }))
        const forget = vi.spyOn(adminService, 'forgetUser').mockResolvedValue(undefined as never)
        const { result } = renderHook(() => useAdmin())
        await waitFor(() => expect(result.current.users).toHaveLength(2))

        let outcome: Promise<unknown> = Promise.resolve()
        await act(async () => {
            outcome = result.current.forgetUser('u2')
            await outcome.catch(() => {})
        })

        await expect(outcome).resolves.toBeUndefined()
        expect(forget).toHaveBeenCalledWith('u2')
        expect(listUsers).toHaveBeenCalledTimes(2)
        // the refresh's failure is the list's own error, as for any failed load
        expect(result.current.error?.status).toBe(503)
    })

    test('a delete the server refuses still rejects with its error, and the list is not reloaded', async () => {
        const listUsers = vi.spyOn(adminService, 'listUsers').mockResolvedValue([ana, bob])
        vi.spyOn(adminService, 'forgetUser').mockRejectedValue(new ApiError({ status: 404, message: 'User not found with id u2' }))
        const { result } = renderHook(() => useAdmin())
        await waitFor(() => expect(result.current.users).toHaveLength(2))

        let outcome: Promise<unknown> = Promise.resolve()
        await act(async () => {
            outcome = result.current.forgetUser('u2')
            await outcome.catch(() => {})
        })

        await expect(outcome).rejects.toMatchObject({ status: 404, message: 'User not found with id u2' })
        expect(listUsers).toHaveBeenCalledTimes(1)
    })
})
