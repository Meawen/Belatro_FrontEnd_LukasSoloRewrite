import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { LearnPage } from './LearnPage'
import { advance, click, playHand1 } from '../guide/testing'
import { LESSONS } from '../guide/script'
import { authService } from '../services/authService'
import { ApiError } from '../services/api'
import { userService } from '../services/userService'
import { Toaster } from '../components/ui/Toast'
import { en } from '../i18n/catalog/en'
import { setLang } from '../i18n/lang'

// Škola bele (open beta §7): /learn, signed in or out. Hand 1 replays B8's recording of a real game on the real board,
// on rails; the whole board renders, so a hand takes a while
vi.setConfig({ testTimeout: 60_000 })

// one switch for every test, as App.test's: signed out (the default here), a guest, or a member
const auth = vi.hoisted(() => ({ isAuthenticated: false, guest: false }))
vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({
        user: !auth.isAuthenticated ? null : auth.guest ? { id: 'g1', username: 'gost_4821', guest: true } : { id: 'u1', username: 'ana' },
        isAuthenticated: auth.isAuthenticated,
        isGuest: auth.isAuthenticated && auth.guest,
        isLoading: false,
        logout: vi.fn(),
        token: auth.isAuthenticated ? 'tok-1' : null,
    }),
}))
// the end screen's bot game (spec §6): its request is botGame's own test's; here a stub
const bots = vi.hoisted(() => ({ startBotGame: vi.fn() }))
vi.mock('../services/botGame', () => ({ startBotGame: bots.startBotGame }))
// the guide's counts (spec §9): their request is guideEvents.test's; here what is counted, and when
const counts = vi.hoisted(() => ({ reportGuideEvent: vi.fn(() => Promise.resolve()) }))
vi.mock('../services/guideEvents', () => counts)

beforeEach(() => {
    counts.reportGuideEvent.mockClear()
    counts.reportGuideEvent.mockImplementation(() => Promise.resolve())
    // jsdom has no canvas (the board's felt)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    vi.spyOn(authService, 'isAuthenticated').mockImplementation(() => auth.isAuthenticated)
    vi.spyOn(authService, 'startGuest').mockResolvedValue({ token: 'g-tok', user: { id: 'g1', username: 'gost_4821', guest: true } } as Awaited<ReturnType<typeof authService.startGuest>>)
    bots.startBotGame.mockReset()
})
afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    auth.isAuthenticated = false
    auth.guest = false
})

const ROLES = [
    { name: 'signed out', isAuthenticated: false, guest: false, line: 'Back to the start page', note: en.guide.exit.menuStart, to: '/' },
    { name: 'a guest', isAuthenticated: true, guest: true, line: 'Back to the start page', note: en.guide.exit.menuStart, to: '/' },
    { name: 'a member', isAuthenticated: true, guest: false, line: 'Back to Home', note: en.guide.exit.menuHome, to: '/dashboard' },
] as const

/** Where the page went: each other route prints its path, and its search (hand 2's guide mode is in it). */
function Where() {
    const { pathname, search } = useLocation()
    return <p>{`at ${pathname + search}`}</p>
}

function renderLearn() {
    return render(
        <MemoryRouter initialEntries={['/learn']}>
            <Routes>
                <Route path="/learn" element={<LearnPage />} />
                <Route path="/" element={<Where />} />
                <Route path="/dashboard" element={<Where />} />
                <Route path="/game/:id" element={<Where />} />
            </Routes>
            <Toaster />
        </MemoryRouter>,
    )
}

const button = (name: string) => screen.getByRole('button', { name })
const panel = () => screen.getByTestId('lesson-panel')
const refusal = () => screen.getByTestId('guide-refusal')
const tableCards = () => screen.queryAllByTestId('trick-card').length
/** Fake timers (clicks then go through fireEvent: testing.tsx's click). */
function fake() {
    vi.useFakeTimers()
}

