import { useState, type ReactNode } from 'react';
import { MotionConfig, m } from 'motion/react';
import { fade, spring } from '../../motion/tokens';
import { useReducedMotion } from '../../motion/useReducedMotion';
import { Tag } from '../ui/Chip';
import { PixelIcon } from '../ui/PixelIcon';
import { PlayingCard } from '../ui/PlayingCard';
import { SuitIcon } from '../ui/SuitIcon';
import { SUIT_LABEL } from '../game/gameView';
import { summaryChips } from './model/declarationMoment';
import { cardId } from './model/rules';
import { secondsLeft, type BoardModel } from './model/boardModel';
import type { Layout, Targets } from './model/cardTargets';
import { seatName } from './announce';
import { seatSpot } from './seatSpot';
import { useNow } from './useNow';
import type { Boja } from '../../types/game';

// the trump caller's badge: the suit's colour, as its trump chips (BidPanel's SUIT_FILL)
const SUIT_FILL: Record<Boja, string> = { HERC: 'bg-suit-herc', KARA: 'bg-suit-karo', PIK: 'bg-suit-pik', TREF: 'bg-suit-tref' };

/** The turn timer's length (TurnTimerService, 30 s): where the countdown bar starts. */
export const TURN_SECONDS = 30;

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
    /** Play is open: no wait for the declarations, or it is over (gameplay rules §4, §6). */
    playOpen: boolean;
}

/**
 * The seat chips (spec §5.3.3, §5.10): `seat-{id}` with `data-current` on the seat to act, its
 * `cards-left-{id}` (visually hidden on phones), the dealer chip, the trump caller's suit badge from the call to
 * the hand's end (owner, 2026-10-12; on the plate, so the seat never grows a line), and on the seat to act the
 * `turn-countdown` and its bar; the bid chips while bidding, Bela, and once play opens each winning
 * seat's zvanja chip (summaryChips) for the rest of the hand, with its declared cards until the first
 * trick is down; a quiet "No challenge" on every seat whose challenge is gone, for the rest of the game
 * (gameplay rules §6). Mine sit over my plate, which sits low by my pile: my declared cards always, and in
 * landscape, where my plate is beside my hand, my chips too (under it they would cover my hand's first cards).
 * A side seat's line up under its plate on its own edge (`data-position`), so a long name never pulls them across
 * the felt onto my hand.
 */
export function Seats({ model, targets, layout, instant, playOpen }: SeatsProps) {
    const chips = playOpen ? summaryChips(model.zvanja) : {};
    const showCards = playOpen && model.playing && model.lastTrick === null;
    // small cards, at the size the opponents' backs are drawn
    const cardWidth = layout.back.w * layout.backScale;
    const chipsOver = layout.kind === 'landscape';
    const caller = model.trump?.callerId ?? null;
    return (
        <div className="board-region board-chips">
            {model.seats.map((seat) => {
                const turn = seat.current && model.turn?.playerId === seat.id ? model.turn : null;
                const declared = showCards ? model.zvanja?.seats.find((one) => one.playerId === seat.id && one.declarations.length > 0)?.cards ?? [] : [];
                const chipRow = (
                    <span className="board-seat__chips">
                        {seat.bid && (
                            <Pop instant={instant}>
                                {seat.bid === 'PASS' ? <Tag>Pass</Tag> : <Tag tone="trump" suit={seat.bid}>{SUIT_LABEL[seat.bid]}</Tag>}
                            </Pop>
                        )}
                        {seat.bela && <Pop instant={instant}><Tag tone="mode">Bela</Tag></Pop>}
                        {chips[seat.id] && <Pop instant={instant}><Tag tone="neutral">{chips[seat.id]}</Tag></Pop>}
                        {seat.challengeUsed && (
                            <Pop instant={instant}>
                                <Tag tone="neutral">
                                    <span aria-hidden="true">No challenge</span>
                                    <span className="sr-only">{`${seatName(model, seat.id)}: no challenge left`}</span>
                                </Tag>
                            </Pop>
                        )}
                    </span>
                );
                const cards = declared.length > 0 && (
                    <span role="group" aria-label={seat.isMe ? 'Your declared cards' : `${seat.id}'s declared cards`} className="board-seat__declared">
                        <Pop instant={instant} delay={0.06}>
                            {declared.map((card, i) => (
                                <PlayingCard key={cardId(card)} card={card} width={cardWidth} style={i ? { marginLeft: -cardWidth * 0.45 } : undefined} />
                            ))}
                        </Pop>
                    </span>
                );
                return (
                    <div key={seat.id} data-testid={`seat-${seat.id}`} data-current={seat.current ? 'true' : undefined} data-position={seat.position} className="board-seat" style={seatSpot(seat, targets, layout)}>
                        <span className="board-seat__name notch t-footnote font-semibold" data-turn={seat.current || undefined}>
                            <span className={seat.team === 'B' ? 'board-seat__team bg-team-b' : 'board-seat__team bg-team-a'} aria-hidden="true" />
                            {/* a bot: the lobby's robot beside its name, and "(bot)" in its name (casual bots spec §7) */}
                            {seat.bot && <PixelIcon name="robot" className="board-seat__bot" />}
                            <span className="board-seat__label" title={seat.isMe ? undefined : seat.bot ? `${seat.id} (bot)` : seat.id}>{seat.isMe ? 'You' : seat.id}</span>
                            {seat.bot && <span className="sr-only"> (bot)</span>}
                            {seat.dealer && (
                                <span data-testid="dealer-chip" className="board-seat__dealer font-pix">
                                    <span aria-hidden="true">D</span>
                                    <span className="sr-only">Dealer</span>
                                </span>
                            )}
                            {caller === seat.id && model.trump && (
                                <span data-testid="caller-badge" className={`board-seat__caller ${SUIT_FILL[model.trump.suit]}`}>
                                    <SuitIcon boja={model.trump.suit} />
                                    <span className="sr-only">{`${seatName(model, seat.id)} called ${model.trump.label}`}</span>
                                </span>
                            )}
                            <span className="sr-only lg:not-sr-only text-text-2">
                                <span data-testid={`cards-left-${seat.id}`}>{seat.cardsLeft}</span>
                                <span className="sr-only"> cards</span>
                            </span>
                            {turn?.expiresAt != null && <Countdown expiresAt={turn.expiresAt} skew={model.skew} />}
                        </span>
                        {turn?.expiresAt != null && <TimerBar key={`${seat.id}:${turn.expiresAt}`} expiresAt={turn.expiresAt} skew={model.skew} />}
                        {!(seat.isMe && chipsOver) && chipRow}
                        {seat.isMe ? (cards || chipsOver) && <span className="board-seat__above">{cards}{chipsOver && chipRow}</span> : cards}
                    </div>
                );
            })}
        </div>
    );
}
