import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { PixelIcon } from '../ui/PixelIcon';
import { cx } from '../ui/cx';
import { LESSON_RULES, type GuideStep, type RefusalKind } from '../../guide/script';
import { useT } from '../../i18n/t';

export interface LessonPanelProps {
    /** The step whose lesson shows; null while the cards are dealt. */
    step: GuideStep | null;
    /** The learner is at `step`: its do line, or Nastavi at a lesson-only stop. */
    ready: boolean;
    refusal: RefusalKind | null;
    /** How many moves were refused so far: a new count says the refusal again, even the same one. */
    refused: number;
    onNext: () => void;
    /** Where Exit goes (spec §7.1). */
    exitLine: string;
    onExit: () => void;
    /** The board lays out for a phone: the slot is short, so Exit's line is for screen readers only. */
    phone: boolean;
}

/**
 * Škola bele's lesson (open beta §7.2) in the board's coach slot. The slot is short on a phone while the bid panel or
 * the HUD's Challenge shows, so the top holds what matters now: the title with Exit beside it (a row that stays at the
 * top of the slot when it scrolls), then what to do (the do line, or Nastavi) and why a move was refused, then the
 * lesson and its Rules section. The title folds the lesson away, so the trick under the panel shows. Each new lesson
 * starts open (the page keys the panel by step), at the top of the slot; the page's own live region says it.
 */
export function LessonPanel({ step, ready, refusal, refused, onNext, exitLine, onExit, phone }: LessonPanelProps) {
    const t = useT();
    const id = useId();
    const [open, setOpen] = useState(true);
    const lesson = step?.lesson ?? null;
    const words = lesson ? t.guide.lessons[lesson] : null;
    const line = !lesson || !refusal ? ''
        : refusal === 'illegal' ? (t.guide.illegal as Partial<Record<string, string>>)[lesson] ?? t.guide.refuse.card
            : refusal === 'otherCard' ? (t.guide.other as Partial<Record<string, string>>)[lesson] ?? t.guide.refuse.card
                : t.guide.refuse[refusal];
    const doLine = lesson && ready && step?.move ? (t.guide.do as Partial<Record<string, string>>)[lesson] : undefined;
    const stop = ready && step !== null && step.move === null;

    // the board's coach slot scrolls and outlives each lesson: a new one starts at its top, title first. Once it has
    // scrolled, the title row covers what passes under it, opaque (before, the panel's own material is enough: no band)
    const root = useRef<HTMLDivElement>(null);
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const slot = root.current?.parentElement;
        if (!slot) return;
        slot.scrollTop = 0;
        const follow = () => setScrolled(slot.scrollTop > 0);
        slot.addEventListener('scroll', follow, { passive: true });
        return () => slot.removeEventListener('scroll', follow);
    }, []);
    // a refusal can sit below the slot's fold (a landscape phone while bidding): bring it into view each time it is said;
    // the title row stays on top, so Exit stays in view
    const said = useRef<HTMLParagraphElement>(null);
    useEffect(() => {
        if (line) said.current?.scrollIntoView?.({ block: 'nearest' });
    }, [line, refused]);

    return (
        <div ref={root} data-testid="lesson-panel" data-lesson={lesson ?? ''} className="flex flex-col">
            {/* sticky, reaching into the slot's padding (10 px top, 14 px sides: board.css .board-coach__panel): Chromium
                measures `top` from the slot's content box, so -10 px pins it to the slot's edge. Solid ink (the material's
                own colour) once something scrolls under it, so nothing shows through */}
            <div className={cx('sticky -top-2.5 z-10 -mx-3.5 -mt-2.5 flex items-start gap-1 px-3.5 pt-2.5', scrolled && 'bg-ink')}>
                <h2 className="t-callout min-w-0 flex-1 font-semibold">
                    {words ? (
                        <button
                            type="button"
                            aria-expanded={open}
                            aria-controls={`${id}-lesson`}
                            onClick={() => setOpen((was) => !was)}
                            className="focus-inside -my-3 flex w-full items-center gap-2 py-3 text-left"
                        >
                            <span className="min-w-0">{words.title}</span>
                            <PixelIcon name="chevron" className={cx('shrink-0 text-text-2', open && 'rotate-90')} />
                        </button>
                    ) : t.guide.dealing}
                </h2>
                {/* Exit's 44-px hit area overlaps the rows around it instead of adding height; off a phone its line
                    shows under it */}
                <div className="flex shrink-0 flex-col items-end">
                    <Button size="sm" variant="quiet" className={phone ? '-my-3 -mr-2' : '-mt-3 -mr-2'} aria-describedby={`${id}-exit`} onClick={onExit}>
                        {t.guide.exit.label}
                    </Button>
                    <span id={`${id}-exit`} className={phone ? 'sr-only' : 't-footnote text-right text-text-2'}>{exitLine}</span>
                </div>
            </div>
            {doLine && <p className="t-footnote mt-1 font-semibold">{doLine}</p>}
            {stop && (
                <div className="mt-1">
                    <Button size="sm" onClick={onNext}>{t.guide.next}</Button>
                </div>
            )}
            {/* a fresh line per refusal, so the same one again is said again */}
            <div aria-live="polite" data-testid="guide-refusal" className="t-footnote font-semibold text-accent">
                {/* scroll-mt: the title row's height on a phone, so the line comes into view under it */}
                {line && <p key={refused} ref={said} className="mt-1 scroll-mt-8">{line}</p>}
            </div>
            {words && (
                <div id={`${id}-lesson`} hidden={!open} className="mt-1">
                    <p className="t-footnote">{words.body}</p>
                    <a href={`/rules#${LESSON_RULES[lesson!]}`} target="_blank" rel="noopener noreferrer" className="t-footnote mt-1 inline-block font-semibold text-accent">
                        {t.guide.rules}
                    </a>
                </div>
            )}
        </div>
    );
}
