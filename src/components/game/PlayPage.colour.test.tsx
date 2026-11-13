import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PlayPage } from './PlayPage'
import { useEnhancedRanked } from '../../hooks/useEnhancedRanked'
import { CARD_ART_BASE_URL } from '../../config'
import { setLang } from '../../i18n/lang'

vi.mock('../../hooks/useEnhancedRanked', () => ({ useEnhancedRanked: vi.fn() }))
vi.mock('../../hooks/useUser', () => ({
    useUser: () => ({ user: { id: 'u1', username: 'ana', eloRating: 1450 }, isLoading: false, error: null, refetch: () => {} }),
}))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' }, isAuthenticated: true }) }))

/** The queue hook as PlayPage, PlayButton and QueueStatus read it: connected, queued or not. */
function ranked(isInQueue: boolean) {
    vi.mocked(useEnhancedRanked).mockReturnValue({
        isInQueue,
        queueStatus: isInQueue ? { state: 'IN_QUEUE', estWaitSeconds: 45, queueSize: 3, mmr: 1450 } : null,
        queuedSince: isInQueue ? Date.now() : null,
        joinQueue: vi.fn(),
        leaveQueue: vi.fn(),
        isJoining: false,
        isLeaving: false,
        joinError: null,
        leaveError: null,
        isWebSocketConnected: true,
        isWebSocketConnecting: false,
        webSocketError: null,
    } as never)
}

const renderPage = () => render(<MemoryRouter initialEntries={['/play']}><PlayPage /></MemoryRouter>)

describe('Ranked in colour (spec §4.5; owner, 2026-10-10)', () => {
    test('the panel sits on the table felt with its wooden rim, the four suits beside the eyebrow', () => {
        ranked(false)
        renderPage()
        const table = screen.getByTestId('ranked-table')
        expect(table).toHaveClass('felt')
        const panel = within(table).getByRole('region', { name: 'Find a match' })
        expect(panel).not.toHaveClass('ui-panel--accent')
        expect(within(panel).getByText('RANKED')).toBeInTheDocument()
        expect([...panel.querySelectorAll('img')].map((img) => img.getAttribute('src'))).toEqual(
            ['herc', 'kara', 'pik', 'tref'].map((suit) => `${CARD_ART_BASE_URL}/${suit}Icon.png`),
        )
        expect(within(panel).getByRole('button', { name: 'Play ranked' })).toBeEnabled()
    })

    test("while searching, the panel's edge turns accent", () => {
        ranked(true)
        renderPage()
        const panel = screen.getByRole('region', { name: 'Find a match' })
        expect(panel).toHaveClass('ui-panel--accent')
        expect(within(panel).getByText('Finding players…')).toBeInTheDocument()
        expect(within(panel).getByRole('button', { name: 'Leave Queue' })).toBeInTheDocument()
    })
})

describe('Ranked in Croatian (open beta §1.1, §1.4)', () => {
    afterEach(() => setLang('en'))

    test('Rangirano in Croatian', () => {
        setLang('hr')
        ranked(false)
        const { unmount } = renderPage()
        const panel = screen.getByRole('region', { name: 'Pronađi partiju' })
        expect(within(panel).getByRole('heading', { level: 1, name: 'Pronađi partiju' })).toBeInTheDocument()
        expect(within(panel).getByText('RANGIRANO')).toBeInTheDocument()
        expect(within(panel).getByRole('button', { name: 'Igraj rangirano' })).toBeEnabled()
        unmount()

        ranked(true)
        renderPage()
        const queued = screen.getByRole('region', { name: 'Pronađi partiju' })
        expect(within(queued).getByText('Tražimo ti pajdaše…')).toBeInTheDocument()
        expect(within(queued).getByRole('button', { name: 'Prekini potragu' })).toBeInTheDocument()
    })
})
