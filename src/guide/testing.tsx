// Test helpers for Škola bele's page tests (not shipped: only *.test.tsx files import this, as components/board/testing.tsx).
import { expect, vi } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { LESSONS, type LessonKey } from './script';

/**
 * Fake time moves `ms` on in slices, each in its own act: the replay sets its next timer only after the render of the
 * frame it fed, so one long advance would feed one pair.
 */
export async function advance(ms: number, slice = 250): Promise<void> {
    // at least once: advance(0) lets promises settle and renders what they set
    let gone = 0;
    do {
        await act(() => vi.advanceTimersByTimeAsync(Math.min(slice, ms - gone)));
        gone += slice;
    } while (gone < ms);
}

/**
 * A click under fake timers. fireEvent, not userEvent: user-event's wrapper waits for a setTimeout(0) that Testing
 * Library advances only under jest's fake timers, so under vitest's it never resolves.
 */
export function click(element: HTMLElement): void {
    fireEvent.click(element);
}

const button = (name: string) => screen.getByRole('button', { name });
const press = (name: string) => () => click(button(name));

/** What the learner does at each of hand 1's steps, in English: the board's own names (a marked card is "…, highlighted"). */
export const DO: Record<LessonKey, () => void> = {
    dalje: press('Next'),
    mus: press('Call Herc'),
    zvanja: press('Next'),
    followSuit: press('9 Tref, highlighted'),
    mustTrump: press('7 Herc, highlighted'),
    lead: press('10 Tref, highlighted'),
    foul: press('Next'),
    bela: () => {
        click(button('Kralj Herc, highlighted'));
        click(button('Play + Bela'));
    },
    foulSeen: press('Next'),
    followAfterCut: press('Decko Tref, highlighted'),
    followTrump: press('Baba Herc, highlighted'),
    followPik: press('7 Pik, highlighted'),
    lastTrick: press('Baba Tref, highlighted'),
    padanje: press('Next'),
    // the hand result's Challenge (the HUD's is gone once the sheet is up)
    challenge: () => click(within(screen.getByTestId('hand-result')).getByRole('button', { name: 'Challenge' })),
    foulFound: press('Next'),
};

/**
 * Plays hand 1 on /learn in English with fake timers (vi.useFakeTimers() first). Without `from` it starts on the intro
 * ("Deal the cards"); then at each step it advances 10 s, checks the lesson panel's lesson, and does the step. It
 * stops before `until`, when given.
 */
export async function playHand1({ from, until }: { from?: LessonKey; until?: LessonKey } = {}): Promise<void> {
    if (!from) click(button('Deal the cards'));
    for (const lesson of LESSONS.slice(from ? LESSONS.indexOf(from) : 0)) {
        if (lesson === until) return;
        await advance(10_000);
        expect(screen.getByTestId('lesson-panel').dataset.lesson, 'the lesson panel').toBe(lesson);
        DO[lesson]();
    }
}
