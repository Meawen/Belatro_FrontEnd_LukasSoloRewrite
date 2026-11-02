import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSignupStatus } from './useSignupStatus'

const beta = vi.hoisted(() => ({ signupStatus: vi.fn() }))
vi.mock('../services/betaService', () => ({ betaService: beta }))

beforeEach(() => vi.clearAllMocks())

describe('useSignupStatus (spec §2.2, Ruling 6)', () => {
    test('asks once: open, full, and unknown when it fails or an older server has no answer', async () => {
        const answers: [() => Promise<unknown>, string][] = [
            [async () => ({ open: true }), 'open'],
            [async () => ({ open: false }), 'full'],
            [async () => { throw new Error('Failed to fetch') }, 'unknown'],
            // an older server: a 404 body, or the 204 the client reads as {}
            [async () => ({}), 'unknown'],
        ]
        for (const [answer, state] of answers) {
            beta.signupStatus.mockReset()
            beta.signupStatus.mockImplementation(answer)
            const { result, unmount } = renderHook(() => useSignupStatus())
            expect(result.current, state).toBe('asking')
            await waitFor(() => expect(result.current, state).toBe(state))
            expect(beta.signupStatus, state).toHaveBeenCalledTimes(1)
            unmount()
        }
    })

    test('off, it asks nothing', async () => {
        const { result } = renderHook(() => useSignupStatus(false))
        expect(result.current).toBe('unknown')
        await waitFor(() => expect(result.current).toBe('unknown'))
        expect(beta.signupStatus).not.toHaveBeenCalled()
    })
})
