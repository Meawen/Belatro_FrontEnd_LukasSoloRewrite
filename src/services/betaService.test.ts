import { describe, test, expect, vi, afterEach } from 'vitest'
import { apiClient } from './api'
import { betaService } from './betaService'

afterEach(() => vi.restoreAllMocks())

describe('betaService (open beta §2, B7)', () => {
    test('each beta route: its method, path and body (B7)', async () => {
        const get = vi.spyOn(apiClient, 'get').mockResolvedValue({})
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue(undefined)
        const put = vi.spyOn(apiClient, 'put').mockResolvedValue({})

        await betaService.signupStatus()
        expect(get).toHaveBeenLastCalledWith('/api/auth/signup-status')

        await betaService.joinWaitlist('ana@example.com', 'hr')
        expect(post).toHaveBeenLastCalledWith('/api/auth/waitlist', { email: 'ana@example.com', language: 'hr' })

        await betaService.confirmWaitlist('tok-w')
        expect(post).toHaveBeenLastCalledWith('/api/auth/waitlist/confirm', { token: 'tok-w' })

        await betaService.getBeta()
        expect(get).toHaveBeenLastCalledWith('/admin/beta')

        await betaService.setCap(5)
        expect(put).toHaveBeenLastCalledWith('/admin/beta/cap', { cap: 5 })
        await betaService.setCap(null)
        expect(put).toHaveBeenLastCalledWith('/admin/beta/cap', { cap: null })

        expect(get).toHaveBeenCalledTimes(2)
        expect(post).toHaveBeenCalledTimes(2)
        expect(put).toHaveBeenCalledTimes(2)
    })
})
