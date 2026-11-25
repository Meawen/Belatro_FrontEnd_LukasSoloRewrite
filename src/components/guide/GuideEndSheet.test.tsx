import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { GuideEndSheet } from './GuideEndSheet'
import { CLIENT_ID, dropGoogleScripts, gsiScripts, stubGoogle } from '../../test/googleStub'

beforeEach(() => {
    // a client id set, so any Google button on the sheet would be drawn
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', CLIENT_ID)
})

afterEach(() => {
    cleanup()
    dropGoogleScripts()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
})

describe("the after-guide sheet has no Google button (Google sign-in spec §2, §10)", () => {
    test.each([
        ['a guest', true, false, 'Sign up'],
        ['a guest while signup is full', true, true, 'Waitlist'],
        ['a member', false, false, 'Continue this game'],
    ])('%s: its own main button, and nothing from Google, even with a client id', async (_, guest, signupFull, main) => {
        const google = stubGoogle()
        render(<GuideEndSheet open guest={guest} signupFull={signupFull} onContinue={vi.fn()} onGo={vi.fn()} />)
        await act(async () => {})
        expect(screen.getByTestId('guide-end')).toBeInTheDocument()
        expect(screen.getAllByRole('button').map((b) => b.textContent)).toContain(main)
        expect(screen.queryByTestId('google-button')).not.toBeInTheDocument()
        expect(google.initialize).not.toHaveBeenCalled()
        expect(google.renderButton).not.toHaveBeenCalled()
    })

    test("Google's script isn't even asked for", async () => {
        render(<GuideEndSheet open guest signupFull={false} onContinue={vi.fn()} onGo={vi.fn()} />)
        await act(async () => {})
        expect(gsiScripts()).toHaveLength(0)
    })
})
