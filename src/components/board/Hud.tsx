import { useLayoutEffect, useRef } from 'react';
import { AnimatePresence, animate, m } from 'motion/react';
import { fade, spring } from '../../motion/tokens';
import { useReducedMotion } from '../../motion/useReducedMotion';
import { SuitIcon } from '../ui/SuitIcon';
import type { BoardModel } from './model/boardModel';

const INSTANT = { duration: 0 } as const;

/**
 * A score: the `score-a`/`score-b` element holds exactly the number at every moment (the harness reads
 * it); the digits on screen are aria-hidden copies that slide when it changes (spec §5.3.3, §5.3.4).
 */
export function Score({ value, testId, instant }: { value: number; testId: string; instant: boolean }) {
    const reduced = useReducedMotion();
    const enter = reduced ? { opacity: 0 } : { opacity: 0, y: '100%' };
    const leave = reduced ? { opacity: 0 } : { opacity: 0, y: '-100%' };
    return (
        <span className="board-score">
            <span data-testid={testId} className="sr-only">{value}</span>
            <AnimatePresence initial={false} mode="popLayout">
                <m.b
                    key={value}
                    aria-hidden="true"
                    className="t-score"
                    initial={enter}
                    animate={{ opacity: 1, y: 0 }}
                    exit={leave}
                    transition={instant ? INSTANT : reduced ? fade : spring.quick}
                >
                    {value}
                </m.b>
            </AnimatePresence>
        </span>
    );
}

export interface HudProps {
    model: BoardModel;
    /** A snap: scores and badges change without motion. */
    instant: boolean;
    /** The trump was just called by this player (a live TrumpCalled): its badge flies in from their seat. */
    calledBy: string | null;
    /** Counts the trump calls, so each call flies once. */
    calls: number;
}

/**
 * The HUD (spec §5.4): the score chip, Mi for my team; the phase in words (`game-phase`, `data-phase`);
 * the trump badge, whose inner `trump` element holds exactly the suit name and exists only once trump
 * is called ("Bidding" and the season word sit outside it).
 */
export function Hud({ model, instant, calledBy, calls }: HudProps) {
    const reduced = useReducedMotion();
    const badge = useRef<HTMLSpanElement>(null);
    const mine = model.myTeam ?? 'A';
    const theirs = mine === 'A' ? 'B' : 'A';
    const score = (team: 'A' | 'B') => (team === 'A' ? model.scores.a : model.scores.b);

    // the badge flies from the caller's seat chip to the HUD (an imperative animation: it reads reduced motion itself)
    useLayoutEffect(() => {
        const icon = badge.current;
        if (!icon || !calledBy || instant) return;
        if (reduced) {
            animate(icon, { opacity: [0, 1] }, fade);
            return;
        }
        const seat = document.querySelector(`[data-testid="seat-${calledBy}"]`)?.getBoundingClientRect();
        const here = icon.getBoundingClientRect();
        const dx = seat ? seat.left + seat.width / 2 - (here.left + here.width / 2) : 0;
        const dy = seat ? seat.top + seat.height / 2 - (here.top + here.height / 2) : 0;
        animate(icon, { x: [dx, 0], y: [dy, 0], scale: [2, 1] }, spring.ui);
        // once per call
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [calls]);

    return (
        <div className="board-hud">
            <div className="board-hud__group">
                <span className="board-hud__chip">
                    <span className="board-hud__team"><span className="t-caption text-text-2">Mi</span><Score value={score(mine)} testId={`score-${mine.toLowerCase()}`} instant={instant} /></span>
                    <span className="board-hud__sep" aria-hidden="true" />
                    <span className="board-hud__team"><span className="t-caption text-text-2">Vi</span><Score value={score(theirs)} testId={`score-${theirs.toLowerCase()}`} instant={instant} /></span>
                </span>
            </div>
            <div className="board-hud__group">
                <span className="board-hud__chip">
                    <span data-testid="game-phase" data-phase={model.phase}>{model.phaseLabel}</span>
                    {model.trump && (
                        <>
                            <span ref={badge} className="inline-flex"><SuitIcon boja={model.trump.suit} /></span>
                            <span data-testid="trump">{model.trump.label}</span>
                            <span className="board-hud__season text-text-2" aria-hidden="true">{`· ${model.season}`}</span>
                        </>
                    )}
                </span>
            </div>
        </div>
    );
}
