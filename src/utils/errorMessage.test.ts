import { describe, test, expect } from 'vitest'
import { errorMessage, isNetworkOrServerFailure } from './errorMessage'
import { ApiError } from '../services/api'

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
