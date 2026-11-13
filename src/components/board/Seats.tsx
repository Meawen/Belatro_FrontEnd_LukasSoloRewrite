import { useState, type CSSProperties, type ReactNode } from 'react';
import { MotionConfig, m } from 'motion/react';
import { fade, spring } from '../../motion/tokens';
import { useReducedMotion } from '../../motion/useReducedMotion';
import { Tag } from '../ui/Chip';
import { turnOnPlate } from './yourTurn';
import { PixelIcon } from '../ui/PixelIcon';
import { PlayingCard } from '../ui/PlayingCard';
import { SuitIcon } from '../ui/SuitIcon';
import { SUIT_LABEL } from '../game/gameView';
import { summaryChips } from './model/declarationMoment';
import { cardId } from './model/rules';
import { secondsLeft, type BoardModel } from './model/boardModel';
import type { Layout, Targets } from './model/cardTargets';
import { seatName } from './announce';
import { declaredStep, seatSpot } from './seatSpot';
import { useNow } from './useNow';
import type { Boja } from '../../types/game';
import { useT } from '../../i18n/t';

// the trump caller's badge: the suit's colour, as its trump chips (BidPanel's SUIT_FILL)
const SUIT_FILL: Record<Boja, string> = { HERC: 'bg-suit-herc', KARA: 'bg-suit-karo', PIK: 'bg-suit-pik', TREF: 'bg-suit-tref' };

/** The turn timer's length (TurnTimerService, 30 s): where the countdown bar starts. */
export const TURN_SECONDS = 30;

/** The last seconds of my turn, before the server's timer plays for me: "Your turn" asks "Still there?" (spec §1.4). */
const AWAY_SECONDS = 10;

/**
 * "Your turn", or "Still there?" in its last 10 s: the label over my hand (Board's YourTurn) and, on upright phones, my
 * plate's name (yourTurn.ts `turnOnPlate`).
 */
export function TurnText({ expiresAt, skew }: { expiresAt: number | null; skew: number }) {
    const t = useT();
    const now = useNow(expiresAt !== null ? 1000 : null);
    return expiresAt !== null && secondsLeft(expiresAt, skew, now) <= AWAY_SECONDS ? t.board.away : t.board.yourTurn;
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
    /** Play is open: no wait for the declarations, or it is over (gameplay rules §4, §6). */
    playOpen: boolean;
}

/**
 * The seat chips (spec §5.3.3, §5.10): `seat-{id}` with `data-current` on the seat to act, its
 * `cards-left-{id}` (visually hidden on phones), the dealer chip, the trump caller's suit badge from the call to
 * the hand's end (owner, 2026-10-12; on the plate, so the seat never grows a line), and on the seat to act the
 * `turn-countdown` and its bar; the bid chips while bidding, and once play opens each winning seat's zvanja
 * chip (summaryChips) for the rest of the hand, with its declared cards until the first trick is down. On the
 * plate, as badges after the dealer's D and the caller's: Bela once declared (a pixel B; owner, 2026-11-03), and on
 * every seat whose challenge is gone, for the rest of the game, a crossed-out ring (gameplay rules §6; owner,
 * 2026-10-30). On upright phones my plate's name reads "Your turn" on my turn (owner, 2026-11-03, option B; sideways,
 * on tablets and desktops the label over my hand says it). Mine sit over my plate, which sits low by my pile: my
 * declared cards always, and in landscape, where my plate is beside my hand, my chips too (under it they would cover my
 * hand's first cards).
 * Upright my chips sit beside my plate, wrapping upwards (board.css), and my plate keeps the countdown's width; my
 * declared cards over it overlap more where the trick slot beside them leaves less room (seatSpot's `above`), and start
 * past the left seat's backs where its fan reaches down beside them (`cardsFrom`, Ruling X; in landscape my chips stay
 * over my plate, kept to its `maxWidth`, and only my cards move). My
 * partner's sit under its plate, in the column beside its fan; in landscape on the plate's row, its declared cards on
 * the fan's other side where the row has no room
 * (`board-seat__aside`, seatSpot's `aside`). A side seat's chips and cards sit in `board-seat__under` (seatSpot's
 * `under`): under its fan upright, under its plate beside the fan elsewhere, on its own side (`data-position`), so none
 * reaches the trick or my hand (board-fit spec §4). Everything stays inside `seat-{id}`. The declared cards are half a
 * trick card (Layout.declared), 45 % under the next, closer where their room is narrower than they need (declaredStep).
 */
