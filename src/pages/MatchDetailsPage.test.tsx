import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { JSDOM } from 'jsdom'
import App from '../App'
import { apiClient, ApiError } from '../services/api'

vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'u1', username: 'ana' }, isAuthenticated: true, isLoading: false, logout: vi.fn(), token: 'tok-1' }),
}))

// Node 26's own localStorage global is unusable here; borrow jsdom's (as App.test.tsx does)
const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

beforeEach(() => {
    vi.stubGlobal('localStorage', jsdomStorage)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
})
afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    jsdomStorage.clear()
})

describe('the /matches/:id route (spec §4.9; D-29)', () => {
    test('opens the match on its own page inside the shell, with Matches as the current page', async () => {
        const ID = '6ac9061df0a9f70ffc4dfa74'
        const answers: Record<string, unknown> = {
            [`/matches/${ID}`]: {
                id: ID, gameMode: 'CASUAL', result: 'Team B wins 870–1001', originLobby: null,
                teamA: [{ id: 'u1', username: 'ana' }], teamB: [{ id: 'u3', username: 'cy' }], startTime: null, endTime: null,
            },
            [`/matches/${ID}/structured-moves`]: [],
            [`/matches/${ID}/moves`]: [],
        }
        vi.spyOn(apiClient, 'get').mockImplementation((async (url: string) => {
            if (url in answers) return answers[url]
            throw new ApiError({ message: 'Not Found', status: 404 })
        }) as never)
        window.history.pushState({}, '', `/matches/${ID}`)
        render(<App />)
        expect(await screen.findByTestId('final-a')).toHaveTextContent(/^870$/)
        const nav = screen.getByRole('navigation', { name: 'Main navigation' })
        expect(within(nav).getByRole('link', { name: 'Matches' })).toHaveAttribute('aria-current', 'page')
    })
})
