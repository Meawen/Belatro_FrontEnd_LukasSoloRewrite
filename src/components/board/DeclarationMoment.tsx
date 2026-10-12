import { m, type MotionProps } from 'motion/react';
import { fade, spring } from '../../motion/tokens';
import { PlayingCard } from '../ui/PlayingCard';
import { belotLine, momentAt } from './model/declarationMoment';
import { belotRow, trickCentre, type Layout, type Targets } from './model/cardTargets';
import { cardId } from './model/rules';
import { bubbleSpot } from './seatSpot';
import { useNow } from './useNow';
import type { BoardModel } from './model/boardModel';

/** How often a running moment reads the clock: its steps are 0.6 s apart. */
const TICK_MS = 100;

export interface DeclarationMomentProps {
    model: BoardModel;
    layout: Layout;
    targets: Targets;
    /** It came from a snapshot (a reconnect): its end state, and nothing animates in. */
    snapshot: boolean;
    reduced: boolean;
    /** A tap on the panel: the moment hides on this screen (a belot's end sheet opens at once: "Skip to the result"). */
    onSkip: () => void;
}

/** Pops in where it stands (spring.quick); under reduced motion it only fades in, on the same timing. */
function appear(instant: boolean, reduced: boolean): Pick<MotionProps, 'initial' | 'animate' | 'transition'> {
    return {
        initial: instant ? false : reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 },
        animate: { opacity: 1, scale: 1 },
        transition: reduced ? fade : spring.quick,
    };
}

/**
 * The declaration moment (gameplay rules §6), timed to playOpensAt on the server clock (Date.now() + skew):
 * each seat's bubble by its plate in turn order (momentAt), and a panel where the trick goes with the winner
 * line, or a belot's line and its eight cards (the board shows a belot only while it holds the end sheet). The
 * overlay takes no taps (`board-region`): only the panel, a button that skips the moment, which sits in the middle
 * of the felt, clear of the hand. The bubbles are for the eye; the live region has the moment in words (Board).
 */
export function DeclarationMoment({ model, layout, targets, snapshot, reduced, onSkip }: DeclarationMomentProps) {
    const belot = belotLine(model.zvanja, model.me);
    // a belot is one still picture; the declarations read the clock until they close
    const now = useNow(belot ? null : TICK_MS) + model.skew;
    const moment = belot ? null : momentAt(model.zvanja, model.me, now, snapshot);
    if (!belot && (!moment || moment.step === 'closed')) return null;
    const centre = trickCentre(layout);
    const holder = model.zvanja?.belot?.playerId;
    const eight = belot ? model.zvanja?.seats.find((seat) => seat.playerId === holder)?.cards ?? [] : [];
    const row = belotRow(layout, eight.length);
    return (
        <div className="board-region board-moment" data-step={moment?.step ?? 'belot'}>
            {moment && (
                <div aria-hidden="true">
                    {/* by seat id from the seats, never Object.keys(bubbles): integer-like ids would come first */}
                    {model.seats.map((seat) => {
                        const said = moment.bubbles[seat.id] ?? null;
                        if (said === null) return null;
                        const zvanje = model.zvanja?.seats.find((one) => one.playerId === seat.id);
                        const won = moment.step === 'winner' && (zvanje?.declarations.length ?? 0) > 0;
                        return (
                            <span key={seat.id} className="board-moment__spot" style={bubbleSpot(seat, model, targets, layout)}>
                                <m.span
                                    className="board-moment__bubble notch t-footnote font-semibold"
                                    data-seat={seat.id}
                                    data-won={won || undefined}
                                    data-nothing={zvanje?.said == null || undefined}
                                    {...appear(snapshot, reduced)}
                                >
                                    {said}
                                </m.span>
                            </span>
                        );
                    })}
                </div>
            )}
            <m.button
                type="button"
                aria-label={belot ? 'Skip to the result' : 'Skip declarations'}
                className="board-moment__panel notch-6 focus-inside"
                style={{ left: centre.x, top: centre.y }}
                onClick={onSkip}
                {...appear(snapshot, reduced)}
            >
                <span className="t-caption text-text-2">Declarations</span>
                {belot ? (
                    <>
                        <span className="board-moment__line t-callout font-semibold">{belot}</span>
                        <span className="board-moment__cards">
                            {/* sized to the panel (belotRow): eight in a row never run past its sides */}
                            {eight.map((card, i) => (
                                <PlayingCard key={cardId(card)} card={card} width={row.width} style={i ? { marginLeft: row.step - row.width } : undefined} />
                            ))}
                        </span>
                    </>
                ) : moment?.line && (
                    <m.span className="board-moment__line t-callout font-semibold" {...appear(snapshot, reduced)}>{moment.line}</m.span>
                )}
            </m.button>
        </div>
    );
}