export function Seats({ model, targets, layout, instant, playOpen }: SeatsProps) {
    const t = useT();
    const chips = playOpen ? summaryChips(model.zvanja) : {};
    const showCards = playOpen && model.playing && model.lastTrick === null;
    // small cards, about half a trick card (board-fit spec §3.5)
    const cardWidth = layout.declared.w;
    const chipsOver = layout.kind === 'landscape';
    const caller = model.trump?.callerId ?? null;
    const turnHere = turnOnPlate(layout.kind) && model.yourTurn;
    return (
        <div className="board-region board-chips">
            {model.seats.map((seat) => {
                const turn = seat.current && model.turn?.playerId === seat.id ? model.turn : null;
                const declared = showCards ? model.zvanja?.seats.find((one) => one.playerId === seat.id && one.declarations.length > 0)?.cards ?? [] : [];
                const { under, aside, above, beside, cardsFrom, lift, ...spot } = seatSpot(seat, targets, layout);
                const step = declaredStep(cardWidth, declared.length, aside?.room ?? above ?? spot.maxWidth);
                const chipRow = (
                    <span className="board-seat__chips" style={beside === undefined ? undefined : ({ '--chips-from': `${beside.from}px`, maxWidth: beside.room } as CSSProperties)}>
                        {seat.bid && (
                            <Pop instant={instant}>
                                {seat.bid === 'PASS' ? <Tag>{t.board.pass}</Tag> : <Tag tone="trump" suit={seat.bid}>{SUIT_LABEL[seat.bid]}</Tag>}
                            </Pop>
                        )}
                        {chips[seat.id] && <Pop instant={instant}><Tag tone="neutral">{chips[seat.id]}</Tag></Pop>}
                    </span>
                );
                const cards = declared.length > 0 && (
                    <span role="group" aria-label={seat.isMe ? t.board.seat.declaredMine : t.board.seat.declared(seat.id)} className="board-seat__declared" style={cardsFrom ? { marginLeft: cardsFrom } : undefined}>
                        <Pop instant={instant} delay={0.06}>
                            {declared.map((card, i) => (
                                <PlayingCard key={cardId(card)} card={card} width={cardWidth} exact={layout.exact} style={i ? { marginLeft: step - cardWidth } : undefined} />
                            ))}
                        </Pop>
                    </span>
                );
                return (
                    <div key={seat.id} data-testid={`seat-${seat.id}`} data-current={seat.current ? 'true' : undefined} data-position={seat.position} className="board-seat" style={spot}>
                        <span className="board-seat__name notch t-footnote font-semibold" data-turn={seat.current || undefined}>
                            <span className={seat.team === 'B' ? 'board-seat__team bg-team-b' : 'board-seat__team bg-team-a'} aria-hidden="true" />
                            {/* a bot: the lobby's robot beside its name, and "(bot)" in its name (casual bots spec §7) */}
                            {seat.bot && <PixelIcon name="robot" className="board-seat__bot" />}
                            {/* on upright phones my plate's name reads "Your turn" on my turn, in place of the label over my hand (owner 2026-11-03) */}
                            <span data-testid={seat.isMe && turnHere ? 'your-turn' : undefined} className="board-seat__label" title={seat.isMe ? undefined : seat.bot ? `${seat.id} ${t.board.seat.bot}` : seat.id}>{seat.isMe ? (turnHere ? <TurnText expiresAt={model.turn?.expiresAt ?? null} skew={model.skew} /> : t.common.you) : seat.id}</span>
                            {seat.bot && <span className="sr-only"> {t.board.seat.bot}</span>}
                            {seat.dealer && (
                                <span data-testid="dealer-chip" className="board-seat__dealer font-pix">
                                    <span aria-hidden="true">D</span>
                                    <span className="sr-only">{t.board.seat.dealer}</span>
                                </span>
                            )}
                            {caller === seat.id && model.trump && (
                                <span data-testid="caller-badge" className={`board-seat__caller ${SUIT_FILL[model.trump.suit]}`}>
                                    <SuitIcon boja={model.trump.suit} />
                                    <span className="sr-only">{seat.isMe ? t.board.say.calledMine(model.trump.label) : t.board.say.called(seat.id, model.trump.label)}</span>
                                </span>
                            )}
                            {/* Bela declared (owner, 2026-11-03: "Bela as a badge"): a pixel B on the plate, as the D, in the old chip's colours */}
                            {seat.bela && (
                                <span data-testid="bela-badge" className="board-seat__bela font-pix">
                                    <span aria-hidden="true">B</span>
                                    <span className="sr-only">{t.board.say.bela(seatName(model, seat.id))}</span>
                                </span>
                            )}
                            {/* its challenge is gone for the game (owner, 2026-10-30): a crossed-out ring on the plate, as the D */}
                            {seat.challengeUsed && (
                                <span data-testid="no-challenge-badge" className="board-seat__spent">
                                    <PixelIcon name="ban" />
                                    <span className="sr-only">{t.board.seat.noChallengeLeft(seatName(model, seat.id))}</span>
                                </span>
                            )}
                            {/* the cards left: shown on wide windows, but not on mine (my hand shows it; Ruling Y) */}
                            <span className={seat.isMe ? 'sr-only' : 'sr-only lg:not-sr-only text-text-2'}>
                                <span data-testid={`cards-left-${seat.id}`}>{seat.cardsLeft}</span>
                                <span className="sr-only"> {t.board.seat.cards(seat.cardsLeft)}</span>
                            </span>
                            {turn?.expiresAt != null ? (
                                <Countdown expiresAt={turn.expiresAt} skew={model.skew} />
                            ) : (
                                // upright my plate keeps the countdown's width, so my chips beside it never shift
                                beside !== undefined && <span className="board-seat__seconds" aria-hidden="true" />
                            )}
                        </span>
                        {turn?.expiresAt != null && <TimerBar key={`${seat.id}:${turn.expiresAt}`} expiresAt={turn.expiresAt} skew={model.skew} />}
                        {under !== undefined ? (
                            <span className="board-seat__under" style={{ top: under, maxWidth: spot.maxWidth }}>{chipRow}{cards}</span>
                        ) : seat.isMe ? (
                            <>
                                {!chipsOver && chipRow}
                                {(cards || chipsOver) && <span className="board-seat__above" style={{ maxWidth: chipsOver ? spot.maxWidth : (cardsFrom ?? 0) + (above ?? 0), ...(lift && chips[seat.id] && !seat.bid ? { bottom: `calc(100% + ${4 + lift}px)` } : {}) }}>{cards}{chipsOver && chipRow}</span>}
                            </>
                        ) : (
                            <>
                                {chipRow}
                                {cards && aside ? <span className="board-seat__aside" style={{ marginRight: aside.offset, ...(aside.drop ? { top: aside.drop } : {}) }}>{cards}</span> : cards}
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
