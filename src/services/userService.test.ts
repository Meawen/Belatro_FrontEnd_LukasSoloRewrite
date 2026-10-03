import { describe, test, expect, vi, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'
import { apiClient, ApiError } from './api'
import { userService } from './userService'
import { gameSocket, type StompClientHandlers } from './gameSocket'

// The real socket module on fake STOMP clients, so a 1008 meets the real close handling
const sockets = vi.hoisted(() => ({
    clients: [] as { token: string; handlers: StompClientHandlers }[],
    endSession: vi.fn(),
}))
vi.mock('./gameSocket', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./gameSocket')>()
    return {
        ...actual,
        gameSocket: actual.createGameSocket(
            (token, handlers) => {
                sockets.clients.push({ token, handlers })
                return { activate() {}, deactivate() {}, publish() {}, subscribe: () => ({ id: 'sub', unsubscribe() {} }) }
            },
            undefined, // the token in storage, as in the app
            sockets.endSession,
        ),
    }
})

// Node 26's own localStorage global is unusable here; borrow jsdom's (see api.test.ts)
const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

afterEach(() => vi.restoreAllMocks())

describe('userService hardened contract', () => {
    test('getMe calls GET /user/me', async () => {
        const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ id: '1' })
        await userService.getMe()
        expect(get).toHaveBeenCalledWith('/user/me')
    })

    test('changePassword posts to /user/me/password and keeps the token on a wrong-password 401', async () => {
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
        await userService.changePassword({ currentPassword: 'old', newPassword: 'newpass1' })
        expect(post).toHaveBeenCalledWith(
            '/user/me/password',
            { currentPassword: 'old', newPassword: 'newpass1' },
            { keepTokenOn401: true },
        )
    })

    test('changePassword stores the rotated token and reopens the socket with it', async () => {
        vi.spyOn(apiClient, 'post').mockResolvedValue({ token: 'new-token', user: { id: 'u1', username: 'ana' } })
        const setToken = vi.spyOn(apiClient, 'setToken').mockImplementation(() => undefined)
        const reconnect = vi.spyOn(gameSocket, 'reconnect')
        await userService.changePassword({ currentPassword: 'old', newPassword: 'newpass1' })
        expect(setToken).toHaveBeenCalledWith('new-token')
        expect(reconnect).toHaveBeenCalledTimes(1)
    })

    test('changeEmail posts the new address and keeps the token on a wrong-password 401', async () => {
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
        await userService.changeEmail({ newEmail: 'new@example.com', currentPassword: 'old' })
        expect(post).toHaveBeenCalledWith('/user/me/email', { newEmail: 'new@example.com', currentPassword: 'old' }, { keepTokenOn401: true })
    })

    test('resendEmailConfirmation posts to /user/me/email/resend', async () => {
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
        await userService.resendEmailConfirmation()
        expect(post).toHaveBeenCalledWith('/user/me/email/resend')
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

// The server closes the user's sockets with 1008 at its first session bump, before the
// 200 with the new token arrives.
describe('changePassword and the game socket', () => {
    function openSocket(token: string) {
        vi.useFakeTimers()
        vi.stubGlobal('localStorage', jsdomStorage)
        jsdomStorage.setItem('authToken', token)
        sockets.endSession.mockClear()
        const release = gameSocket.acquire()
        const socket = sockets.clients[sockets.clients.length - 1]
        socket.handlers.onConnect()
        return {
            socket,
            done: () => {
                release()
                vi.advanceTimersByTime(1000) // the grace period: the socket closes
                vi.useRealTimers()
                vi.unstubAllGlobals()
                jsdomStorage.clear()
            },
        }
    }

    test('a 1008 while the change is in flight keeps the session and reconnects with the new token', async () => {
        const { socket, done } = openSocket('old-token')
        try {
            vi.spyOn(apiClient, 'post').mockImplementation(async () => {
                socket.handlers.onWebSocketClose(1008)
                return { token: 'new-token', user: { id: 'u1', username: 'ana' }, message: null }
            })
            await userService.changePassword({ currentPassword: 'old', newPassword: 'newpass1' })
            expect(sockets.endSession).not.toHaveBeenCalled()
            expect(jsdomStorage.getItem('authToken')).toBe('new-token')
            expect(sockets.clients[sockets.clients.length - 1]).not.toBe(socket)
            expect(sockets.clients[sockets.clients.length - 1].token).toBe('new-token')
        } finally {
            done()
        }
    })

    test('a change that fails after the 1008 ends the session once it has failed', async () => {
        const { socket, done } = openSocket('old-token')
        try {
            let endedWhileInFlight = -1
            vi.spyOn(apiClient, 'post').mockImplementation(async () => {
                socket.handlers.onWebSocketClose(1008)
                endedWhileInFlight = sockets.endSession.mock.calls.length
                // a reset that lands after the bump makes the server answer the wrong-password 401
                throw new ApiError({ message: 'Current password is incorrect', status: 401 })
            })
            await expect(userService.changePassword({ currentPassword: 'old', newPassword: 'newpass1' }))
                .rejects.toMatchObject({ status: 401 })
            expect(endedWhileInFlight).toBe(0)
            expect(sockets.endSession).toHaveBeenCalledTimes(1)
        } finally {
            done()
        }
    })
})
