import { describe, test, expect, vi, afterEach } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { formatDuration } from './formatDuration'
import { MatchHistory } from './MatchHistory'
import { MatchDetailsPage } from '../../pages/MatchDetailsPage'
import { apiClient, ApiError } from '../../services/api'
import type { HandDTO, HandSummary, MatchDTO } from '../../types/match'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' } }) }))

afterEach(() => vi.restoreAllMocks())

// Tailwind's own colour scale (bg-emerald-900, text-red-300, …): the design uses tokens only (spec §3.2)
const RAW_PALETTE = /\b(?:bg|text|border|from|to|via)-(?:amber|emerald|slate|red|purple|gray|blue|yellow|green|orange|teal|pink)-\d/

const ID = '6ac9061df0a9f70ffc4dfa74'
const MATCH_URL = `/matches/${ID}`

function match(result: string | null): MatchDTO {
    return {
        id: ID, gameMode: 'RANKED', result, originLobby: null,
        teamA: [{ id: 'u1', username: 'ana' }, { id: 'u2', username: 'bob' }],
        teamB: [{ id: 'u3', username: 'cy' }, { id: 'u4', username: 'dan' }],
        startTime: '2026-10-01T18:00:00Z', endTime: '2026-10-01T18:40:00Z',
    }
}
const summary = (finalScoreA: number, finalScoreB: number, decl: [number, number]): HandSummary => ({
    teamAPoints: 90, teamBPoints: 72, teamADeclPoints: decl[0], teamBDeclPoints: decl[1], teamATricksWon: 5, teamBTricksWon: 3,
    padanje: false, capot: false, finalScoreA, finalScoreB,
})
const hand = (handNo: number, s: HandSummary, tricks: number): HandDTO => ({
    handNo, trumpCalls: [{ order: 1, player: 'bob', trump: 'HERC' }],
    tricks: Array.from({ length: tricks }, (_, t) => ({ trickNo: t + 1, winnerId: 'ana', points: 0, moves: [], lastTrickBonus: false })),
    challenges: [], handSummary: s,
})
/** One match's three routes: two hands (8 and 5 tricks), declarations A 20 + 20, B 50. */
const details = (result: string | null): Record<string, unknown> => ({
    [MATCH_URL]: match(result),
    [`${MATCH_URL}/structured-moves`]: [hand(1, summary(162, 0, [20, 0]), 8), hand(2, summary(1001, 650, [20, 50]), 5)],
    [`${MATCH_URL}/moves`]: [],
})

/** The API by path (the query ignored): a listed value answers, an Error rejects, anything else is a 404. */
function serve(answers: Record<string, unknown>) {
    return vi.spyOn(apiClient, 'get').mockImplementation((async (url: string) => {
        const path = url.split('?')[0]
        const value = path in answers ? answers[path] : new ApiError({ message: 'Not Found', status: 404 })
        if (value instanceof Error) throw value
        return value
    }) as never)
}

/** Where the app is now: path, query and router state. */
function Where() {
    const { pathname, search, state } = useLocation()
    return <p data-testid="where">{`${pathname}${search} ${JSON.stringify(state ?? null)}`}</p>
}

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/matches" element={<><MatchHistory /><Where /></>} />
                <Route path="/matches/:id" element={<><MatchDetailsPage /><Where /></>} />
            </Routes>
        </MemoryRouter>,
    )
}

describe('Match details final scores (R-36)', () => {
    test("shows each team's points from an en-dash result that Team B won", async () => {
        serve(details('Team B wins 870–1001'))
        renderAt(MATCH_URL)
        expect(await screen.findByTestId('final-a')).toHaveTextContent(/^870$/)
        expect(screen.getByTestId('final-b')).toHaveTextContent(/^1001$/)
        // the number sits right before its label, where the release gate reads it (spec §7.4)
        expect(screen.getByText('Team A Final').previousElementSibling).toHaveTextContent(/^870$/)
        expect(screen.getByText('Team B Final').previousElementSibling).toHaveTextContent(/^1001$/)
        const panel = screen.getByRole('region', { name: 'Match summary' })
        expect(within(panel).getByText('Team B wins 870–1001')).toBeInTheDocument()
        expect(within(panel).getByText('40 decl')).toBeInTheDocument()
        expect(within(panel).getByText('50 decl')).toBeInTheDocument()
    })

    test.each([
        ['a hyphen', 'Team A wins 1001-650'],
        ['spaces around the dash', 'Team A wins 1001 – 650'],
    ])('%s reads the same: Team A’s points first (AC 3)', async (_, result) => {
        serve(details(result))
        renderAt(MATCH_URL)
        expect(await screen.findByTestId('final-a')).toHaveTextContent(/^1001$/)
        expect(screen.getByTestId('final-b')).toHaveTextContent(/^650$/)
    })

    test('a forfeit shows "Won by forfeit" and no points', async () => {
        serve(details('Team B wins by forfeit'))
        renderAt(MATCH_URL)
        expect(await screen.findByText('Won by forfeit')).toBeInTheDocument()
        expect(screen.getByText('Team B wins by forfeit')).toBeInTheDocument()
        expect(screen.queryByText('Team A Final')).not.toBeInTheDocument()
        expect(screen.queryByText('Team B Final')).not.toBeInTheDocument()
        expect(screen.queryByTestId('final-a')).not.toBeInTheDocument()
    })
})

