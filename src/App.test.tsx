import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { JSDOM } from 'jsdom'
import App from './App'
import { captureConsole } from './test/captureConsole'

// One switch for every test: signed in (the default) or signed out.
const auth = vi.hoisted(() => ({ isAuthenticated: true }))
vi.mock('./hooks/useAuth', () => ({
    useAuth: () => ({
        user: auth.isAuthenticated ? { id: 'u1', username: 'ana' } : null,
        isAuthenticated: auth.isAuthenticated,
        isLoading: false,
        logout: vi.fn(),
        token: auth.isAuthenticated ? 'tok-1' : null,
    }),
}))
// A page whose render throws, like a payload shape the code does not expect.
vi.mock('./components/match/MatchHistory', () => ({
    MatchHistory: () => {
        throw new Error('render failed')
    },
}))

// Node 26's own localStorage global is unusable here; borrow jsdom's (see api.test.ts)
const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

/** App owns its BrowserRouter, so the route comes from the window's location. */
function renderAt(path: string) {
    window.history.pushState({}, '', path)
    return render(<App />)
}

beforeEach(() => {
    auth.isAuthenticated = true
    vi.stubGlobal('localStorage', jsdomStorage)
    // The shell's own requests (GET /user/me, …) get an empty 204, never a network
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
})
afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    jsdomStorage.clear()
})

describe('App error boundary (R-29)', () => {
    test('a page that throws shows the fallback with Reload and Go to dashboard, not a blank page', () => {
        // React reports the caught error on the console
        const logs = captureConsole()
        renderAt('/matches')
        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
        expect(screen.getByText('Reload')).toBeInTheDocument()
        expect(screen.getByText('Go to dashboard')).toBeInTheDocument()
        expect(logs.text()).toContain('render failed')
    })
})
