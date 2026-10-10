import { describe, test, expect, vi, afterEach } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { MatchHistory } from './MatchHistory'
import { apiClient } from '../../services/api'
import type { PlayerMatchSummaryDTO } from '../../types/user'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' } }) }))

afterEach(() => vi.restoreAllMocks())

// Tailwind's own colour scale (bg-emerald-900, text-red-300, …): the design uses tokens only (spec §3.2)
const RAW_PALETTE = /\b(?:bg|text|border|from|to|via)-(?:amber|emerald|slate|red|purple|gray|blue|yellow|green|orange|teal|pink)-\d/

const summaryUrl = (page: number) => `/user/u1/history/summary?page=${page}&size=10`

const row = (matchId: string, yourOutcome = 'WIN', result: string | null = 'Team A wins 1001–650'): PlayerMatchSummaryDTO =>
    ({ matchId, endTime: null, result, yourOutcome, gameMode: 'CASUAL' })
/** n rows, most recent first: WIN, LOSS, WIN, … */
const rows = (n: number) => Array.from({ length: n }, (_, i) => row(`m${i + 1}`, i % 2 ? 'LOSS' : 'WIN'))

/** GET /user/u1/history/summary answered per 0-based page (an empty page when not listed). */
function answer(pages: Record<number, PlayerMatchSummaryDTO[]>) {
    return vi.spyOn(apiClient, 'get').mockImplementation((async (url: string) => {
        const page = Number(/[?&]page=(\d+)/.exec(url)?.[1])
        return { content: pages[page] ?? [] }
    }) as never)
}

/** Where the app is now: path, query and router state. */
function Where() {
    const { pathname, search, state } = useLocation()
    return <p data-testid="where">{`${pathname}${search} ${JSON.stringify(state ?? null)}`}</p>
}

function renderList(path = '/matches') {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/matches" element={<><MatchHistory /><Where /></>} />
                <Route path="*" element={<Where />} />
            </Routes>
        </MemoryRouter>,
    )
}

describe('Match History requests (R-9 amended, D-30)', () => {
    test('the list asks only for the summary, never the detailed history (R-9 amended, D-30)', async () => {
        const get = answer({ 0: rows(4) })
        const { container } = renderList()
        expect(await screen.findAllByRole('link')).toHaveLength(4)
        expect(get.mock.calls.map(([url]) => url)).toEqual([summaryUrl(0)])
        // Recent form above the rows counts this page
        expect(screen.getByRole('region', { name: 'Recent form' })).toHaveTextContent('2 wins · 2 losses on this page · won the last 1')
        expect(container.innerHTML).not.toMatch(RAW_PALETTE)
    })
})

