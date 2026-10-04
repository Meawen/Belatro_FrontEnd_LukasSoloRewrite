import { describe, test, expect, vi, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'
import type { StompClientHandlers } from './gameSocket'

// The real socket module (its default 1008 handling included), on fake STOMP clients
const sockets = vi.hoisted(() => ({ clients: [] as { token: string; handlers: StompClientHandlers }[] }))
vi.mock('./gameSocket', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./gameSocket')>()
    return {
        ...actual,
        gameSocket: actual.createGameSocket((token, handlers) => {
            sockets.clients.push({ token, handlers })
            return { activate() {}, deactivate() {}, publish() {}, subscribe: () => ({ id: 'sub', unsubscribe() {} }) }
        }),
    }
})

import { apiClient } from './api'
import { authService } from './authService'
import { gameSocket } from './gameSocket'

const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    jsdomStorage.clear()
})

describe('authService email routes', () => {
    test('confirmEmail posts the token from the link', async () => {
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
        await authService.confirmEmail('tok-1')
        expect(post).toHaveBeenCalledWith('/api/auth/confirm-email', { token: 'tok-1' })
    })

    test('forgotPassword posts the address', async () => {
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
        await authService.forgotPassword('ana@example.com')
        expect(post).toHaveBeenCalledWith('/api/auth/forgot-password', { email: 'ana@example.com' })
    })

    test('resetPassword posts token and new password, then forgets the local session', async () => {
        vi.stubGlobal('localStorage', jsdomStorage)
        jsdomStorage.setItem('authToken', 'old-token')
        jsdomStorage.setItem('user', '{"id":"u1","username":"ana"}')
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
        await authService.resetPassword('tok-2', 'brand-new-pass')
        expect(post).toHaveBeenCalledWith('/api/auth/reset-password', { token: 'tok-2', newPassword: 'brand-new-pass' })
        expect(jsdomStorage.getItem('authToken')).toBeNull()
        expect(jsdomStorage.getItem('user')).toBeNull()
    })
})

describe('authService.logout', () => {
    test('the server closing this tab\'s socket (1008) during the logout does not show "session ended"', async () => {
        const assign = vi.fn()
        vi.stubGlobal('localStorage', jsdomStorage)
        vi.stubGlobal('location', { ...window.location, assign })
        jsdomStorage.setItem('authToken', 'tok-1')
        const release = gameSocket.acquire()
        const socket = sockets.clients[sockets.clients.length - 1]
        socket.handlers.onConnect()
        const fetch = vi.fn(async () => {
            // the backend closes the user's sockets as it logs the token out, before it answers
            socket.handlers.onWebSocketClose(1008)
            // ...and answers 200 text/plain (AuthController: ResponseEntity<String>)
            const headers: Record<string, string> = { 'content-type': 'text/plain;charset=UTF-8', 'content-length': '24' }
            return {
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
                text: () => Promise.resolve('Successfully logged out.'),
                json: () => Promise.reject(new SyntaxError('Unexpected token \'S\', "Successfully logged out." is not valid JSON')),
            } as unknown as Response
        })
        vi.stubGlobal('fetch', fetch)
        try {
            await expect(authService.logout()).resolves.toBe('Successfully logged out.')
            expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/auth\/logout$/), expect.objectContaining({ method: 'POST' }))
            expect(assign).not.toHaveBeenCalled()
            // not signOutToLogin (assign was never called): logout's own clearToken ran
            expect(jsdomStorage.getItem('authToken')).toBeNull()
        } finally {
            release()
        }
    })
})
