import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { JSDOM } from 'jsdom'
import { MotionProvider } from '../motion/MotionProvider'

const KEY = 'stiglja:table-effects'
const auth = vi.hoisted(() => ({ logout: vi.fn() }))
vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'u1', username: 'ana' }, isAuthenticated: true, isLoading: false, logout: auth.logout }),
}))
// Account and the nav read GET /user/me
vi.mock('../hooks/useUser', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../hooks/useUser')>()),
    useMe: () => ({
        data: { id: 'u1', username: 'ana', email: 'ana@example.com', pendingEmail: null, emailVerified: true, roles: ['ROLE_USER'], deletionRequested: false },
        isLoading: false, error: null, refetch: vi.fn(),
    }),
}))

// Node 26's own localStorage global is unusable here; borrow jsdom's (see services/api.test.ts)
const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('localStorage', jsdomStorage)
    jsdomStorage.clear()
    // the preference module keeps this tab's choice: a fresh copy per test, like a fresh page
    vi.resetModules()
})
afterEach(() => vi.unstubAllGlobals())

async function renderSettings(reducedMotion: 'always' | 'never' = 'never') {
    const { SettingsPage } = await import('./SettingsPage')
    return render(
        <MotionProvider reducedMotion={reducedMotion}>
            <MemoryRouter>
                <SettingsPage />
            </MemoryRouter>
        </MotionProvider>,
    )
}

const effects = () => within(screen.getByRole('group', { name: 'Table effects' }))

describe('Settings (spec §4.13)', () => {
    test('the page is titled Settings and starts with Table effects, Full until the player picks', async () => {
        await renderSettings()
        expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Settings'])
        expect(document.title).toBe('Settings · Stiglja')
        expect(screen.getByRole('region', { name: 'Table effects' })).toBeInTheDocument()
        expect(effects().getAllByRole('button').map((b) => b.textContent)).toEqual(['Full', 'Calm', 'Off'])
        expect(effects().getByRole('button', { name: 'Full' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.queryByText(/reduced motion/)).not.toBeInTheDocument()
    })

    test('the pick is kept on this device, and a stored pick shows as picked', async () => {
        jsdomStorage.setItem(KEY, 'off')
        const { unmount } = await renderSettings()
        expect(effects().getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'true')
        await userEvent.setup().click(effects().getByRole('button', { name: 'Calm' }))
        expect(effects().getByRole('button', { name: 'Calm' })).toHaveAttribute('aria-pressed', 'true')
        expect(jsdomStorage.getItem(KEY)).toBe('calm')
        unmount()
        await renderSettings()
        expect(effects().getByRole('button', { name: 'Calm' })).toHaveAttribute('aria-pressed', 'true')
    })

    test('under reduced motion a note says the table shows no particles', async () => {
        await renderSettings('always')
        expect(screen.getByText('Your device asks for reduced motion, so the table shows no particles, whatever you pick here.')).toBeInTheDocument()
    })

    // R-34 as amended (spec §2.5): Settings is in the nav again because it is a real page
    test("the nav's Settings leads to a page with Table effects and Account (R-34 amended)", async () => {
        const { Sidebar } = await import('../components/layout/Sidebar')
        const { SettingsPage } = await import('./SettingsPage')
        render(
            <MemoryRouter initialEntries={['/dashboard']}>
                <Sidebar />
                <Routes>
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={null} />
                </Routes>
            </MemoryRouter>,
        )
        const nav = screen.getByRole('navigation', { name: 'Main navigation' })
        await userEvent.setup().click(within(nav).getByRole('link', { name: 'Settings' }))
        expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
        expect(screen.getByRole('region', { name: 'Table effects' })).toBeInTheDocument()
        expect(screen.getByRole('region', { name: 'Account' })).toHaveAttribute('id', 'account')
    })

    test('Log out signs out (a full page load to /, through useAuth)', async () => {
        await renderSettings()
        expect(screen.getByText('Signed in as ana')).toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }))
        expect(auth.logout).toHaveBeenCalledTimes(1)
    })
})