describe('Škola bele, hand 1 (open beta §7.1, §7.2)', () => {
    test('the intro shows the 32 cards and their values in and out of trump, before the deal', () => {
        renderLearn()
        expect(screen.getByRole('heading', { level: 1, name: 'Bela school' })).toBeInTheDocument()
        expect(screen.getByText(en.guide.intro.lead)).toBeInTheDocument()
        expect(screen.getByText(en.guide.intro.deck)).toBeInTheDocument()
        const table = screen.getByRole('table', { name: 'What each card is worth' })
        const [head, ...rows] = within(table).getAllByRole('row')
        expect([...head.querySelectorAll('th')].map((cell) => cell.textContent)).toEqual(['Card', 'In trump', 'In other suits'])
        expect(rows.map((row) => [...row.querySelectorAll('th, td')].map((cell) => cell.textContent).join(' '))).toEqual([
            'Decko 20 2', '9 14 0', 'As 11 11', '10 10 10', 'Kralj 4 4', 'Baba 3 3', '8 0 0', '7 0 0',
        ])
        expect(screen.getByText(en.guide.intro.trumpNote)).toBeInTheDocument()
        expect(screen.getByText('In trump, highest first: Decko, 9, As, 10, Kralj, Baba, 8, 7.')).toBeInTheDocument()
        expect(screen.getByText('In other suits, highest first: As, 10, Kralj, Baba, Decko, 9, 8, 7.')).toBeInTheDocument()
        expect(screen.getByText(en.guide.intro.lastTrick)).toBeInTheDocument()
        const rules = screen.getByRole('link', { name: 'More in the Rules ›' })
        expect(rules).toHaveAttribute('href', '/rules#rules-cards')
        expect(rules).toHaveAttribute('target', '_blank')
        // a 44-px target, as every standalone link (R4 review, Accessibility)
        expect(rules).toHaveClass('inline-flex', 'min-h-11', 'items-center')
        expect(button('Deal the cards')).toBeInTheDocument()
        expect(button('Exit')).toBeInTheDocument()
        expect(screen.queryByRole('region', { name: 'Game table' })).not.toBeInTheDocument()
        expect(screen.queryByTestId('lesson-panel')).not.toBeInTheDocument()
        expect(document.title).toBe('Bela school · Stiglja')
    })

    test('plays hand 1 on rails with the expected moves to the end of hand 1', async () => {
        fake()
        renderLearn()
        await playHand1({ until: 'padanje' })
        await advance(10_000)
        // the fall, in the panel and as the hand result's tag (spec §1.4 Padanje)
        expect(panel()).toHaveAttribute('data-lesson', 'padanje')
        expect(within(panel()).getByRole('heading', { level: 2, name: 'Fell! You fell.' })).toBeInTheDocument()
        expect(within(screen.getByTestId('hand-result')).getByText('Fell! You fell.')).toBeInTheDocument()
        // the hand result says what is true here: no countdown, the next hand comes
        expect(within(screen.getByTestId('hand-result')).getByText('Next hand shortly')).toBeInTheDocument()
        await playHand1({ from: 'padanje', until: 'foulFound' })
        await advance(10_000)
        expect(panel()).toHaveAttribute('data-lesson', 'foulFound')
        expect(within(screen.getByTestId('hand-result')).getByRole('heading', { name: 'Foul found: Team A takes the hand' })).toBeInTheDocument()
        expect(within(screen.getByTestId('hand-result')).queryByText('Fell! You fell.')).not.toBeInTheDocument()
        await playHand1({ from: 'foulFound' })
        expect(screen.getByRole('heading', { level: 1, name: 'Hand 1 done' })).toBeInTheDocument()
        expect(screen.queryByRole('region', { name: 'Game table' })).not.toBeInTheDocument()
    })

    test('a wrong move at each kind of step is refused with its reason, and the table doesn’t move', async () => {
        fake()
        renderLearn()
        await playHand1({ until: 'mus' })
        await advance(10_000)
        click(button('Call Karo'))
        expect(refusal()).toHaveTextContent(en.guide.refuse.bid)
        expect(panel()).toHaveAttribute('data-lesson', 'mus')
        expect(screen.getByRole('group', { name: 'Your bid' })).toBeInTheDocument()

        await playHand1({ from: 'mus', until: 'followSuit' })
        await advance(10_000)
        expect(tableCards()).toBe(3)
        click(button('7 Herc'))
        expect(refusal()).toHaveTextContent(en.guide.illegal.followSuit)
        click(button('10 Tref'))
        expect(refusal()).toHaveTextContent(en.guide.other.followSuit)
        click(button('Challenge'))
        expect(refusal()).toHaveTextContent(en.guide.refuse.challengeEarly)
        await advance(2000)
        expect(panel()).toHaveAttribute('data-lesson', 'followSuit')
        expect(button('7 Herc')).toBeInTheDocument()
        expect(button('10 Tref')).toBeInTheDocument()
        expect(tableCards()).toBe(3)

        await playHand1({ from: 'followSuit', until: 'bela' })
        await advance(10_000)
        expect(tableCards()).toBe(3)
        click(button('Kralj Herc, highlighted'))
        click(button('Play'))
        expect(refusal()).toHaveTextContent(en.guide.refuse.bela)
        // the prompt stays for the right answer
        expect(button('Play + Bela')).toBeInTheDocument()
        click(button('Baba Herc'))
        expect(refusal()).toHaveTextContent(en.guide.other.bela)
        click(button('Challenge'))
        expect(refusal()).toHaveTextContent(en.guide.refuse.challengeFoul)
        await advance(2000)
        expect(panel()).toHaveAttribute('data-lesson', 'bela')
        expect(button('Kralj Herc, highlighted')).toBeInTheDocument()
        expect(button('Baba Herc')).toBeInTheDocument()
        expect(tableCards()).toBe(3)

        await playHand1({ from: 'bela', until: 'padanje' })
        await advance(10_000)
        click(within(screen.getByTestId('hand-result')).getByRole('button', { name: 'Challenge' }))
        // the hand is over: its 10 seconds are the real time to challenge (Ruling 70)
        expect(refusal()).toHaveTextContent(en.guide.refuse.challengeNow)
        expect(refusal()).toHaveTextContent('Right time: in a real game you\'d challenge now, within 10 seconds. Read this first, then press "Next".')
        await advance(2000)
        expect(panel()).toHaveAttribute('data-lesson', 'padanje')
        expect(within(screen.getByTestId('hand-result')).getByText('Fell! You fell.')).toBeInTheDocument()
    })

    test('Exit says where it goes and goes there: from the intro, the lesson panel and the game menu', async () => {
        for (const role of ROLES) {
            Object.assign(auth, { isAuthenticated: role.isAuthenticated, guest: role.guest })
            const user = userEvent.setup()

            renderLearn()
            expect(button('Exit'), role.name).toHaveAccessibleDescription(role.line)
            expect(screen.getByText(role.line)).toBeVisible()
            await user.click(button('Exit'))
            expect(screen.getByText(`at ${role.to}`), role.name).toBeInTheDocument()
            cleanup()

            renderLearn()
            await user.click(button('Deal the cards'))
            const exit = within(panel()).getByRole('button', { name: 'Exit' })
            expect(exit, role.name).toHaveAccessibleDescription(role.line)
            // off a phone (jsdom's window lays out as a desktop), the line shows beside Exit (spec §7.1)
            expect(within(panel()).getByText(role.line)).not.toHaveClass('sr-only')
            await user.click(exit)
            expect(screen.getByText(`at ${role.to}`), role.name).toBeInTheDocument()
            cleanup()

            renderLearn()
            await user.click(button('Deal the cards'))
            await user.click(button('Game menu'))
            const menu = screen.getByRole('dialog', { name: 'Game menu' })
            expect(within(menu).queryByRole('button', { name: 'Back to home' })).not.toBeInTheDocument()
            expect(within(menu).getByText(role.note)).toBeInTheDocument()
            await user.click(within(menu).getByRole('button', { name: 'Exit' }))
            expect(screen.getByText(`at ${role.to}`), role.name).toBeInTheDocument()
            cleanup()
        }
    })

    test('the end of hand 1 goes on: hand 2, again, or out', async () => {
        // signed out: a guest first (as the landing's Botovi), then the bot game
        fake()
        renderLearn()
        await playHand1()
        expect(screen.getByRole('heading', { level: 1, name: 'Hand 1 done' })).toBeInTheDocument()
        expect(screen.getByText(en.guide.end.learned)).toBeInTheDocument()
        expect(screen.getByText(en.guide.end.next)).toBeInTheDocument()
        expect(screen.getByText(en.guide.end.guest)).toBeInTheDocument()
        expect(button('Exit')).toHaveAccessibleDescription('Back to the start page')
        bots.startBotGame.mockResolvedValue({ gameId: 'g7' })
        click(button('Play hand 2'))
        await advance(0)
        expect(authService.startGuest).toHaveBeenCalledTimes(1)
        expect(authService.startGuest).toHaveBeenCalledWith('en')
        expect(bots.startBotGame).toHaveBeenCalledTimes(1)
        expect(screen.getByText('at /game/g7?guide=1')).toBeInTheDocument()
        cleanup()
        vi.useRealTimers()

        // a member: no guest; a refusal says what happened, the end screen stays; Replay goes back to the intro
        Object.assign(auth, { isAuthenticated: true, guest: false })
        fake()
        renderLearn()
        await playHand1()
        expect(screen.queryByText(en.guide.end.guest)).not.toBeInTheDocument()
        expect(button('Exit')).toHaveAccessibleDescription('Back to Home')
        bots.startBotGame.mockRejectedValue(new ApiError({ message: 'Service unavailable', status: 503 }))
        click(button('Play hand 2'))
        await advance(0)
        expect(authService.startGuest).toHaveBeenCalledTimes(1)
        expect(screen.getByRole('alert')).toHaveTextContent("Bots aren't available right now. Try again later.")
        expect(button('Play hand 2')).toBeEnabled()
        click(button('Replay Bela school'))
        expect(screen.getByRole('heading', { level: 1, name: 'Bela school' })).toBeInTheDocument()
        expect(button('Deal the cards')).toBeInTheDocument()
        cleanup()
        vi.useRealTimers()

        // a guest: the end screen's Exit goes to the start page
        Object.assign(auth, { isAuthenticated: true, guest: true })
        fake()
        renderLearn()
        await playHand1()
        expect(screen.queryByText(en.guide.end.guest)).not.toBeInTheDocument()
        click(button('Exit'))
        expect(screen.getByText('at /')).toBeInTheDocument()
    })

    test('Croatian: the intro, a lesson, a refusal and Nastavi', async () => {
        setLang('hr')
        try {
            renderLearn()
            expect(screen.getByRole('heading', { level: 1, name: 'Škola bele' })).toBeInTheDocument()
            expect(screen.getByText('U adutu, od najjače: Dečko, 9, As, 10, Kralj, Baba, 8, 7.')).toBeInTheDocument()
            expect(button('Izađi')).toHaveAccessibleDescription('Natrag na početnu stranicu')
            fake()
            click(button('Podijeli karte'))
            await advance(1000)
            expect(within(panel()).getByRole('heading', { level: 2, name: 'Licitacija' })).toBeInTheDocument()
            click(within(panel()).getByRole('button', { name: 'Nastavi' }))
            await advance(2000)
            expect(within(panel()).getByRole('heading', { level: 2, name: 'Mus! Moraš zvati.' })).toBeInTheDocument()
            expect(within(panel()).getByText('Pritisni „Zovi Herc”.')).toBeInTheDocument()
            click(button('Zovi Herc'))
            await advance(1000)
            expect(within(panel()).getByRole('heading', { level: 2, name: 'Zvanja' })).toBeInTheDocument()
            click(within(panel()).getByRole('button', { name: 'Nastavi' }))
            await advance(10_000)
            expect(within(panel()).getByRole('heading', { level: 2, name: 'Odgovori na boju' })).toBeInTheDocument()
            expect(within(panel()).getByText('Baci 9 Tref.')).toBeInTheDocument()
            expect(button('9 Tref, označeno')).toBeInTheDocument()
            click(button('7 Herc'))
            expect(refusal()).toHaveTextContent('Imaš Tref, pa moraš odgovoriti na Tref.')
            cleanup()
        } finally {
            setLang('en')
        }
    })

    test('one live region, outside each lesson’s panel, says each lesson and what to do (Ruling 69)', async () => {
        fake()
        renderLearn()
        click(button('Deal the cards'))
        const said = screen.getByTestId('guide-said')
        expect(said).toHaveAttribute('aria-live', 'polite')
        expect(said).toHaveClass('sr-only')
        expect(panel()).not.toContainElement(said)
        expect(said.textContent).toBe('')
        await advance(1000)
        expect(said.textContent).toBe('Bidding. Next')
        click(within(panel()).getByRole('button', { name: 'Next' }))
        // while the table moves on: nothing new to say
        expect(said.textContent).toBe('')
        await advance(2000)
        // the same region, now the next lesson
        expect(screen.getByTestId('guide-said')).toBe(said)
        expect(said.textContent).toBe('You must call trump. Press "Call Herc".')
        await playHand1({ from: 'mus', until: 'followSuit' })
        await advance(10_000)
        expect(said.textContent).toBe('Follow suit. Play 9 Tref.')
    })

    test('on a phone, lessons start open beside the trick, the title folds them, and Exit’s line is for screen readers', async () => {
        vi.stubGlobal('innerWidth', 375)
        vi.stubGlobal('innerHeight', 812)
        try {
            fake()
            renderLearn()
            await playHand1({ until: 'followSuit' })
            await advance(10_000)
            const fold = within(panel()).getByRole('button', { name: 'Follow suit' })
            expect(fold).toHaveAttribute('aria-expanded', 'true')
            expect(within(panel()).getByText(en.guide.lessons.followSuit.body)).toBeVisible()
            const exit = within(panel()).getByRole('button', { name: 'Exit' })
            expect(exit).toHaveAccessibleDescription('Back to the start page')
            expect(within(panel()).getByText('Back to the start page')).toHaveClass('sr-only')
            click(fold)
            expect(fold).toHaveAttribute('aria-expanded', 'false')
            expect(within(panel()).getByText(en.guide.lessons.followSuit.body)).not.toBeVisible()
            expect(within(panel()).getByText('Play 9 Tref.')).toBeVisible()
        } finally {
            vi.unstubAllGlobals()
        }
    })

    test('each lesson links its Rules section in a new tab', async () => {
        fake()
        renderLearn()
        await playHand1({ until: 'mus' })
        await advance(10_000)
        const bidding = within(panel()).getByRole('link', { name: 'More in the Rules ›' })
        expect(bidding).toHaveAttribute('href', '/rules#rules-bidding')
        expect(bidding).toHaveAttribute('target', '_blank')
        await playHand1({ from: 'mus', until: 'padanje' })
        await advance(10_000)
        expect(within(panel()).getByRole('link', { name: 'More in the Rules ›' })).toHaveAttribute('href', '/rules#rules-scoring')
    })
})

