import { useState, type CSSProperties, type ReactNode } from 'react';
import { MotionConfig, m } from 'motion/react';
import { fade, spring } from '../../motion/tokens';
import { useReducedMotion } from '../../motion/useReducedMotion';
import { Tag } from '../ui/Chip';
import { SUIT_LABEL } from '../game/gameView';
import { secondsLeft, type BoardModel, type SeatModel } from './model/boardModel';
import type { Layout, Target, Targets } from './model/cardTargets';
import { useNow } from './useNow';

/** The turn timer's length (TurnTimerService, 30 s): where the countdown bar starts. */
export const TURN_SECONDS = 30;

/**
 * Where a seat's chips sit (spec §5.6): under the partner's fan, under the side fans, mine above my pile; how wide
 * they may grow: the side seats each up to the board's middle, so a 20-character name never runs into the other.
 */
function seatSpot(seat: SeatModel, targets: Targets, layout: Layout): CSSProperties {
    const anchor = targets.anchors[seat.id] ?? { x: 0, y: 0, rotate: 0 };
    if (seat.isMe) {
        const pile = targets.piles[seat.team ?? 'A'];
        const pileTop = pile.top + (pile.height * (1 - pile.scale)) / 2;
        const pileLeft = pile.left + (pile.width * (1 - pile.scale)) / 2;
        // over my pile: bottom-left on phones and desktops, beside the hand in landscape
        return { left: Math.max(12, pileLeft - 4), top: Math.max(layout.hud + 8, pileTop - 34) };
    }
    const backs = Object.entries(targets.cards).filter(([key]) => key.startsWith(`back:${seat.id}:`)).map(([, target]) => target);
    const across = (target: Target) => (seat.position === 'partner' ? target.height : target.width) * target.scale;
    if (seat.position === 'partner' && layout.kind === 'landscape') {
        // beside the fan: under it would cover the partner's trick card
        const right = backs.length ? Math.max(...backs.map((t) => t.left + t.width / 2 + (t.width * t.scale) / 2)) : anchor.x + 20;
        return { left: right + 8, top: anchor.y - 13, maxWidth: layout.board.w - right - 20 };
    }
    const bottom = backs.length ? Math.max(...backs.map((t) => t.top + t.height / 2 + across(t) / 2)) : anchor.y + 24;
    const middle = layout.board.w / 2;
    if (seat.position === 'partner') return { left: anchor.x, top: bottom + 6, transform: 'translateX(-50%)', maxWidth: layout.board.w - 32 };
    if (seat.position === 'left') {
        const left = Math.max(8, anchor.x - 24);
        return { left, top: bottom + 6, maxWidth: middle - left - 6 };
    }
    const right = Math.min(layout.board.w - 8, anchor.x + 24);
    return { left: right, top: bottom + 6, transform: 'translateX(-100%)', maxWidth: right - middle - 6 };
}

/** A chip that pops in at its seat (spring.quick); a snap shows it at once. */
function Pop({ instant, delay = 0, children }: { instant: boolean; delay?: number; children: ReactNode }) {
    const reduced = useReducedMotion();
    return (
        <m.span
            className="inline-flex"
            initial={instant ? false : reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduced ? fade : { ...spring.quick, delay }}
        >
            {children}
        </m.span>
    );
}

/** The seconds left on the seat's turn, as text ("{n} s", R-31), and a bar that runs down (scaleX, linear). */
function Countdown({ expiresAt, skew }: { expiresAt: number; skew: number }) {
    const now = useNow();
    return <span data-testid="turn-countdown" className="board-seat__seconds">{`${secondsLeft(expiresAt, skew, now)} s`}</span>;
}

function TimerBar({ expiresAt, skew }: { expiresAt: number; skew: number }) {
    const [left] = useState(() => Math.max(0, (expiresAt - (Date.now() + skew)) / 1000));
    return (
        <span className="board-seat__timer" aria-hidden="true">
            {/* information, not decoration: it runs under reduced motion too (spec §3.8) */}
            <MotionConfig reducedMotion="never">
                <m.i initial={{ scaleX: Math.min(1, left / TURN_SECONDS) }} animate={{ scaleX: 0 }} transition={{ duration: left, ease: 'linear' }} />
            </MotionConfig>
        </span>
    );
}

export interface SeatsProps {
    model: BoardModel;
    targets: Targets;
    layout: Layout;
    instant: boolean;
}

/**
 * The seat chips (spec §5.3.3, §5.10): `seat-{id}` with `data-current` on the seat to act, its
 * `cards-left-{id}` (visually hidden on phones), the dealer chip, and on the seat to act the
 * `turn-countdown` and its bar; the bid chips while bidding, Bela and the zvanja.
 */
export function Seats({ model, targets, layout, instant }: SeatsProps) {
    return (
        <div className="board-region board-chips">
            {model.seats.map((seat) => {
                const turn = seat.current && model.turn?.playerId === seat.id ? model.turn : null;
                return (
                    <div key={seat.id} data-testid={`seat-${seat.id}`} data-current={seat.current ? 'true' : undefined} className="board-seat" style={seatSpot(seat, targets, layout)}>
                        <span className="board-seat__name notch t-footnote font-semibold" data-turn={seat.current || undefined}>
                            <span className={seat.team === 'B' ? 'board-seat__team bg-team-b' : 'board-seat__team bg-team-a'} aria-hidden="true" />
                            <span className="board-seat__label" title={seat.isMe ? undefined : seat.id}>{seat.isMe ? 'You' : seat.id}</span>
                            {seat.dealer && (
                                <span data-testid="dealer-chip" className="board-seat__dealer font-pix">
                                    <span aria-hidden="true">D</span>
                                    <span className="sr-only">Dealer</span>
                                </span>
                            )}
                            <span className="sr-only lg:not-sr-only text-text-2">
                                <span data-testid={`cards-left-${seat.id}`}>{seat.cardsLeft}</span>
                                <span className="sr-only"> cards</span>
                            </span>
                            {turn?.expiresAt != null && <Countdown expiresAt={turn.expiresAt} skew={model.skew} />}
                        </span>
                        {turn?.expiresAt != null && <TimerBar key={`${seat.id}:${turn.expiresAt}`} expiresAt={turn.expiresAt} skew={model.skew} />}
                        <span className="board-seat__chips">
                            {seat.bid && (
                                <Pop instant={instant}>
                                    {seat.bid === 'PASS' ? <Tag>Pass</Tag> : <Tag tone="trump" suit={seat.bid}>{SUIT_LABEL[seat.bid]}</Tag>}
                                </Pop>
                            )}
                            {seat.bela && <Pop instant={instant}><Tag tone="mode">Bela</Tag></Pop>}
                            {seat.zvanja.map((zvanje, i) => (
                                <Pop key={zvanje} instant={instant} delay={i * 0.06}><Tag tone="neutral">{zvanje}</Tag></Pop>
                            ))}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
