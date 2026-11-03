import { describe, test, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import hand1 from '../../guide/hand1.recording.json'
import { stepsOf, type LessonKey, type RefusalKind } from '../../guide/script'
import { LessonPanel } from './LessonPanel'
import { en } from '../../i18n/catalog/en'

// Škola bele's lesson panel (open beta §7.2) in the board's coach slot: on a phone the slot holds little while the bid
// panel or the HUD's Challenge shows, so what to do and why a move was refused come first, under the title

const { steps } = stepsOf(hand1)
const stepOf = (lesson: LessonKey) => steps.find((step) => step.lesson === lesson)!

function show(lesson: LessonKey | null, { ready = true, refusal = null as RefusalKind | null, member = false, folded = false, container = undefined as HTMLElement | undefined } = {}) {
    const onNext = vi.fn()
    const onExit = vi.fn()
    const { unmount } = render(
        <LessonPanel
            step={lesson ? stepOf(lesson) : null}
            ready={ready}
            refusal={refusal}
            onNext={onNext}
            exitLine={member ? en.guide.exit.home : en.guide.exit.start}
            onExit={onExit}
            folded={folded}
        />,
        container ? { container } : undefined,
    )
    return { panel: screen.getByTestId('lesson-panel'), onNext, onExit, unmount }
}

/** Each element comes after the one before it in the document. */
function inOrder(...elements: HTMLElement[]) {
    elements.slice(1).forEach((element, i) => {
        expect(elements[i].compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING, `${elements[i].textContent} → ${element.textContent}`).toBeTruthy()
    })
}

describe('LessonPanel (open beta §7.2)', () => {
    test('the do line and the refusal come first, right under the title, before the lesson; Exit sits beside the title', async () => {
        const user = userEvent.setup()
        const { panel, onExit } = show('mus', { refusal: 'bid' })
        expect(panel).toHaveAttribute('data-lesson', 'mus')
        const title = within(panel).getByRole('heading', { level: 2, name: 'You must call trump.' })
        const doLine = within(panel).getByText('Press "Call Herc".')
        const refusal = within(panel).getByTestId('guide-refusal')
        expect(refusal).toHaveTextContent(en.guide.refuse.bid)
        const body = within(panel).getByText(en.guide.lessons.mus.body)
        const rules = within(panel).getByRole('link', { name: 'More in the Rules ›' })
        inOrder(title, doLine, refusal, body, rules)
        // Exit in the title's row, saying where it goes
        const exit = within(panel).getByRole('button', { name: 'Exit' })
        expect(exit.parentElement).toBe(title.parentElement)
        expect(exit).toHaveAccessibleDescription('Back to the start page')
        await user.click(exit)
        expect(onExit).toHaveBeenCalledTimes(1)
        // the Rules section in a new tab, so the guide keeps its place (US-23)
        expect(rules).toHaveAttribute('href', '/rules#rules-bidding')
        expect(rules).toHaveAttribute('target', '_blank')
        expect(rules).toHaveAttribute('rel', 'noopener noreferrer')
    })

    test('a stop: Next comes first too; it says Next, never Pass; a member’s Exit goes Home', async () => {
        const user = userEvent.setup()
        const { panel, onNext } = show('dalje', { member: true })
        const title = within(panel).getByRole('heading', { level: 2, name: 'Bidding' })
        const next = within(panel).getByRole('button', { name: 'Next' })
        inOrder(title, next, within(panel).getByText(en.guide.lessons.dalje.body))
        expect(within(panel).queryByRole('button', { name: 'Pass' })).not.toBeInTheDocument()
        expect(within(panel).getByRole('button', { name: 'Exit' })).toHaveAccessibleDescription('Back to Home')
        await user.click(next)
        expect(onNext).toHaveBeenCalledTimes(1)
    })

    test('the lesson folds to its title and do line (the table under it shows), and opens again', async () => {
        const user = userEvent.setup()
        const { panel } = show('followSuit', { refusal: 'illegal' })
        const fold = within(panel).getByRole('button', { name: 'Follow suit' })
        expect(fold).toHaveAttribute('aria-expanded', 'true')
        await user.click(fold)
        expect(fold).toHaveAttribute('aria-expanded', 'false')
        expect(within(panel).queryByText(en.guide.lessons.followSuit.body)).not.toBeInTheDocument()
        expect(within(panel).queryByRole('link', { name: 'More in the Rules ›' })).not.toBeInTheDocument()
        // what to do and why the last move was refused stay
        expect(within(panel).getByText('Play 9 Tref.')).toBeInTheDocument()
        expect(within(panel).getByTestId('guide-refusal')).toHaveTextContent(en.guide.illegal.followSuit)
        expect(within(panel).getByRole('button', { name: 'Exit' })).toBeInTheDocument()
        await user.click(fold)
        expect(fold).toHaveAttribute('aria-expanded', 'true')
        expect(within(panel).getByText(en.guide.lessons.followSuit.body)).toBeInTheDocument()
    })

    test('it can start folded (a phone, where the lesson would cover the card being answered); the title opens it', async () => {
        const user = userEvent.setup()
        const { panel } = show('followTrump', { folded: true })
        const fold = within(panel).getByRole('button', { name: 'Trump on trump' })
        expect(fold).toHaveAttribute('aria-expanded', 'false')
        expect(within(panel).getByText('Play Baba Herc.')).toBeInTheDocument()
        expect(within(panel).queryByText(en.guide.lessons.followTrump.body)).not.toBeInTheDocument()
        await user.click(fold)
        expect(within(panel).getByText(en.guide.lessons.followTrump.body)).toBeInTheDocument()
    })

    test('a new lesson starts at the top of the slot, whatever the last one scrolled to', () => {
        // the board's coach slot scrolls, and outlives each lesson (the page keys the panel by step)
        const slot = document.body.appendChild(document.createElement('div'))
        const scrolled: number[] = []
        Object.defineProperty(slot, 'scrollTop', { configurable: true, get: () => 32, set: (top: number) => scrolled.push(top) })
        show('followSuit', { container: slot })
        expect(scrolled).toEqual([0])
    })

    test('while the table moves: the lesson stays, with no do line and no Next', () => {
        const { panel } = show('mus', { ready: false })
        expect(within(panel).getByRole('heading', { level: 2, name: 'You must call trump.' })).toBeInTheDocument()
        expect(within(panel).queryByText('Press "Call Herc".')).not.toBeInTheDocument()
        expect(within(panel).queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
        expect(within(panel).getByTestId('guide-refusal').textContent).toBe('')
    })

    test('before the first lesson: the dealing line and Exit only', () => {
        const { panel } = show(null, { ready: false })
        expect(panel).toHaveAttribute('data-lesson', '')
        expect(within(panel).getByRole('heading', { level: 2, name: 'Dealing…' })).toBeInTheDocument()
        expect(within(panel).getByRole('button', { name: 'Exit' })).toBeInTheDocument()
        expect(within(panel).queryByRole('link')).not.toBeInTheDocument()
    })

    test('each refusal says its own reason: the rule a card breaks, why the lesson plays another, or the step’s line', () => {
        const cases: [LessonKey, RefusalKind, string][] = [
            ['followSuit', 'illegal', en.guide.illegal.followSuit],
            ['followSuit', 'otherCard', en.guide.other.followSuit],
            // a lesson with no line of its own for a kind: the general one
            ['lead', 'illegal', en.guide.refuse.card],
            ['followTrump', 'otherCard', en.guide.refuse.card],
            ['bela', 'bela', en.guide.refuse.bela],
            ['mus', 'pass', en.guide.refuse.pass],
            ['followSuit', 'challengeEarly', en.guide.refuse.challengeEarly],
            ['bela', 'challengeFoul', en.guide.refuse.challengeFoul],
            ['padanje', 'readFirst', en.guide.refuse.readFirst],
        ]
        for (const [lesson, refusal, line] of cases) {
            const { panel, unmount } = show(lesson, { refusal })
            expect(within(panel).getByTestId('guide-refusal'), `${lesson} ${refusal}`).toHaveTextContent(line)
            unmount()
        }
    })
})