describe("the guide's counts (open beta spec §9)", () => {
    const calls = () => counts.reportGuideEvent.mock.calls

    test('the guide counts its start at the deal and hand 1 at its end, once each per run (spec §9)', async () => {
        fake()
        renderLearn()
        // opening the guide isn't starting it
        expect(calls()).toEqual([])
        click(button('Deal the cards'))
        expect(calls()).toEqual([['started']])
        await playHand1({ from: LESSONS[0] })
        expect(screen.getByRole('heading', { level: 1, name: 'Hand 1 done' })).toBeInTheDocument()
        expect(calls()).toEqual([['started'], ['hand1']])
        // Replay: the intro again, and nothing counted until the next deal starts a new run
        click(button('Replay Bela school'))
        expect(screen.getByRole('heading', { level: 1, name: 'Bela school' })).toBeInTheDocument()
        expect(calls()).toHaveLength(2)
        click(button('Deal the cards'))
        expect(calls()).toEqual([['started'], ['hand1'], ['started']])
        await advance(1000)
        click(within(panel()).getByRole('button', { name: 'Exit' }))
        expect(screen.getByText('at /')).toBeInTheDocument()
        expect(calls()).toHaveLength(3)
    })

    test('opening the guide, and leaving from the intro, counts nothing', async () => {
        const user = userEvent.setup()
        renderLearn()
        await user.click(button('Exit'))
        expect(screen.getByText('at /')).toBeInTheDocument()
        expect(calls()).toEqual([])
    })

    test('a count that never answers holds nothing up', async () => {
        counts.reportGuideEvent.mockImplementation(() => new Promise(() => {}))
        fake()
        renderLearn()
        await playHand1()
        expect(screen.getByRole('heading', { level: 1, name: 'Hand 1 done' })).toBeInTheDocument()
        expect(calls()).toEqual([['started'], ['hand1']])
        // the end screen's way on is the learner's own request: no count
        bots.startBotGame.mockResolvedValue({ gameId: 'g7', lobbyId: 'l7' })
        click(button('Play hand 2'))
        await advance(0)
        expect(screen.getByText('at /game/g7?guide=1')).toBeInTheDocument()
        expect(calls()).toHaveLength(2)
    })
})

