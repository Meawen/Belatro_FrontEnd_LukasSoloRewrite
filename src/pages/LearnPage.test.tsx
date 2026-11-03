import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { LearnPage } from './LearnPage'
import { advance, click, playHand1 } from '../guide/testing'
import { authService } from '../services/authService'
import { ApiError } from '../services/api'
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

beforeEach(() => {
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

/** Where the page went: each other route prints its path. */
function Where() {
    return <p>{`at ${useLocation().pathname}`}</p>
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
        // from the foul on, a challenge would be right: the line says so (Ruling 69)
        expect(refusal()).toHaveTextContent(en.guide.refuse.challengeFoul)
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
        expect(screen.getByText('at /game/g7')).toBeInTheDocument()
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
            expect(button('9 Tref, istaknuto')).toBeInTheDocument()
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
