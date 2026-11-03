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
    onNext: () => void;
    /** Where Exit goes, said under it for screen readers (the intro, the menu and the end screen show it). */
    exitLine: string;
    onExit: () => void;
    /** Starts folded: a phone, where the lesson would cover the card on the table the learner answers. */
    folded?: boolean;
}

/**
 * Škola bele's lesson (open beta §7.2) in the board's coach slot. The slot is short on a phone while the bid panel or
 * the HUD's Challenge shows, so the top holds what matters now: the title with Exit beside it (its 44-px hit area
 * overlaps the rows around it instead of adding height), then what to do (the do line, or Nastavi) and why a move was
 * refused, then the lesson and its Rules section. The title folds the lesson away, so the trick under the panel shows;
 * each new lesson starts open unless `folded` (the page keys the panel by step), at the top of the slot.
 */
export function LessonPanel({ step, ready, refusal, onNext, exitLine, onExit, folded = false }: LessonPanelProps) {
    const t = useT();
    const id = useId();
    const [open, setOpen] = useState(!folded);
    const lesson = step?.lesson ?? null;
    const words = lesson ? t.guide.lessons[lesson] : null;
    const line = !lesson || !refusal ? ''
        : refusal === 'illegal' ? (t.guide.illegal as Partial<Record<string, string>>)[lesson] ?? t.guide.refuse.card
            : refusal === 'otherCard' ? (t.guide.other as Partial<Record<string, string>>)[lesson] ?? t.guide.refuse.card
                : t.guide.refuse[refusal];
    const doLine = lesson && ready && step?.move ? (t.guide.do as Partial<Record<string, string>>)[lesson] : undefined;

    // the board's coach slot scrolls and outlives each lesson: a new one starts at its top, title first
    const root = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const slot = root.current?.parentElement;
        if (slot) slot.scrollTop = 0;
    }, []);
    // a refusal can sit below the slot's fold (a landscape phone while bidding): bring it into view when it changes
    const said = useRef<HTMLParagraphElement>(null);
    useEffect(() => {
        if (line) said.current?.scrollIntoView?.({ block: 'nearest' });
    }, [line]);

    return (
        <div ref={root} data-testid="lesson-panel" data-lesson={lesson ?? ''} className="flex flex-col gap-1">
            <div className="flex items-start gap-1">
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
                <Button size="sm" variant="quiet" className="-my-3 -mr-2 shrink-0" aria-describedby={`${id}-exit`} onClick={onExit}>{t.guide.exit.label}</Button>
                <span id={`${id}-exit`} className="sr-only">{exitLine}</span>
            </div>
            <div aria-live="polite">
                {doLine && <p className="t-footnote font-semibold">{doLine}</p>}
                {ready && step && !step.move && <Button size="sm" onClick={onNext}>{t.guide.next}</Button>}
            </div>
            <p ref={said} aria-live="polite" data-testid="guide-refusal" className="t-footnote font-semibold text-accent">{line}</p>
            {words && open && (
                <div id={`${id}-lesson`} className="flex flex-col gap-1">
                    <p className="t-footnote">{words.body}</p>
                    <a href={`/rules#${LESSON_RULES[lesson!]}`} target="_blank" rel="noopener noreferrer" className="t-footnote font-semibold text-accent">
                        {t.guide.rules}
                    </a>
                </div>
            )}
        </div>
    );
}