describe('the hand-2 intro (open beta §7.3, §8)', () => {
    test('the hand-2 intro says what changes and that the guide ends with the hand', async () => {
        fake()
        renderLearn()
        await playHand1()
        expect(screen.getByRole('heading', { level: 1, name: 'Hand 1 done' })).toBeInTheDocument()
        expect(screen.getByText(en.guide.end.hints)).toBeInTheDocument()
        expect(screen.getByText(en.guide.end.after)).toBeInTheDocument()
        // one primary: Play hand 2; Replay and Exit stay
        expect(button('Play hand 2')).toHaveClass('ui-btn--primary')
        expect(button('Replay Bela school')).toHaveClass('ui-btn--secondary')
        expect(button('Exit')).toBeInTheDocument()
    })

    test('Play hand 2 opens the game in guide mode', async () => {
        bots.startBotGame.mockResolvedValue({ gameId: 'g7', lobbyId: 'l7' })
        for (const member of [false, true]) {
            Object.assign(auth, { isAuthenticated: member, guest: false })
            vi.mocked(authService.startGuest).mockClear()
            bots.startBotGame.mockClear()
            fake()
            renderLearn()
            await playHand1()
            click(button('Play hand 2'))
            await advance(0)
            expect(authService.startGuest, member ? 'a member' : 'signed out').toHaveBeenCalledTimes(member ? 0 : 1)
            expect(bots.startBotGame).toHaveBeenCalledTimes(1)
            expect(screen.getByText('at /game/g7?guide=1')).toBeInTheDocument()
            cleanup()
            vi.useRealTimers()
        }
    })

    test('a failed start keeps a way on (spec §8): the limit, the bots away, a guest that can’t be made, and a game already running', async () => {
        const stillThere = (line: string) => {
            expect(screen.getByRole('alert'), line).toHaveTextContent(line)
            expect(button('Play hand 2'), line).toBeEnabled()
            expect(button('Replay Bela school'), line).toBeEnabled()
            expect(button('Exit'), line).toBeEnabled()
        }
        // signed out: each refusal says what happened, and Play hand 2 tries again
        fake()
        renderLearn()
        await playHand1()
        bots.startBotGame
            .mockRejectedValueOnce(new ApiError({ status: 429, message: 'Too many requests, try again later', code: 'RATE_LIMITED' }))
            .mockRejectedValueOnce(new ApiError({ status: 503, message: 'Service Unavailable' }))
        click(button('Play hand 2'))
        await advance(0)
        stillThere('Too many tries. Wait a little, then try again.')
        click(button('Play hand 2'))
        await advance(0)
        stillThere("Bots aren't available right now. Try again later.")
        // the guest can't be made: the same limit's line
        vi.mocked(authService.startGuest).mockRejectedValueOnce(new ApiError({ status: 429, message: 'Too many requests, try again later', code: 'RATE_LIMITED' }))
        click(button('Play hand 2'))
        await advance(0)
        stillThere('Too many tries. Wait a little, then try again.')
        expect(bots.startBotGame).toHaveBeenCalledTimes(2)
        // a retry starts the game
        bots.startBotGame.mockResolvedValueOnce({ gameId: 'g7', lobbyId: 'l7' })
        click(button('Play hand 2'))
        await advance(0)
        expect(screen.getByText('at /game/g7?guide=1')).toBeInTheDocument()
        cleanup()
        vi.useRealTimers()

        // a member with a game running: the way back to it, as a plain game; nothing is asked before the refusal
        Object.assign(auth, { isAuthenticated: true, guest: false })
        const active = vi.spyOn(userService, 'getActiveGame').mockResolvedValue('g-old')
        fake()
        renderLearn()
        await playHand1()
        expect(active).not.toHaveBeenCalled()
        expect(screen.queryByRole('button', { name: 'Return to your game' })).not.toBeInTheDocument()
        bots.startBotGame.mockRejectedValueOnce(new ApiError({ status: 409, message: 'You already have a game in progress', code: 'ALREADY_IN_GAME' }))
        click(button('Play hand 2'))
        await advance(0)
        stillThere('You already have a game in progress. Go back to it first.')
        expect(active).toHaveBeenCalledTimes(1)
        // the likely next step is the running game: it becomes the main button, and Play hand 2 a smaller one (spec §8)
        expect(button('Return to your game')).toHaveClass('ui-btn--primary')
        expect(button('Play hand 2')).toHaveClass('ui-btn--secondary')
        expect(screen.getAllByRole('button').filter((one) => one.classList.contains('ui-btn--primary'))).toEqual([button('Return to your game')])
        click(button('Return to your game'))
        expect(screen.getByText('at /game/g-old')).toBeInTheDocument()
    })

    test('Croatian: the hand-2 intro', async () => {
        fake()
        renderLearn()
        await playHand1()
        try {
            act(() => setLang('hr'))
            expect(screen.getByText('Ovaj put su karte nasumične, a potezi su tvoji. Kad si na redu, označene su karte koje smiješ baciti, a „Zašto?” kaže zašto baš one. Prije nedopuštene karte dobit ćeš upozorenje, ali odluka je tvoja.')).toBeInTheDocument()
            expect(screen.getByText('Škola bele završava s tim dijeljenjem, a zatim biraš kako dalje.')).toBeInTheDocument()
            expect(button('Igraj drugo dijeljenje')).toBeInTheDocument()
            cleanup()
        } finally {
            setLang('en')
        }
    })
})