describe('Match History (spec §4.9 list)', () => {
    test('the header: "Match History" as the page’s h1, "{n} matches", and Refresh reads "Refreshing..." while it asks again', async () => {
        const get = answer({ 0: rows(2) })
        renderList()
        expect(await screen.findByText('2 matches')).toBeInTheDocument()
        expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Match History'])
        expect(document.title).toBe('Match History · Stiglja')

        let release!: (value: unknown) => void
        get.mockImplementation((() => new Promise((resolve) => (release = resolve))) as never)
        await userEvent.setup().click(screen.getByRole('button', { name: 'Refresh' }))
        expect(screen.getByRole('button', { name: 'Refreshing...' })).toBeDisabled()
        expect(screen.getByText('Loading matches...')).toBeInTheDocument()
        await act(async () => release({ content: rows(1) }))
        expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled()
        expect(screen.getByText('1 match')).toBeInTheDocument()
        expect(screen.queryByText('Loading matches...')).not.toBeInTheDocument()
        expect(get).toHaveBeenCalledTimes(2)
    })

    test('each row opens its match and carries the list’s page for Back; an unreadable result shows no score', async () => {
        answer({ 1: [row('6ac9061df0a9f70ffc4dfa74'), row('m2', 'LOSS', 'Match abandoned')] })
        renderList('/matches?page=2')
        const first = await screen.findByRole('link', { name: /Victory/ })
        expect(first).toHaveAttribute('href', '/matches/6ac9061df0a9f70ffc4dfa74')
        // never a made-up 0 : 0 (spec §3.1 rule 6)
        expect(screen.getAllByTestId('match-score').map((score) => score.textContent)).toEqual(['1001 : 650'])
        await userEvent.setup().click(first)
        expect(screen.getByTestId('where')).toHaveTextContent('/matches/6ac9061df0a9f70ffc4dfa74 {"page":2}')
    })

    test('the pager: "Page n", the per-page note on a full page; Next and Previous move the page in the URL', async () => {
        const get = answer({ 0: rows(10), 1: rows(3) })
        renderList()
        const pager = await screen.findByRole('navigation', { name: 'Pagination' })
        expect(await within(pager).findByText('· 10 matches per page')).toBeInTheDocument()
        expect(within(pager).getByText('Page 1')).toBeInTheDocument()
        expect(within(pager).getByRole('button', { name: 'Previous' })).toBeDisabled()
        const user = userEvent.setup()
        await user.click(within(pager).getByRole('button', { name: 'Next' }))

        expect(await screen.findByText('3 matches')).toBeInTheDocument()
        expect(screen.getByTestId('where')).toHaveTextContent('/matches?page=2 null')
        expect(screen.getByText('Page 2')).toBeInTheDocument()
        expect(screen.queryByText('· 10 matches per page')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
        await user.click(screen.getByRole('button', { name: 'Previous' }))

        expect(await screen.findByText('10 matches')).toBeInTheDocument()
        expect(screen.getByTestId('where')).toHaveTextContent(/^\/matches null$/)
        expect(get.mock.calls.map(([url]) => url)).toEqual([summaryUrl(0), summaryUrl(1), summaryUrl(0)])
    })

    test('a page in the URL that is not a whole number from 1 up is page 1', async () => {
        const get = answer({ 0: rows(1) })
        renderList('/matches?page=abc')
        expect(await screen.findByText('1 match')).toBeInTheDocument()
        expect(get.mock.calls.map(([url]) => url)).toEqual([summaryUrl(0)])
    })

    test('"Loading your match history..." until the first answer', async () => {
        let release!: (value: unknown) => void
        vi.spyOn(apiClient, 'get').mockImplementation((() => new Promise((resolve) => (release = resolve))) as never)
        renderList()
        expect(screen.getByText('Loading your match history...')).toBeInTheDocument()
        await act(async () => release({ content: rows(1) }))
        expect(screen.queryByText('Loading your match history...')).not.toBeInTheDocument()
        expect(screen.getAllByRole('link')).toHaveLength(1)
    })

    test('a failed load says so, and "Try again" asks again', async () => {
        const get = vi.spyOn(apiClient, 'get').mockRejectedValueOnce(new Error('down')).mockResolvedValue({ content: rows(1) })
        renderList()
        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent('Unable to load match history')
        expect(alert).toHaveTextContent('Something went wrong while fetching your matches')
        await userEvent.setup().click(within(alert).getByRole('button', { name: 'Try again' }))
        expect(await screen.findAllByRole('link')).toHaveLength(1)
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(get).toHaveBeenCalledTimes(2)
    })

    test('no matches yet: the line, no strip or pager, and "Find a game" leads to Play', async () => {
        answer({})
        renderList()
        expect(await screen.findByText('No matches yet')).toBeInTheDocument()
        expect(screen.getByText('Play a game and it shows up here.')).toBeInTheDocument()
        expect(screen.queryByRole('region', { name: 'Recent form' })).not.toBeInTheDocument()
        expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Find a game' }))
        expect(screen.getByTestId('where')).toHaveTextContent('/dashboard')
    })

    test('past the last page: "No more matches" and Previous goes back a page', async () => {
        answer({})
        renderList('/matches?page=3')
        expect(await screen.findByText('No more matches')).toBeInTheDocument()
        expect(screen.queryByText('No matches yet')).not.toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Previous' }))
        expect(screen.getByTestId('where')).toHaveTextContent('/matches?page=2 null')
    })
})