describe('Match details requests (R-9 amended, D-30)', () => {
    test('the details page asks for one match and its hands, never the history (R-9 amended, D-30)', async () => {
        const get = serve(details('Team A wins 1001–650'))
        renderAt(MATCH_URL)
        await screen.findByTestId('final-a')
        expect(get.mock.calls.map(([url]) => url).sort()).toEqual([MATCH_URL, `${MATCH_URL}/structured-moves`])
    })
})

describe('Match details (spec §4.9 items 1–4, 8, 9)', () => {
    test('the hero: my result as the page’s only h1, the last 12 of the id, the mode and the players', async () => {
        serve(details('Team A wins 1001–650'))
        const { container } = renderAt(MATCH_URL)
        await screen.findByTestId('final-a')
        const headings = screen.getAllByRole('heading', { level: 1 })
        expect(headings.map((h) => h.textContent)).toEqual(['WIN'])
        expect(headings[0]).toHaveClass('text-success')
        const hero = headings[0].closest('section')!
        expect(within(hero).getByText('Match ID: f70ffc4dfa74')).toBeInTheDocument()
        expect(within(hero).getByText('RANKED').closest('.ui-tag')).toHaveClass('text-accent')
        expect(within(hero).getByText('Players').parentElement).toHaveTextContent('4 Players')
        expect(document.title).toBe('Match details · Stiglja')
        // opened without a list page in its state: back to page 1
        expect(screen.getByRole('link', { name: 'Match History' })).toHaveAttribute('href', '/matches')
        expect(container.innerHTML).not.toMatch(RAW_PALETTE)
    })

    test('the tiles: Duration (h:mm:ss or m:ss), Mode, Hands and Tricks', async () => {
        serve(details('Team A wins 1001–650'))
        renderAt(MATCH_URL)
        await screen.findByTestId('final-a')
        const tile = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling
        expect(tile('Duration')).toHaveTextContent(/^40:00$/)
        expect(tile('Mode')).toHaveTextContent(/^RANKED$/)
        expect(tile('Hands')).toHaveTextContent(/^2$/)
        expect(tile('Tricks')).toHaveTextContent(/^13$/)
        expect(formatDuration('2026-10-01T18:00:00Z', '2026-10-01T19:02:03Z')).toBe('1:02:03')
        expect(formatDuration('2026-10-01T18:00:00Z', '2026-10-01T18:06:43Z')).toBe('6:43')
        expect(formatDuration(null, '2026-10-01T18:06:43Z')).toBe('Unknown')
    })

    test('the teams: "Team A" and "Team B" with their members, YOU on mine', async () => {
        serve(details('Team A wins 1001–650'))
        renderAt(MATCH_URL)
        await screen.findByTestId('final-a')
        const teamA = screen.getByRole('region', { name: 'Team A' })
        const teamB = screen.getByRole('region', { name: 'Team B' })
        expect(within(teamA).getByRole('heading', { name: 'Team A' })).toBeInTheDocument()
        expect(within(teamA).getByText('2 members')).toBeInTheDocument()
        expect(within(teamA).getByText('ana').parentElement).toHaveTextContent('YOU')
        expect(within(teamA).getByText('bob').parentElement).not.toHaveTextContent('YOU')
        expect(within(teamB).getByText('2 members')).toBeInTheDocument()
        expect(within(teamB).getByText('cy')).toBeInTheDocument()
        expect(within(teamB).queryByText('YOU')).not.toBeInTheDocument()
        expect(screen.queryByText(/Alpha|Bravo/)).not.toBeInTheDocument()
    })

    test('"Loading match…" first; a failure says so, and "Try again" asks again', async () => {
        const answers = details('Team A wins 1001–650')
        let release!: () => void
        let failing = true
        vi.spyOn(apiClient, 'get').mockImplementation((async (url: string) => {
            if (url === MATCH_URL && failing) {
                await new Promise<void>((done) => (release = done))
                throw new ApiError({ message: 'Internal Server Error', status: 500 })
            }
            return answers[url]
        }) as never)
        renderAt(MATCH_URL)
        expect(screen.getByText('Loading match…')).toBeInTheDocument()
        await act(async () => release())
        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent("Couldn't load this match")
        failing = false
        await userEvent.setup().click(within(alert).getByRole('button', { name: 'Try again' }))
        expect(await screen.findByTestId('final-a')).toHaveTextContent(/^1001$/)
    })

    test('a missing match: "Match data is not available", and "Back to Match History"', async () => {
        serve({})
        renderAt(MATCH_URL)
        expect(await screen.findByText('Match data is not available')).toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Back to Match History' }))
        expect(screen.getByTestId('where')).toHaveTextContent(/^\/matches null$/)
    })

    test('"‹ Match History" and "Back to Match History" return to the list page the row was on (AC 2)', async () => {
        serve({
            ...details('Team A wins 1001–650'),
            '/user/u1/history/summary': { content: [{ matchId: ID, endTime: null, result: 'Team A wins 1001–650', yourOutcome: 'WIN', gameMode: 'RANKED' }] },
        })
        renderAt('/matches?page=2')
        const user = userEvent.setup()
        await user.click(await screen.findByRole('link', { name: /Victory/ }))
        await screen.findByTestId('final-a')
        expect(screen.getByRole('link', { name: 'Match History' })).toHaveAttribute('href', '/matches?page=2')
        await user.click(screen.getByRole('link', { name: 'Match History' }))
        expect(await screen.findByText('Page 2')).toBeInTheDocument()
        expect(screen.getByTestId('where')).toHaveTextContent('/matches?page=2')

        await user.click(await screen.findByRole('link', { name: /Victory/ }))
        await user.click(await screen.findByRole('button', { name: 'Back to Match History' }))
        expect(await screen.findByText('Page 2')).toBeInTheDocument()
        expect(screen.getByTestId('where')).toHaveTextContent('/matches?page=2')
    })
})

