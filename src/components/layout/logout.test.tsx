import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { JSDOM } from 'jsdom'
import { Sidebar } from './Sidebar'
import { TabBar } from './TabBar'
import { authService } from '../../services/authService'
import { captureConsole } from '../../test/captureConsole'

// Node 26's own localStorage global is unusable here; borrow jsdom's (see api.test.ts)
const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

let assign: ReturnType<typeof vi.fn>

beforeEach(() => {
    vi.stubGlobal('localStorage', jsdomStorage)
    jsdomStorage.setItem('authToken', 'tok-1')
    jsdomStorage.setItem('user', JSON.stringify({ id: 'u1', username: 'ana' }))
    // GET /user/me answers 204: no roles
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    vi.spyOn(authService, 'logout').mockResolvedValue('Successfully logged out.')
    captureConsole()
})
afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    jsdomStorage.clear()
})

// The real useAuth: Log out ends in a full page load to / (useAuth.ts), never a router navigation
describe('Log out (spec §4.1 AC 10)', () => {
    test('in the sidebar it clears the session and loads / afresh', async () => {
        render(<MemoryRouter initialEntries={['/dashboard']}><Sidebar /></MemoryRouter>)
        await userEvent.setup().click(await screen.findByRole('button', { name: 'Log out' }))
        await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('/'))
        expect(authService.logout).toHaveBeenCalledTimes(1)
        expect(jsdomStorage.getItem('authToken')).toBeNull()
        expect(jsdomStorage.getItem('user')).toBeNull()
    })

    test('under More it does the same', async () => {
        render(<MemoryRouter initialEntries={['/dashboard']}><TabBar /></MemoryRouter>)
        const user = userEvent.setup()
        await user.click(screen.getByRole('button', { name: 'More' }))
        await user.click(screen.getByRole('button', { name: 'Log out' }))
        await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('/'))
        expect(jsdomStorage.getItem('authToken')).toBeNull()
    })
})
