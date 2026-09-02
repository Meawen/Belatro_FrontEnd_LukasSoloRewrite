import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiClient, ApiError } from './api'

function fakeResponse(status: number, body: unknown) {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: `status-${status}`,
        headers: { get: () => null },
        json: () => Promise.resolve(body),
    } as unknown as Response
}

describe('apiClient error handling', () => {
    let mockStorage: Record<string, string> = {}

    beforeEach(() => {
        mockStorage = { authToken: 'tok-123' }
        vi.stubGlobal('localStorage', {
            setItem: (key: string, value: string) => { mockStorage[key] = value },
            getItem: (key: string) => mockStorage[key] || null,
            removeItem: (key: string) => { delete mockStorage[key] },
            clear: () => { mockStorage = {} },
            length: 0,
            key: () => null,
        })
    })
    afterEach(() => { vi.unstubAllGlobals() })

    test('surfaces the backend {"error"} body as the ApiError message', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(409, { error: 'Username or email is already taken' })))
        await expect(apiClient.get('/x')).rejects.toMatchObject({
            name: 'ApiError', status: 409, message: 'Username or email is already taken',
        })
    })

    test('prefers "message" over "error" when both exist', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(400, { message: 'from-message', error: 'from-error' })))
        await expect(apiClient.get('/x')).rejects.toMatchObject({ message: 'from-message' })
    })

    test('401 clears the token by default', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(401, { error: 'nope' })))
        await expect(apiClient.get('/x')).rejects.toBeInstanceOf(ApiError)
        expect(localStorage.getItem('authToken')).toBeNull()
    })

    test('401 keeps the token when keepTokenOn401 is set', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(401, { error: 'Invalid current password' })))
        await expect(apiClient.post('/user/me/password', { a: 1 }, { keepTokenOn401: true }))
            .rejects.toMatchObject({ status: 401, message: 'Invalid current password' })
        expect(localStorage.getItem('authToken')).toBe('tok-123')
    })
})