describe('Match details hands (spec §4.9 items 5, 7, States)', () => {
    test('no structured hands: the raw moves, "Game moves ({n})" with Order, Player and Card', async () => {
        const moves = [
            { order: 1, player: 'ana', card: 'AS of HERC', legal: true },
            { order: 2, player: 'cy', card: 'DESETKA of HERC', legal: true },
        ]
        const get = serve({ ...details('Team A wins 1001–650'), [`${MATCH_URL}/structured-moves`]: [], [`${MATCH_URL}/moves`]: moves })
        renderAt(MATCH_URL)
        const raw = await screen.findByRole('region', { name: 'Game moves' })
        expect(within(raw).getByRole('heading', { name: 'Game moves (2)' })).toBeInTheDocument()
        expect(within(raw).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Order', 'Player', 'Card'])
        expect(within(raw).getAllByRole('row').slice(1).map((tr) => tr.textContent)).toEqual(['1anaAS of HERC', '2cyDESETKA of HERC'])
        expect(screen.queryByRole('region', { name: 'Game history' })).not.toBeInTheDocument()
        expect(get).toHaveBeenCalledWith(`${MATCH_URL}/moves`)
    })

    test('only the hands failing: the hero and teams still show; "Couldn\'t load the hands" and its retry', async () => {
        const answers = details('Team A wins 1001–650')
        let failing = true
        vi.spyOn(apiClient, 'get').mockImplementation((async (url: string) => {
            if (url.endsWith('/structured-moves') && failing) throw new ApiError({ message: 'Bad Gateway', status: 502 })
            return answers[url]
        }) as never)
        renderAt(MATCH_URL)
        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent("Couldn't load the hands")
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('WIN')
        expect(screen.getByRole('region', { name: 'Team A' })).toBeInTheDocument()
        expect(screen.getByTestId('final-a')).toHaveTextContent(/^1001$/)
        expect(screen.getByText('Hands', { selector: 'dt' }).nextElementSibling).toHaveTextContent('—')
        failing = false
        await userEvent.setup().click(within(alert).getByRole('button', { name: 'Try again' }))
        expect(await screen.findByRole('heading', { name: 'Game history (2 hands)' })).toBeInTheDocument()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
})
