import { useState } from 'react';
import { MotionConfig, m } from 'motion/react';
import { Sheet } from '../ui/Sheet';
import { Tag } from '../ui/Chip';
import { Challenge } from './Challenge';
import { useNow } from './useNow';
import { challengeHeader } from './model/challengeMoment';
import { blokRows } from './model/hands';
import { secondsLeft, type BoardModel, type Team } from './model/boardModel';
import type { MatchHands } from '../../hooks/useMatchHands';
import { useT } from '../../i18n/t';

/** The post-hand challenge window (BelotGameService: 10 s): where its bar starts. */
export const WINDOW_SECONDS = 10;

function WindowBar({ expiresAt, skew }: { expiresAt: number; skew: number }) {
    const t = useT();
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
            <p className="t-footnote text-text-2">{t.board.result.nextIn(secondsLeft(expiresAt, skew, now))}</p>
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
    /** A challenge waits for the server's answer. */
    challengePending: boolean;
    /** `model` is the step before a challenge while its banner says who: Challenge shows as it was, disabled. */
    challengeFrozen: boolean;
}

/**
 * The hand result (spec §5.4, US-33): a non-modal sheet docked at the bottom of the board once the 8th
 * trick has swept, or at once when a right challenge ended the hand ("Foul found: Team B takes the hand",
 * gameplay rules §6). "Hand n", Mi and Vi with their zvanja and bela, PAD/CAPOT, the challenge window's bar
 * ("Next hand shortly" before the server sets it), and Challenge with its hint while it shows.
 */
export function HandResult({ model, open, hands, delta, onChallenge, challengePending, challengeFrozen }: HandResultProps) {
    const t = useT();
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
            title={challengeHeader(model.lastChallenge) ?? (ended?.handNo ? t.board.result.hand(ended.handNo) : model.phaseLabel)}
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
                                    {row?.padanje === team && <Tag tone="warn">{team === mine ? t.board.result.fellMine : t.board.result.fellTheirs}</Tag>}
                                    {row?.capot === team && <Tag tone="win">{t.board.capot}</Tag>}
                                    {/* R1-44: a team that fell scores 0, so no declarations beside it (the server's summary keeps them) */}
                                    {decl > 0 && row?.padanje !== team && <span className="t-footnote text-text-2">{t.board.result.decl(decl)}</span>}
                                    <span className="t-score">{team === 'A' ? points.a : points.b}</span>
                                </dd>
                            </div>
                        );
                    })}
                </dl>
            )}
            {model.window ? <WindowBar key={model.window.expiresAt} expiresAt={model.window.expiresAt} skew={model.skew} /> : <p className="t-footnote text-text-2">{t.board.result.nextSoon}</p>}
            {model.challenge !== 'hidden' && model.handComplete && (
                <Challenge place="sheet" state={model.challenge} pending={challengePending} frozen={challengeFrozen} onChallenge={onChallenge} />
            )}
        </Sheet>
    );
}
