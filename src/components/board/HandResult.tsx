import { useState } from 'react';
import { MotionConfig, m } from 'motion/react';
import { Sheet } from '../ui/Sheet';
import { Tag } from '../ui/Chip';
import { Challenge } from './Challenge';
import { useNow } from './useNow';
import { blokRows } from './model/hands';
import { secondsLeft, type BoardModel, type Team } from './model/boardModel';
import type { MatchHands } from '../../hooks/useMatchHands';

/** The post-hand challenge window (BelotGameService: 10 s): where its bar starts. */
export const WINDOW_SECONDS = 10;

function WindowBar({ expiresAt, skew }: { expiresAt: number; skew: number }) {
    const now = useNow();
    const [left] = useState(() => Math.max(0, (expiresAt - (Date.now() + skew)) / 1000));
    return (
        <div className="board-window">
            <span className="board-window__bar" aria-hidden="true">
                {/* information: it runs under reduced motion too */}
                <MotionConfig reducedMotion="never">
                    <m.i initial={{ scaleX: Math.min(1, left / WINDOW_SECONDS) }} animate={{ scaleX: 0 }} transition={{ duration: left, ease: 'linear' }} />
                </MotionConfig>
            </span>
            <p className="t-footnote text-text-2">{`Next hand in ${secondsLeft(expiresAt, skew, now)} s`}</p>
        </div>
    );
}

export interface HandResultProps {
    model: BoardModel;
    open: boolean;
    hands: MatchHands | null | undefined;
    /** The score change the board saw (PLAYING → HAND_COMPLETE), while the stored hand hasn't arrived. */
    delta: { a: number; b: number } | null;
    onChallenge: () => void;
}

/**
 * The hand result (spec §5.4, US-33): a non-modal sheet docked at the bottom of the board once the 8th
 * trick has swept. "Hand n", Mi and Vi with their zvanja and bela, PAD/CAPOT, the challenge window's bar
 * ("Next hand shortly" before the server sets it), and Challenge with its hint while it is offered.
 */
export function HandResult({ model, open, hands, delta, onChallenge }: HandResultProps) {
    const ended = hands?.ended ?? null;
    const teamOf = (id: string): Team | null => model.seats.find((seat) => seat.id === id)?.team ?? null;
    const row = ended ? blokRows(hands?.hands ?? null, teamOf).find((r) => r.handNo === ended.handNo) ?? null : null;
    const points = row ? { a: row.a, b: row.b } : delta;
    const summary = ended?.handSummary ?? null;
    const mine: Team = model.myTeam ?? 'A';
    const lines: { label: string; team: Team }[] = [{ label: 'Mi', team: mine }, { label: 'Vi', team: mine === 'A' ? 'B' : 'A' }];
    return (
        <Sheet
            open={open}
            onClose={() => {}}
            title={ended?.handNo ? `Hand ${ended.handNo}` : model.phaseLabel}
            modal={false}
            dismissible={false}
            side="bottom"
            className="board-dock"
            data-testid="hand-result"
        >
            {points && (
                <dl className="board-result">
                    {lines.map(({ label, team }) => {
                        const decl = summary ? (team === 'A' ? summary.teamADeclPoints : summary.teamBDeclPoints) : 0;
                        return (
                            <div key={label} className="board-result__row">
                                <dt className="t-callout font-semibold">{label}</dt>
                                <dd className="flex items-center gap-2">
                                    {row?.padanje === team && <Tag tone="warn">Pad</Tag>}
                                    {row?.capot === team && <Tag tone="win">Capot</Tag>}
                                    {decl > 0 && <span className="t-footnote text-text-2">{`incl. ${decl} zvanja`}</span>}
                                    <span className="t-score">{team === 'A' ? points.a : points.b}</span>
                                </dd>
                            </div>
                        );
                    })}
                </dl>
            )}
            {model.window ? <WindowBar key={model.window.expiresAt} expiresAt={model.window.expiresAt} skew={model.skew} /> : <p className="t-footnote text-text-2">Next hand shortly</p>}
            {model.canChallenge && model.handComplete && <Challenge place="sheet" onChallenge={onChallenge} />}
        </Sheet>
    );
}
