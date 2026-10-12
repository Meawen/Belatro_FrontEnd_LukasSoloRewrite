import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { RulesPage } from './RulesPage'

// signed out: the frame's active-game banner asks nothing
const auth = vi.hoisted(() => ({ isLoading: false }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false, token: null, isLoading: auth.isLoading }) }))

afterEach(() => {
    vi.unstubAllGlobals()
    auth.isLoading = false
})

function renderRules(path = '/rules') {
    return render(<MemoryRouter initialEntries={[path]}><RulesPage /></MemoryRouter>)
}

/** An element whose own text (not its children's) is exactly `text`, whitespace collapsed. */
const ownText = (text: string) => (_: string, element: Element | null) =>
    !!element && [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join('').replace(/\s+/g, ' ').trim() === text

// Every sentence of the full rules, word for word: today's page with the primer's three edits (ranks spec §9.2)
const KEPT = [
    'Stiglja is Belot for four players in two teams of two, Team A and Team B; partners sit opposite each other. The first team to reach 1001 points wins.',
    'Belot uses 32 cards: 7, 8, 9, 10, Decko (jack), Baba (queen), Kralj (king) and As (ace), in four suits: Herc (hearts), Karo (diamonds), Pik (spades) and Tref (clubs).',
    'Order, highest first', 'Card points',
    'Trump suit: Decko, 9, As, 10, Kralj, Baba, 8, 7', 'Decko 20, 9 14, As 11, 10 10, Kralj 4, Baba 3, 8 and 7 nothing',
    'Other suits: As, 10, Kralj, Baba, Decko, 9, 8, 7', 'As 11, 10 10, Kralj 4, Baba 3, Decko 2, 9, 8 and 7 nothing',
    'The last trick of a hand is worth 10 more, so a hand holds 162 points in cards.',
    'The first dealer is picked at random; after each hand the deal moves on to the next player.',
    'Everyone gets six cards. Starting with the player after the dealer, each player either names a trump suit or passes.',
    'The first player to name a suit makes it trump, and their team has to win the hand (see Scoring a hand).',
    'If the other three pass, the dealer must name trump: the dealer cannot pass.',
    'Then everyone gets two more cards, eight in all.',
    'The player after the dealer leads the first trick; whoever wins a trick leads the next. A trick goes to the highest trump in it or, if it has none, to the highest card of the suit that was led.',
    'If you have a card of the suit that was led, you must play one.',
    'If nobody has trumped the trick yet, you must beat the best card of that suit on the table if you can.',
    'Once someone has trumped (cut) the trick, you may play any card of the suit that was led.',
    'If trump was led, you must play a higher trump than the best one on the table if you can.',
    'If you have no card of the suit that was led, you must play a trump: a higher trump than any already in the trick, if you can.',
    'If you have neither, play any card.',
    'Declarations are counted for you when trump is named; you do not announce them.',
    'A sequence is three or more cards in a row of one suit, in the order 7, 8, 9, 10, Decko, Baba, Kralj, As. Three in a row score 20, four score 50, five or more score 100. Each player counts only their best sequence.',
    'Four of a kind: four jacks score 200, four 9s 150, and four aces, tens, kings or queens 100. Four 7s or four 8s score nothing.',
    'Only one team scores its sequences: the team holding the best one. A sequence worth more beats one worth less; between sequences worth the same, the higher top card wins (7 lowest, As highest); with the same top card, the one in trump wins; if they are still equal, the player who comes first after the dealer wins. Four of a kind is compared separately: jacks beat 9s, which beat the 100-point fours, and among those As beats 10, 10 beats Kralj and Kralj beats Baba. The winning team scores all its declarations of that kind.',
    'A team that wins no trick in a hand loses its declarations and its bela for that hand.',
    'Bela is the Kralj and the Baba of trump in one hand, worth 20. It is not counted for you: when you play the first of the two, choose Play + Bela.',
    'Each team adds up the card points of the tricks it won, its declarations and its bela.',
    'The team that named trump must score more than the other team. If it scores the same or less, it falls (padanje): the other team gets all the points of the hand.',
    'A team that wins all eight tricks (capot) gets 90 more points.',
    "When a hand ends with a team at 1001 points or more, the team with more points wins once the hand's 10 seconds for challenges are over. If both are level, another hand is played.",
    'The game does not stop you from playing a card the rules forbid; it notes it as a foul. If you think an opponent played an illegal card this hand, press Challenge, during the hand or in the 10 seconds after it ends. That includes the hand that takes a team past 1001: the game ends only when its 10 seconds are over.',
    "If the other team fouled this hand (even if yours did too), the challenge succeeds: your team wins the whole hand, 162 points plus your team's declarations and bela, and the other team scores nothing for it. A new hand is dealt, unless the new score ends the game.",
    'If nobody fouled, or only your own team did, the challenge fails and the score does not change.',
    'Each player has one challenge per hand; a wrong challenge uses it up for that hand.',
    'Which cards were illegal shows in Match Details only once the game has finished with a winner.',
    'Casual: create or join a lobby (a private lobby needs its password), pick teams, and the host starts the game. Casual games never change your rating.',
    'Each turn has 30 seconds. If a player does not act in time, the server plays for them: it passes in the bidding (or names a random trump for a dealer who must call), or plays a legal card.',
    'Bidding, playing or challenging yourself resets your count of missed turns.',
    'If both players of the other team are missing turns too, the game is abandoned with no result.',
    'If you leave the table, the Return to your game banner takes you back to your seat.',
    'When a ranked match is found, you can press Decline in the Match Found dialog, as long as no bid has been made and no more than 30 seconds have passed. The game is called off with no rating change, the other three go back into the queue in their places, and you cannot queue again for 2 minutes.',
    'After a game that ends with a winner, Play again asks all four players for a rematch. When all four agree within 2 minutes, a new game starts with the same teams. A rematch is always casual, even after a ranked game. If anyone leaves, there is no rematch.',
]

const EDITED = [
    "Ranked: press Find Match on the Play Game page; you need a confirmed email address. Stiglja puts the four closest-rated waiting players together; the longer they wait, the wider the rating gap it accepts, up to 1600 points between the highest and the lowest. Your rating moves with your team's result: a win raises it and a loss lowers it, by more when the other team was rated higher, by more for a bigger final score margin, and by more in your first ranked games. A very narrow win can leave the shown number unchanged.",
    "After 5 missed turns in a row by the same player, the game ends. A casual game is abandoned, with no result. In a ranked game the absent player's team loses, the absent player's rating drops as for a 1001–0 defeat, their partner's by half a normal loss, and the winners gain as for a normal win.",
]

describe('the full rules (ranks spec §9.2)', () => {
    test('every other sentence is kept, word for word (F-1)', () => {
        renderRules()
        for (const text of KEPT) expect(screen.getAllByText(ownText(text)).length, text).toBeGreaterThan(0)
    })

    test('the three edits are there verbatim, and the old claims are gone (F-2)', () => {
        const { container } = renderRules()
        for (const text of EDITED) expect(screen.getByText(ownText(text))).toBeInTheDocument()
        expect(container.textContent).not.toContain('up to 400 points')
        expect(container.textContent).not.toContain('by at least 1 point')
        expect(container.textContent).not.toContain('ratings change as for any other result')
    })

    test('a Ranks section right after "Casual and ranked games": seven rows in order, then the placement sentence (F-3)', () => {
        renderRules()
        const full = document.getElementById('full-rules')!
        const headings = within(full).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
        expect(headings.indexOf('Ranks')).toBe(headings.indexOf('Casual and ranked games') + 1)
        const table = screen.getByRole('table', { name: 'Ranks' })
        const rows = within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))
        expect(rows).toEqual([
            ['Cucek', 'fewer than 10 ranked games', 'Čeka pod stolom.'],
            ['Dečec', 'below 1000', 'Bu se navčil.'],
            ['Fakin', '1000', "Fakin, al' zna nekaj."],
            ['Pajdaš', '1200', 'Dober pajdaš.'],
            ['Gospon', '1400', 'Gospon se ne žuri.'],
            ['Majster', '1600', 'Ne zgubi ni štiha.'],
            ['Kajkavac', '1800', 'Zna kaj je kaj.'],
        ])
        expect(screen.getByText("Everyone starts at 1200. Your first 10 ranked games are placement: you are Cucek until they're played.")).toBeInTheDocument()
    })

    test('the full rules wait behind a closed disclosure, "Full rules" (D-10)', () => {
        renderRules()
        const details = document.getElementById('full-rules') as HTMLDetailsElement
        expect(details.tagName).toBe('DETAILS')
        expect(details.open).toBe(false)
        expect(within(details.querySelector('summary')!).getByRole('heading', { level: 2, name: 'Full rules' })).toBeInTheDocument()
    })

    test('a page opened at one of its sections opens the disclosure (F-4)', () => {
        renderRules('/rules#rules-ranks')
        expect((document.getElementById('full-rules') as HTMLDetailsElement).open).toBe(true)
    })

    // owner 2026-10-11: the page waits for the session (it picks the shell or the public frame); a link still lands
    test('a link to a section still scrolls there when the page first waits for the session', () => {
        const scroll = vi.fn()
        Element.prototype.scrollIntoView = scroll
        try {
            auth.isLoading = true
            const { rerender } = renderRules('/rules#rules-ranks')
            auth.isLoading = false
            rerender(<MemoryRouter initialEntries={['/rules#rules-ranks']}><RulesPage /></MemoryRouter>)
            expect(scroll).toHaveBeenCalledTimes(1)
            expect(scroll.mock.contexts[0]).toBe(document.getElementById('rules-ranks'))
        } finally {
            delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
        }
    })
})

