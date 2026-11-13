import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import GamePageConnected from './GamePageConnected'
import { useGameViews, type GameViews } from '../../hooks/useGameViews'
import { MotionProvider } from '../../motion/MotionProvider'
import type { BoardState } from '../board/model/accept'
import type { GameBid, GameCard, PrivateGameView, PublicGameView } from '../../types/game'
import { setLang } from '../../i18n/lang'

// Škola bele's hand 2 (open beta §7.3, §7.4): /game/:id?guide=1 is a real bot game with the coach over it, and after its
// first hand the guide's end screen. The mocks are GamePageConnected.test.tsx's.

// carol, a member unless a test makes her a guest
const auth = vi.hoisted(() => ({ isGuest: false }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u3', username: 'carol' }, isGuest: auth.isGuest }) }))
vi.mock('../../hooks/useGameViews', () => ({ useGameViews: vi.fn() }))
vi.mock('./ReconnectBanner', () => ({ ReconnectBanner: () => <p>Reconnect banner slot</p> }))
const rematchMock = vi.hoisted(() => ({
    useRematch: vi.fn(),
    state: { votes: 0, voted: false, cancelledBy: null, expired: false, playAgain: vi.fn(), leave: vi.fn() },
}))
vi.mock('../../hooks/useRematch', () => ({ useRematch: rematchMock.useRematch }))
vi.mock('../../hooks/useMatchHands', () => ({ useMatchHands: () => ({ hands: null, ended: null, loading: false, error: null, refresh: vi.fn() }) }))
const art = vi.hoisted(() => ({ preloadCardArt: vi.fn(() => Promise.resolve()) }))
vi.mock('../../services/cardArt', async (importOriginal) => ({ ...(await importOriginal<object>()), preloadCardArt: art.preloadCardArt }))
// the guest's sign-up button reads signup-status (Ruling 6/47); its request is betaService.test's
const beta = vi.hoisted(() => ({ signupStatus: vi.fn() }))
vi.mock('../../services/betaService', () => ({ betaService: beta }))
// the guide's counts (spec §9): their request is guideEvents.test's; here what is counted, and when
const counts = vi.hoisted(() => ({ reportGuideEvent: vi.fn(() => Promise.resolve()) }))
vi.mock('../../services/guideEvents', () => counts)

const actions = { bidTrump: vi.fn(), passBid: vi.fn(), play: vi.fn(), challenge: vi.fn() }
const seating = ['alice', 'bob', 'carol', 'dave'].map((id) => ({ id, cardsLeft: 6 }))
const publicView = {
    gameId: 'g1', gameState: 'BIDDING', bids: [],
    currentTrick: { leadPlayerId: '_NO_LEAD_', trump: null, plays: {} },
    teamAScore: 0, teamBScore: 0, teamA: [], teamB: [], challengeUsedByPlayer: {}, winnerTeamId: null,
    tieBreaker: false, seatingOrder: seating, declarations: {}, belaDeclaredByPlayer: {}, challengeWindowExpiresAt: null,
} as unknown as PublicGameView

/** What useGameViews returns for these views: the accepted state the board renders, and its two parts. */
function views(pub: PublicGameView | null, priv: PrivateGameView | null = null, more: Partial<GameViews> = {}): GameViews {
    const view: BoardState | null = pub ? { publicView: pub, privateView: priv, receivedAt: 1, skew: 0, source: 'live' } : null
    return {
        view, snapshot: false, publicView: pub, privateView: priv,
        isConnected: true, connectionError: null, error: null, notAvailable: false, actions, ...more,
    }
}

/** Where the page is, with its search: guide mode lives in the URL. */
function Where() {
    const { pathname, search } = useLocation()
    return <p>at {pathname + search}</p>
}

const tree = (path: string) => (
    <MotionProvider>
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/game/:gameId" element={<><GamePageConnected /><Where /></>} />
                <Route path="*" element={<Where />} />
            </Routes>
        </MemoryRouter>
    </MotionProvider>
)
function renderPage(path = '/game/g1?guide=1') {
    const result = render(tree(path))
    return { ...result, rerenderPage: () => result.rerender(tree(path)) }
}

// Herc is trump; bob led As Tref; carol holds two Tref (both legal: neither beats the As), the As Herc and the Kralj Karo
const CALLED: GameBid[] = [{ playerId: 'alice', action: 'CALL_TRUMP', selectedTrump: 'HERC' }]
const T7: GameCard = { boja: 'TREF', rank: 'SEDMICA' }
const T9: GameCard = { boja: 'TREF', rank: 'DEVETKA' }
const HA: GameCard = { boja: 'HERC', rank: 'AS' }
const KK: GameCard = { boja: 'KARA', rank: 'KRALJ' }
const HAND = [HA, KK, T9, T7]
const playing = (version: number) => ({
    ...publicView, gameState: 'PLAYING', bids: CALLED, stateVersion: version, currentPlayerId: 'carol',
    currentTrick: { leadPlayerId: 'bob', trump: 'HERC', plays: { bob: { boja: 'TREF', rank: 'AS' } } },
}) as PublicGameView
/** My turn: the server's legal cards in its own order, not the hand's. */
function myTurn(version = 5): GameViews {
    const pub = playing(version)
    return views(pub, { publicPart: pub, hand: HAND, yourTurn: true, challengeUsed: false, legalCards: [T7, T9] })
}
function theirTurn(version = 6): GameViews {
    const pub = { ...playing(version), currentPlayerId: 'dave' }
    return views(pub, { publicPart: pub, hand: HAND, yourTurn: false, challengeUsed: false, legalCards: null })
}
/** A deal after hand 1 scored (BIDDING 162–70 unless given). */
function nextDeal(more: Partial<PublicGameView> = {}): GameViews {
    const pub = { ...publicView, teamAScore: 162, teamBScore: 70, stateVersion: 40, ...more } as PublicGameView
    return views(pub, { publicPart: pub, hand: HAND, yourTurn: false, challengeUsed: false, legalCards: null })
}

const marked = () => [...document.querySelectorAll('[data-marked]')]
const warning = () => screen.queryByRole('dialog', { name: 'An illegal card' })
const guideEnd = () => screen.queryByRole('dialog', { name: 'Bela school is done' })
const card = (name: string) => screen.getByRole('button', { name })

// the whole board renders in every test: slower than a 5-s default on a busy machine
vi.setConfig({ testTimeout: 20_000 })

beforeEach(() => {
    vi.clearAllMocks()
    auth.isGuest = false
    rematchMock.useRematch.mockReturnValue(rematchMock.state)
    beta.signupStatus.mockReset()
    beta.signupStatus.mockResolvedValue({ open: true })
    // jsdom draws nothing: no 2D context for the arena's canvas
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => {
    vi.restoreAllMocks()
})

describe('Škola bele hand 2 on the game page (open beta §7.3)', () => {
    test('?guide=1 marks exactly legalCards on my turn', () => {
        vi.mocked(useGameViews).mockReturnValue(myTurn())
        renderPage()
        expect(marked().map((one) => one.getAttribute('data-card')).sort()).toEqual(['TREF-DEVETKA', 'TREF-SEDMICA'])
        expect(card('7 Tref, highlighted')).toHaveAttribute('data-marked')
        expect(card('9 Tref, highlighted')).toHaveAttribute('data-marked')
        expect(card('As Herc')).not.toHaveAttribute('data-marked')
        expect(screen.getByTestId('coach-panel')).toContainElement(screen.getByTestId('hand2-panel'))
    })

    test('the foul warning appears only for an illegal card, and Play it anyway sends it', async () => {
        const user = userEvent.setup()
        vi.mocked(useGameViews).mockReturnValue(myTurn())
        renderPage()
        await user.click(card('9 Tref, highlighted'))
        expect(actions.play).toHaveBeenCalledTimes(1)
        expect(actions.play).toHaveBeenCalledWith(T9, false)
        expect(warning()).toBeNull()

        actions.play.mockClear()
        await user.click(card('As Herc'))
        expect(warning()).not.toBeNull()
        expect(actions.play).not.toHaveBeenCalled()
        await user.click(within(warning()!).getByRole('button', { name: 'Choose another card' }))
        await waitFor(() => expect(warning()).toBeNull())
        expect(actions.play).not.toHaveBeenCalled()

        await user.click(card('As Herc'))
        await user.click(within(warning()!).getByRole('button', { name: 'Play it anyway' }))
        expect(actions.play).toHaveBeenCalledTimes(1)
        expect(actions.play).toHaveBeenCalledWith(HA, false)
    })

    test('a turn that passes while the warning is open sends nothing', async () => {
        const user = userEvent.setup()
        vi.mocked(useGameViews).mockReturnValue(myTurn(5))
        const { rerenderPage } = renderPage()
        await user.click(card('As Herc'))
        expect(warning()).not.toBeNull()
        vi.mocked(useGameViews).mockReturnValue(theirTurn(6))
        rerenderPage()
        await waitFor(() => expect(warning()).toBeNull())
        vi.mocked(useGameViews).mockReturnValue(myTurn(7))
        rerenderPage()
        expect(card('As Herc')).toBeInTheDocument()
        expect(actions.play).not.toHaveBeenCalled()
    })

    test('outside guide mode the board is unchanged', async () => {
        const user = userEvent.setup()
        for (const path of ['/game/g1', '/game/g1?guide=0', '/game/g1?guide=true']) {
            auth.isGuest = path === '/game/g1'
            vi.mocked(useGameViews).mockReturnValue(myTurn())
            renderPage(path)
            expect(marked(), path).toEqual([])
            expect(screen.queryByTestId('coach-panel'), path).toBeNull()
            expect(screen.queryByTestId('hand2-panel'), path).toBeNull()
            await user.click(card('As Herc'))
            expect(actions.play, path).toHaveBeenCalledTimes(1)
            expect(actions.play, path).toHaveBeenCalledWith(HA, false)
            expect(warning(), path).toBeNull()
            actions.play.mockClear()
            cleanup()
        }
        // after the first hand too: no end screen outside guide mode
        vi.mocked(useGameViews).mockReturnValue(nextDeal())
        renderPage('/game/g1')
        expect(guideEnd()).toBeNull()
        expect(beta.signupStatus).not.toHaveBeenCalled()
    })

    test('guide mode survives a refresh and a reconnect', () => {
        vi.mocked(useGameViews).mockReturnValue(myTurn())
        const { unmount } = renderPage()
        expect(marked()).toHaveLength(2)
        unmount()
        // a refresh: the URL still says guide mode
        const { rerenderPage } = renderPage()
        expect(marked()).toHaveLength(2)
        expect(screen.getByTestId('hand2-panel')).toBeInTheDocument()
        vi.mocked(useGameViews).mockReturnValue({ ...myTurn(), isConnected: false })
        rerenderPage()
        vi.mocked(useGameViews).mockReturnValue(myTurn())
        rerenderPage()
        expect(screen.getByTestId('hand2-panel')).toBeInTheDocument()
        expect(marked()).toHaveLength(2)
    })
})

describe("the guide's end, after hand 2's first hand (open beta §7.4)", () => {
    test("a guest's end screen after the first hand: Sign up, Continue this game, Replay Bela school, each where it says", async () => {
        const user = userEvent.setup()
        auth.isGuest = true
        vi.mocked(useGameViews).mockReturnValue(nextDeal())
        renderPage()
        const end = guideEnd()!
        expect(end).not.toBeNull()
        expect(within(end).getByRole('heading', { level: 3, name: 'As a guest you can already:' })).toBeInTheDocument()
        expect(within(end).getByText('play against bots, any time')).toBeInTheDocument()
        expect(within(end).getByText("sit at a friend's table from the link they send you")).toBeInTheDocument()
        expect(within(end).getByRole('heading', { level: 3, name: 'What a free account adds:' })).toBeInTheDocument()
        expect(within(end).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
            'play against bots, any time', "sit at a friend's table from the link they send you",
            'Ranked, and a rank of your own', 'Friends', 'Matches: every game you play', "a name that's yours for good",
        ])
        expect(within(end).getByText('The game goes on meanwhile: on your turn, if you\'re away, the timer plays for you.')).toBeInTheDocument()
        // one primary: sign up
        const signUp = within(end).getByRole('button', { name: 'Sign up' })
        expect(signUp).toHaveClass('ui-btn--primary')
        expect(within(end).getByRole('button', { name: 'Continue this game' })).toHaveClass('ui-btn--secondary')
        expect(within(end).getByRole('button', { name: 'Replay Bela school' })).toHaveClass('ui-btn--secondary')
        await user.click(signUp)
        expect(screen.getByText('at /signup')).toBeInTheDocument()
        expect(beta.signupStatus).toHaveBeenCalledTimes(1)
        cleanup()

        // full: the same button is the waitlist's name, and still goes to /signup (Ruling 6)
        beta.signupStatus.mockResolvedValue({ open: false })
        renderPage()
        await user.click(await within(guideEnd()!).findByRole('button', { name: 'Waitlist' }))
        expect(screen.getByText('at /signup')).toBeInTheDocument()
        cleanup()

        renderPage()
        await user.click(within(guideEnd()!).getByRole('button', { name: 'Replay Bela school' }))
        expect(screen.getByText('at /learn')).toBeInTheDocument()
        cleanup()

        // the game goes on as a plain game: same page, no guide
        beta.signupStatus.mockClear()
        renderPage()
        expect(screen.getByText('at /game/g1?guide=1')).toBeInTheDocument()
        await user.click(within(guideEnd()!).getByRole('button', { name: 'Continue this game' }))
        expect(screen.getByText('at /game/g1')).toBeInTheDocument()
        await waitFor(() => expect(guideEnd()).toBeNull())
        expect(screen.queryByTestId('hand2-panel')).toBeNull()
        expect(screen.getByRole('region', { name: 'Game table' })).toBeInTheDocument()
        expect(beta.signupStatus).toHaveBeenCalledTimes(1)
    })

    test("a member's end screen: Continue this game (main), Ranked, Home", async () => {
        const user = userEvent.setup()
        vi.mocked(useGameViews).mockReturnValue(nextDeal())
        renderPage()
        const end = guideEnd()!
        expect(within(end).queryByRole('heading', { level: 3 })).toBeNull()
        expect(within(end).queryByRole('list')).toBeNull()
        expect(within(end).getByText(/^The game goes on meanwhile/)).toBeInTheDocument()
        const go = within(end).getByRole('button', { name: 'Continue this game' })
        expect(go).toHaveClass('ui-btn--primary')
        expect(go).toHaveFocus()
        expect(within(end).getByRole('button', { name: 'Ranked' })).toHaveClass('ui-btn--secondary')
        await user.click(within(end).getByRole('button', { name: 'Ranked' }))
        expect(screen.getByText('at /play')).toBeInTheDocument()
        cleanup()

        renderPage()
        await user.click(within(guideEnd()!).getByRole('button', { name: 'Home' }))
        expect(screen.getByText('at /dashboard')).toBeInTheDocument()
        cleanup()

        // Escape is Continue this game too
        renderPage()
        await user.keyboard('{Escape}')
        expect(screen.getByText('at /game/g1')).toBeInTheDocument()
        await waitFor(() => expect(guideEnd()).toBeNull())
        expect(beta.signupStatus).not.toHaveBeenCalled()
    })

    test("the end screen doesn't come back once dismissed, and comes back after a refresh until then", async () => {
        const user = userEvent.setup()
        vi.mocked(useGameViews).mockReturnValue(nextDeal())
        const first = renderPage()
        expect(guideEnd()).not.toBeNull()
        first.unmount()
        renderPage()
        expect(guideEnd()).not.toBeNull()
        await user.click(within(guideEnd()!).getByRole('button', { name: 'Continue this game' }))
        expect(screen.getByText('at /game/g1')).toBeInTheDocument()
        cleanup()
        // the next visit is the URL "Continue this game" left
        renderPage('/game/g1')
        expect(guideEnd()).toBeNull()
        expect(screen.getByRole('region', { name: 'Game table' })).toBeInTheDocument()
    })

    test('no end screen in the first hand, during its result, outside guide mode, or in a finished game', () => {
        const first = (state: string, a: number, b: number) => {
            const pub = { ...publicView, gameState: state, teamAScore: a, teamBScore: b } as PublicGameView
            return views(pub, { publicPart: pub, hand: HAND, yourTurn: false, challengeUsed: false, legalCards: null })
        }
        for (const state of [first('BIDDING', 0, 0), first('PLAYING', 0, 0), first('HAND_COMPLETE', 162, 0)]) {
            vi.mocked(useGameViews).mockReturnValue(state)
            renderPage()
            expect(guideEnd(), state.publicView!.gameState).toBeNull()
            cleanup()
        }
        vi.mocked(useGameViews).mockReturnValue(nextDeal())
        renderPage('/game/g1')
        expect(guideEnd()).toBeNull()
        cleanup()
        // a finished game: the board's own end sheet, with its own ways on
        vi.mocked(useGameViews).mockReturnValue(nextDeal({ gameState: 'COMPLETED', teamAScore: 1001, teamBScore: 500, winnerTeamId: 'A' }))
        renderPage()
        expect(screen.getByRole('heading', { name: 'Game over' })).toBeInTheDocument()
        expect(guideEnd()).toBeNull()
        expect(screen.queryByTestId('hand2-panel')).toBeNull()
    })

    test('Croatian: the panel, the hint, the warning and the end screen', async () => {
        const user = userEvent.setup()
        setLang('hr')
        try {
            vi.mocked(useGameViews).mockReturnValue(myTurn())
            renderPage()
            const panel = screen.getByTestId('hand2-panel')
            expect(within(panel).getByRole('heading', { level: 2, name: 'Drugo dijeljenje' })).toBeInTheDocument()
            expect(within(panel).getByText('Označene su karte koje smiješ baciti.')).toBeInTheDocument()
            await user.click(within(panel).getByRole('button', { name: 'Zašto?' }))
            expect(within(panel).getByText('Prvi je bačen Tref, a ti ga imaš, pa moraš odgovoriti na boju. Ovdje smiješ baciti bilo koji svoj Tref.')).toBeVisible()
            await user.click(card('As Herc'))
            const foul = screen.getByRole('dialog', { name: 'Nedopuštena karta' })
            expect(within(foul).getByText('U igri s ljudima netko bi ovu kartu mogao prijaviti kao prekršaj. Botovi nikad ne prijavljuju prekršaje.')).toBeInTheDocument()
            expect(within(foul).getByRole('button', { name: 'Odaberi drugu' })).toHaveFocus()
            expect(within(foul).getByRole('button', { name: 'Odigraj svejedno' })).toBeInTheDocument()
            cleanup()

            auth.isGuest = true
            vi.mocked(useGameViews).mockReturnValue(nextDeal())
            renderPage()
            const end = screen.getByRole('dialog', { name: 'Škola bele je gotova' })
            expect(within(end).getByRole('button', { name: 'Registriraj se' })).toBeInTheDocument()
            expect(within(end).getByRole('button', { name: 'Nastavi ovu igru' })).toBeInTheDocument()
            expect(within(end).getByRole('button', { name: 'Ponovi Školu bele' })).toBeInTheDocument()
            expect(within(end).getByText('Pajdaši')).toBeInTheDocument()
            // signup is full: Red za stol
            await waitFor(() => expect(beta.signupStatus).toHaveBeenCalledTimes(1))
            cleanup()
            beta.signupStatus.mockResolvedValue({ open: false })
            renderPage()
            expect(await within(screen.getByRole('dialog', { name: 'Škola bele je gotova' })).findByRole('button', { name: 'Red za stol' })).toBeInTheDocument()
            cleanup()

            auth.isGuest = false
            renderPage()
            const member = screen.getByRole('dialog', { name: 'Škola bele je gotova' })
            expect(within(member).getByRole('button', { name: 'Nastavi ovu igru' })).toHaveClass('ui-btn--primary')
            expect(within(member).getByRole('button', { name: 'Rangirano' })).toBeInTheDocument()
            expect(within(member).getByRole('button', { name: 'Doma' })).toBeInTheDocument()
            cleanup()
        } finally {
            setLang('en')
        }
    })
})

describe("hand 2's count (open beta spec §9)", () => {
    const calls = () => counts.reportGuideEvent.mock.calls
    /** A view of the game at this state and these game totals (BIDDING 0–0 is hand 2's own deal). */
    const at = (gameState: string, teamAScore: number, teamBScore: number, stateVersion: number, more: Partial<PublicGameView> = {}) => {
        const pub = { ...publicView, gameState, teamAScore, teamBScore, stateVersion, ...more } as PublicGameView
        return views(pub, { publicPart: pub, hand: HAND, yourTurn: false, challengeUsed: false, legalCards: null })
    }
    /** The page now sees this view, as a newer state arriving over the socket. */
    function show(page: { rerenderPage: () => void }, next: GameViews) {
        vi.mocked(useGameViews).mockReturnValue(next)
        page.rerenderPage()
    }

    test("hand 2's end counts once, when the end screen opens (spec §9)", async () => {
        const user = userEvent.setup()
        vi.mocked(useGameViews).mockReturnValue(at('PLAYING', 0, 0, 5))
        const page = renderPage()
        expect(calls()).toEqual([])
        show(page, at('HAND_COMPLETE', 162, 0, 20))
        expect(guideEnd()).toBeNull()
        expect(calls()).toEqual([])
        show(page, at('BIDDING', 162, 70, 40))
        expect(guideEnd()).not.toBeNull()
        expect(calls()).toEqual([['hand2']])
        show(page, at('PLAYING', 162, 70, 41))
        expect(calls()).toHaveLength(1)
        await user.click(within(guideEnd()!).getByRole('button', { name: 'Continue this game' }))
        await waitFor(() => expect(guideEnd()).toBeNull())
        expect(calls()).toHaveLength(1)
    })

    test("an end screen left open closes at each later hand's result and opens again at its deal, and still counts once", async () => {
        vi.mocked(useGameViews).mockReturnValue(at('PLAYING', 0, 0, 5))
        const page = renderPage()
        show(page, at('BIDDING', 162, 70, 40))
        expect(calls()).toEqual([['hand2']])
        for (const [a, b, version] of [[300, 150, 80], [400, 280, 120]]) {
            show(page, at('HAND_COMPLETE', a, b, version))
            await waitFor(() => expect(guideEnd(), `result ${a}–${b}`).toBeNull())
            show(page, at('BIDDING', a, b, version + 1))
            expect(guideEnd(), `deal ${a}–${b}`).not.toBeNull()
        }
        expect(calls()).toEqual([['hand2']])
    })

    test("a refresh on the end screen doesn't count it again", async () => {
        // a fresh page straight at the end screen saw no play: nothing to count, then or at any later opening
        vi.mocked(useGameViews).mockReturnValue(at('BIDDING', 162, 70, 40))
        const fresh = renderPage()
        expect(guideEnd()).not.toBeNull()
        expect(calls()).toEqual([])
        show(fresh, at('HAND_COMPLETE', 300, 150, 80))
        await waitFor(() => expect(guideEnd()).toBeNull())
        show(fresh, at('BIDDING', 300, 150, 81))
        expect(guideEnd()).not.toBeNull()
        expect(calls()).toEqual([])
        cleanup()

        // after a page that counted it: unmount, and the same URL again at the end screen
        vi.mocked(useGameViews).mockReturnValue(at('PLAYING', 0, 0, 5))
        const page = renderPage()
        show(page, at('HAND_COMPLETE', 162, 0, 20))
        show(page, at('BIDDING', 162, 70, 40))
        expect(calls()).toEqual([['hand2']])
        page.unmount()
        vi.mocked(useGameViews).mockReturnValue(at('BIDDING', 162, 70, 40))
        renderPage()
        expect(guideEnd()).not.toBeNull()
        expect(calls()).toEqual([['hand2']])
    })

    test('a refresh during hand 2 still counts its end once', () => {
        vi.mocked(useGameViews).mockReturnValue(at('PLAYING', 0, 0, 5))
        renderPage().unmount()
        vi.mocked(useGameViews).mockReturnValue(at('PLAYING', 0, 0, 5))
        const page = renderPage()
        show(page, at('BIDDING', 162, 70, 40))
        expect(guideEnd()).not.toBeNull()
        expect(calls()).toEqual([['hand2']])
        // the sheet's opening animation goes with the page, not after the test
        page.unmount()
    })

    test('nothing is counted outside guide mode or in a game that ends', () => {
        vi.mocked(useGameViews).mockReturnValue(at('PLAYING', 0, 0, 5))
        const plain = renderPage('/game/g1')
        show(plain, at('BIDDING', 162, 70, 40))
        expect(guideEnd()).toBeNull()
        expect(calls()).toEqual([])
        cleanup()

        // a game that ends inside hand 2: a belot wins it, or it is called off
        for (const end of [at('COMPLETED', 1001, 0, 20, { winnerTeamId: 'A' }), at('CANCELLED', 0, 0, 20)]) {
            vi.mocked(useGameViews).mockReturnValue(at('PLAYING', 0, 0, 5))
            const over = renderPage()
            show(over, end)
            expect(guideEnd(), end.publicView!.gameState).toBeNull()
            cleanup()
        }
        expect(calls()).toEqual([])
    })
})
