import { describe, test, expect, vi, afterEach } from 'vitest'
import { apiClient } from './api'
import { userService } from './userService'

afterEach(() => vi.restoreAllMocks())

describe('userService hardened contract', () => {
    test('getMe calls GET /user/me', async () => {
        const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ id: '1' })
        await userService.getMe()
        expect(get).toHaveBeenCalledWith('/user/me')
    })

    test('changePassword posts to /user/me/password and keeps the token on 401', async () => {
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
        await userService.changePassword({ currentPassword: 'old', newPassword: 'newpass' })
        expect(post).toHaveBeenCalledWith(
            '/user/me/password',
            { currentPassword: 'old', newPassword: 'newpass' },
            { keepTokenOn401: true },
        )
    })

    test('requestForget posts to /user/me/request-forget with no id', async () => {
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
        await userService.requestForget()
        expect(post).toHaveBeenCalledWith('/user/me/request-forget')
    })

    test('the removed write endpoints are gone from the service', () => {
        expect((userService as Record<string, unknown>).updateUser).toBeUndefined()
        expect((userService as Record<string, unknown>).deleteUser).toBeUndefined()
    })
})