describe('the visual guide (ranks spec §9.1)', () => {
    test('"How to play" and its eight steps, signed out, with no API request (G-1)', () => {
        const fetch = vi.fn()
        vi.stubGlobal('fetch', fetch)
        renderRules()
        expect(screen.getByRole('heading', { level: 2, name: 'How to play' })).toBeInTheDocument()
        const steps = within(screen.getByRole('list', { name: 'How to play' })).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
        expect(steps).toEqual(['Two teams', '32 cards, two orders', 'Name trump or pass', 'Follow suit', 'Declarations and bela', 'Win the hand', 'Challenge a foul', 'Ranks'])
        expect(fetch).not.toHaveBeenCalled()
    })

    test('the card order switches between the other suits and trump, with the points under each card (G-2)', async () => {
        const user = userEvent.setup()
        renderRules()
        const order = () => within(screen.getByRole('list', { name: /^Herc .*highest first$/ })).getAllByRole('listitem')
        const read = () => order().map((item) => [within(item).getByRole('img').getAttribute('alt'), within(item).getByTestId('points').textContent])
        expect(read()).toEqual([['As Herc', '11'], ['10 Herc', '10'], ['Kralj Herc', '4'], ['Baba Herc', '3'], ['Decko Herc', '2'], ['9 Herc', '0'], ['8 Herc', '0'], ['7 Herc', '0']])
        await user.click(screen.getByRole('button', { name: 'Trump' }))
        expect(screen.getByRole('button', { name: 'Trump' })).toHaveAttribute('aria-pressed', 'true')
        expect(read()).toEqual([['Decko Herc', '20'], ['9 Herc', '14'], ['As Herc', '11'], ['10 Herc', '10'], ['Kralj Herc', '4'], ['Baba Herc', '3'], ['8 Herc', '0'], ['7 Herc', '0']])
        await user.click(screen.getByRole('button', { name: 'Other suits' }))
        expect(read()[0]).toEqual(['As Herc', '11'])
    })

    test('tapping a card in the trick says whether it may be played, and why (G-3)', async () => {
        const user = userEvent.setup()
        renderRules()
        const verdict = screen.getByTestId('follow-verdict')
        expect(verdict).toHaveAttribute('aria-live', 'polite')
        expect(verdict).toHaveTextContent('Tap a card to see if you may play it.')
        await user.click(screen.getByRole('button', { name: 'Kralj Karo' }))
        expect(verdict).toHaveTextContent('Yes: it follows suit and beats the 9.')
        expect(screen.getByRole('button', { name: 'Kralj Karo' })).toHaveAttribute('aria-pressed', 'true')
        await user.click(screen.getByRole('button', { name: '7 Karo' }))
        expect(verdict).toHaveTextContent('Not this one: you can beat the 9 with your Kralj, so you must.')
        await user.click(screen.getByRole('button', { name: 'Decko Herc' }))
        expect(verdict).toHaveTextContent('Not this one: you have Karo, so you must follow suit before you trump.')
        expect(screen.getByRole('button', { name: 'Kralj Karo' })).toHaveAttribute('aria-pressed', 'false')
        await user.click(screen.getByRole('button', { name: 'As Pik' }))
        expect(verdict).toHaveTextContent('Not this one: you have Karo, so you must follow suit.')
    })

    test('every step\'s "Full rule ›" opens the disclosure at a section that exists (G-4)', async () => {
        const user = userEvent.setup()
        renderRules()
        const links = screen.getAllByRole('link', { name: 'Full rule ›' })
        expect(links).toHaveLength(8)
        for (const link of links) {
            const id = link.getAttribute('href')!.slice(1)
            expect(document.getElementById(id), id).not.toBeNull()
        }
        await user.click(links[7])
        expect((document.getElementById('full-rules') as HTMLDetailsElement).open).toBe(true)
    })

    test('the ranks step shows the seven ranks in order', () => {
        renderRules()
        const guide = screen.getByRole('list', { name: 'How to play' })
        const step = within(guide).getByRole('heading', { level: 3, name: 'Ranks' })
        const item = step.closest('li')!
        expect([...item.querySelectorAll('[data-rank]')].map((el) => el.getAttribute('data-rank'))).toEqual(['CUCEK', 'DECEC', 'FAKIN', 'PAJDAS', 'GOSPON', 'MAJSTER', 'KAJKAVAC'])
    })
})
