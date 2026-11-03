import { describe, test, expect, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import hand1 from '../../guide/hand1.recording.json'
import { stepsOf, type LessonKey, type RefusalKind } from '../../guide/script'
import { LessonPanel } from './LessonPanel'
import { en } from '../../i18n/catalog/en'

// Škola bele's lesson panel (open beta §7.2) in the board's coach slot: on a phone the slot holds little while the bid
// panel or the HUD's Challenge shows, so what to do and why a move was refused come first, under the title

const { steps } = stepsOf(hand1)
const stepOf = (lesson: LessonKey) => steps.find((step) => step.lesson === lesson)!

function show(lesson: LessonKey | null, { ready = true, refusal = null as RefusalKind | null, member = false, phone = false, refused = 0, container = undefined as HTMLElement | undefined } = {}) {
    const onNext = vi.fn()
    const onExit = vi.fn()
    const panelFor = (count: number) => (
        <LessonPanel
            step={lesson ? stepOf(lesson) : null}
            ready={ready}
            refusal={refusal}
            refused={count}
            onNext={onNext}
            exitLine={member ? en.guide.exit.home : en.guide.exit.start}
            onExit={onExit}
            phone={phone}
        />
    )
    const { unmount, rerender } = render(panelFor(refused), container ? { container } : undefined)
    return { panel: screen.getByTestId('lesson-panel'), onNext, onExit, unmount, refuseAgain: (count: number) => rerender(panelFor(count)) }
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
        // the do line is said by the page's own live region (a panel per lesson can't announce what it mounts with)
        expect(doLine.closest('[aria-live]')).toBeNull()
        // Exit in the title's row, which stays at the top of the slot when a refusal scrolls it (Ruling 69)
        const exit = within(panel).getByRole('button', { name: 'Exit' })
        expect(title.parentElement).toContainElement(exit)
        expect(title.parentElement).toHaveClass('sticky')
        // off a phone it says where it goes, visibly (spec §7.1)
        expect(exit).toHaveAccessibleDescription('Back to the start page')
        expect(within(panel).getByText('Back to the start page')).not.toHaveClass('sr-only')
        await user.click(exit)
        expect(onExit).toHaveBeenCalledTimes(1)
        // the Rules section in a new tab, so the guide keeps its place (US-23)
        expect(rules).toHaveAttribute('href', '/rules#rules-bidding')
        expect(rules).toHaveAttribute('target', '_blank')
        expect(rules).toHaveAttribute('rel', 'noopener noreferrer')
        // a 44-px target, as every standalone link (R4 review, Accessibility)
        expect(rules).toHaveClass('inline-flex', 'min-h-11', 'items-center')
    })

    test('a stop: Next comes first too; it says Next, never Pass; a member’s Exit goes Home', async () => {
        const user = userEvent.setup()
        const { panel, onNext } = show('dalje', { member: true })
        const title = within(panel).getByRole('heading', { level: 2, name: 'Bidding' })
        const next = within(panel).getByRole('button', { name: 'Next' })
        inOrder(title, next, within(panel).getByText(en.guide.lessons.dalje.body))
        expect(within(panel).queryByRole('button', { name: 'Pass' })).not.toBeInTheDocument()
        expect(within(panel).getByRole('button', { name: 'Exit' })).toHaveAccessibleDescription('Back to Home')
        expect(within(panel).getByText('Back to Home')).not.toHaveClass('sr-only')
        await user.click(next)
        expect(onNext).toHaveBeenCalledTimes(1)
    })

    test('the lesson folds to its title and do line (the table under it shows), and opens again', async () => {
        const user = userEvent.setup()
        const { panel } = show('followSuit', { refusal: 'illegal' })
        const fold = within(panel).getByRole('button', { name: 'Follow suit' })
        expect(fold).toHaveAttribute('aria-expanded', 'true')
        const lesson = document.getElementById(fold.getAttribute('aria-controls')!)!
        expect(lesson).toContainElement(within(panel).getByText(en.guide.lessons.followSuit.body))
        await user.click(fold)
        expect(fold).toHaveAttribute('aria-expanded', 'false')
        // still there for aria-controls, hidden (Ruling 69)
        expect(document.getElementById(fold.getAttribute('aria-controls')!)).toBe(lesson)
        expect(lesson).toHaveAttribute('hidden')
        expect(within(panel).getByText(en.guide.lessons.followSuit.body)).not.toBeVisible()
        expect(within(panel).getByRole('link', { name: 'More in the Rules ›', hidden: true })).not.toBeVisible()
        // what to do and why the last move was refused stay
        expect(within(panel).getByText('Play 9 Tref.')).toBeVisible()
        expect(within(panel).getByTestId('guide-refusal')).toHaveTextContent(en.guide.illegal.followSuit)
        expect(within(panel).getByRole('button', { name: 'Exit' })).toBeVisible()
        await user.click(fold)
        expect(fold).toHaveAttribute('aria-expanded', 'true')
        expect(within(panel).getByText(en.guide.lessons.followSuit.body)).toBeVisible()
    })

    test('on a phone the lesson starts open too, and Exit’s line is for screen readers only (the slot is short)', () => {
        const { panel } = show('followSuit', { phone: true })
        expect(within(panel).getByRole('button', { name: 'Follow suit' })).toHaveAttribute('aria-expanded', 'true')
        expect(within(panel).getByText(en.guide.lessons.followSuit.body)).toBeVisible()
        const exit = within(panel).getByRole('button', { name: 'Exit' })
        expect(exit).toHaveAccessibleDescription('Back to the start page')
        expect(within(panel).getByText('Back to the start page')).toHaveClass('sr-only')
    })

    test('the same refusal again is said again: its line is a new node in the live region (Ruling 69)', () => {
        const { panel, refuseAgain } = show('followSuit', { refusal: 'illegal', refused: 1 })
        const region = within(panel).getByTestId('guide-refusal')
        expect(region).toHaveAttribute('aria-live', 'polite')
        const first = region.firstElementChild
        expect(first).toHaveTextContent(en.guide.illegal.followSuit)
        refuseAgain(2)
        expect(region.firstElementChild).toHaveTextContent(en.guide.illegal.followSuit)
        expect(region.firstElementChild).not.toBe(first)
    })

    test('the title row covers what scrolls under it only once the slot has scrolled (no band over the felt before)', () => {
        const slot = document.body.appendChild(document.createElement('div'))
        let top = 0
        Object.defineProperty(slot, 'scrollTop', { configurable: true, get: () => top, set: (value: number) => { top = value } })
        const { panel } = show('mus', { container: slot })
        const row = within(panel).getByRole('heading', { level: 2 }).parentElement!
        expect(row).not.toHaveClass('bg-ink')
        top = 32
        fireEvent.scroll(slot)
        expect(row).toHaveClass('bg-ink')
        top = 0
        fireEvent.scroll(slot)
        expect(row).not.toHaveClass('bg-ink')
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
