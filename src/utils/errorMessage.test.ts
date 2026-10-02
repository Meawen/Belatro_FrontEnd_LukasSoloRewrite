import { describe, test, expect } from 'vitest'
import { errorMessage } from './errorMessage'
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
