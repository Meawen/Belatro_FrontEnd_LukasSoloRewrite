import { describe, test, expect, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import { errorMessage, isNetworkOrServerFailure } from './errorMessage'
import { ApiError } from '../services/api'

// Node 26's own localStorage global is unusable here; borrow jsdom's (see services/api.test.ts)
const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

describe('errorMessage', () => {
    test("returns an Error's message, incl. the backend's message carried by ApiError", () => {
        expect(errorMessage(new Error('boom'), 'fallback')).toBe('boom')
        expect(errorMessage(new ApiError({ message: 'That email address is already in use', status: 409 }), 'fallback')).toBe('That email address is already in use')
    })

    test('returns the fallback for anything that is not an Error', () => {
        expect(errorMessage('boom', 'fallback')).toBe('fallback')
        expect(errorMessage(undefined, 'fallback')).toBe('fallback')
        expect(errorMessage({ message: 'not an Error' }, 'fallback')).toBe('fallback')
    })

    test("an ApiError reads in the site's language (spec §1.1)", async () => {
        vi.stubGlobal('localStorage', jsdomStorage)
        vi.resetModules()
        try {
            // one module copy: errorMessage's instanceof needs the same ApiError class
            const { errorMessage: message } = await import('./errorMessage')
            const { ApiError: FreshApiError } = await import('../services/api')
            const { setLang } = await import('../i18n/lang')
            const full = new FreshApiError({ status: 409, message: 'Lobby is full', code: 'LOBBY_FULL' })
            expect(message(full, 'fallback')).toBe('This table is full. Choose another one, or open your own.')
            setLang('hr')
            expect(message(full, 'fallback')).toBe('Ovaj je stol pun. Odaberi drugi ili otvori svoj.')
            expect(message(new Error('boom'), 'fallback')).toBe('boom')
            expect(message('x', 'fallback')).toBe('fallback')
        } finally {
            jsdomStorage.clear()
            vi.unstubAllGlobals()
        }
    })
})

describe('isNetworkOrServerFailure', () => {
    test("no answer (status 0) or a 5xx: the text is the browser's or Spring's, not the backend's", () => {
        expect(isNetworkOrServerFailure(0)).toBe(true)
        expect(isNetworkOrServerFailure(500)).toBe(true)
        expect(isNetworkOrServerFailure(503)).toBe(true)
    })

    test("any other status carries the backend's own message", () => {
        for (const status of [400, 401, 403, 404, 409, 429, 499]) {
            expect(isNetworkOrServerFailure(status)).toBe(false)
        }
    })
})
