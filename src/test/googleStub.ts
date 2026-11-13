import { act } from '@testing-library/react'
import { vi } from 'vitest'
import { GSI_URL } from '../services/googleSignIn'

/**
 * Google sign-in in tests: a made-up client id (never a real one), ID tokens naming an address, and Google Identity
 * Services as the page sees it once its script ran. setup.ts pins no client id before each test; a test that wants
 * Google's button stubs CLIENT_ID after that (vi.stubEnv('VITE_GOOGLE_CLIENT_ID', CLIENT_ID)).
 */
export const CLIENT_ID = 'visual-test.apps.googleusercontent.com'

/** A Google ID token's shape (header.payload.signature), its payload naming the Google address; `claims` make another token for it. */
export const tokenFor = (email: string, claims: Record<string, unknown> = {}) =>
    ['eyJhbGciOiJSUzI1NiJ9', Buffer.from(JSON.stringify({ email, ...claims })).toString('base64url'), 'c2ln'].join('.')

/** Google's script tags on the page. */
export const gsiScripts = () => [...document.querySelectorAll(`script[src="${GSI_URL}"]`)]

/** A load a test left in flight fails, so the next test starts with no script and nothing cached. */
export function dropGoogleScripts() {
    for (const script of gsiScripts()) {
        script.dispatchEvent(new Event('error'))
        script.remove()
    }
}

/**
 * Google Identity Services once its script ran: each button it draws is a `google-button` test id. `answer` is Google's
 * callback after an account was picked in its window; it goes to the button drawn last, as Google's does.
 */
export function stubGoogle(credential = tokenFor('ana@gmail.com')) {
    const id = {
        initialize: vi.fn(),
        renderButton: vi.fn((parent: HTMLElement) => {
            const button = document.createElement('div')
            button.dataset.testid = 'google-button'
            parent.append(button)
        }),
    }
    vi.stubGlobal('google', { accounts: { id } })
    const answer = (picked = credential) => act(async () => {
        id.initialize.mock.lastCall![0].callback({ credential: picked, select_by: 'btn' })
    })
    return { ...id, answer }
}
