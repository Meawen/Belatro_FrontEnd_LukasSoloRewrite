import { useRef, type CSSProperties } from 'react';
import { m, useIsPresent, type HTMLMotionProps, type MotionPath } from 'motion/react';
import { fade, path, spring, stagger } from '../../motion/tokens';
import { PlayingCard } from '../ui/PlayingCard';
import { PixelIcon } from '../ui/PixelIcon';
import type { GameCard } from '../../types/game';
import type { Target } from './model/cardTargets';
import type { Entrance } from './stage';

/** Where an entering card starts: a seat's hand anchor, in board coordinates (targets.anchors). */
export type Anchor = { x: number; y: number; rotate: number };

const INSTANT = { duration: 0, layout: { duration: 0 } } as const;

export interface CardMotionOptions {
    target: Target;
    entrance: Entrance | null;
    from: Anchor | null;
    /** A snap (spec §5.5): straight to the target. */
    instant: boolean;
    /** Reduced motion: fade in at the target after the old place faded out (75 ms each, spec §3.8). */
    reduced: boolean;
    /** This element's arc (path.card()). */
    arc: MotionPath;
    /** Seconds before its layout flight starts (the sweep's stagger). */
    layoutDelay?: number;
}

/** How a card element enters and moves (spec §5.3.4): springs from what's on screen, never a bounce. */
export function cardMotion({ target, entrance, from, instant, reduced, arc, layoutDelay = 0 }: CardMotionOptions): Pick<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'transition'> {
    const at = { x: 0, y: 0, rotate: target.rotate, scale: target.scale, rotateY: 0, opacity: 1 };
    if (instant) return { initial: false, animate: at, transition: INSTANT };
    if (reduced) return { initial: { ...at, opacity: 0 }, animate: at, transition: { duration: 0, opacity: { ...fade, delay: fade.duration } } };
    const start = entrance && from
        ? {
            x: from.x - (target.left + target.width / 2),
            y: from.y - (target.top + target.height / 2),
            rotate: from.rotate,
            scale: entrance.scale,
            rotateY: entrance.flip ? 180 : 0,
            opacity: 1,
        }
        : false;
    return {
        initial: start,
        animate: at,
        transition: { ...spring.ui, delay: entrance?.delay ?? 0, layout: { ...spring.ui, delay: layoutDelay, path: arc } },
    };
}

/** One arc per card element, kept for its life (spec §3.8 `path.card`). */
export function useArc(): MotionPath {
    const arc = useRef<MotionPath | null>(null);
    arc.current ??= path.card();
    return arc.current;
}

/** A card's box in board coordinates; `z` orders it within its region. */
export function boxStyle(target: Target): CSSProperties {
    return { left: target.left, top: target.top, width: target.width, height: target.height, '--z': target.z } as CSSProperties;
}

/** The two sides of a card that turns over: its face, and the red back (X-13) behind it. */
export function Faces({ card, width }: { card: GameCard; width: number }) {
    return (
        <>
            <span className="board-card__face"><PlayingCard card={card} width={width} alt="" /></span>
            <span className="board-card__back"><PlayingCard back={1} width={width} /></span>
        </>
    );
}

export interface TrickCardProps {
    card: GameCard;
    id: string;
    playerId: string;
    layoutId: string | undefined;
    target: Target;
    entrance: Entrance | null;
    from: Anchor | null;
    instant: boolean;
    reduced: boolean;
    /** The completed trick's winner: crown and gold ring. */
    winner: boolean;
}

/** A card in the trick region (spec §5.10): `trick-card`, `data-card`, `data-seat`. */
export function TrickCard({ card, id, playerId, layoutId, target, entrance, from, instant, reduced, winner }: TrickCardProps) {
    const arc = useArc();
    const present = useIsPresent();
    return (
        <m.div
            layoutId={layoutId}
            data-testid={present ? 'trick-card' : undefined}
            data-card={id}
            data-seat={playerId}
            className="board-card board-trick-card"
            style={boxStyle(target)}
            exit={{ opacity: 0, transition: fade }}
            {...cardMotion({ target, entrance, from, instant, reduced, arc })}
        >
            <Faces card={card} width={target.width} />
            {winner && (
                <>
                    <span className="board-card__win" aria-hidden="true" />
                    <m.span
                        className="board-crown"
                        initial={instant || reduced ? false : { scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={reduced ? fade : spring.quick}
                    >
                        <PixelIcon name="crown" label="won the trick" />
                    </m.span>
                </>
            )}
        </m.div>
    );
}

export interface BackCardProps {
    target: Target;
    entrance: Entrance | null;
    from: Anchor | null;
    instant: boolean;
    reduced: boolean;
}

/** One of an opponent's cards at their seat: the red back, re-fanned as the hand shrinks; it fades as it leaves. */
export function BackCard({ target, entrance, from, instant, reduced }: BackCardProps) {
    const arc = useArc();
    return (
        <m.div
            layout={!reduced}
            className="board-card board-back-card"
            style={boxStyle(target)}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            {...cardMotion({ target, entrance, from, instant, reduced, arc })}
        >
            <PlayingCard back={1} width={target.width} />
        </m.div>
    );
}

export interface SweepCardProps {
    card: GameCard;
    layoutId: string | undefined;
    /** Its place in the trick, and the pile it flies to (trick size, scale .5, ±8°). */
    slot: Target;
    pile: Target | null;
    /** Its place in the trick's play order: the sweep's stagger. */
    order: number;
    /** On its slot (a recovered 4th card landing), flying to its pile and fading there, or fading where it lies. */
    mode: 'table' | 'pile' | 'fade';
    entrance: Entrance | null;
    from: Anchor | null;
    reduced: boolean;
}

/** A card in the sweep layer (no test id), from its trick slot to the winner's pile (stagger.sweep), or fading. */
export function SweepCard({ card, layoutId, slot, pile, order, mode, entrance, from, reduced }: SweepCardProps) {
    const arc = useArc();
    const delay = order * stagger.sweep;
    const onSlot = { x: 0, y: 0, rotate: slot.rotate, scale: slot.scale, rotateY: 0, opacity: 1 };
    const target = mode === 'pile' && pile ? pile : slot;
    const motion = mode === 'table'
        ? cardMotion({ target: slot, entrance, from, instant: false, reduced, arc })
        : mode === 'pile' && pile
            ? {
                initial: onSlot,
                animate: { x: 0, y: 0, rotate: pile.rotate, scale: pile.scale, rotateY: 0, opacity: 0 },
                transition: { ...spring.ui, delay, layout: { ...spring.ui, delay, path: arc }, opacity: { duration: 0.12, delay: 0.4 + delay } },
            }
            : { initial: false as const, animate: { ...onSlot, opacity: 0 }, transition: { duration: 0.2 } };
    return (
        <m.div layoutId={layoutId} className="board-card board-sweep-card" style={boxStyle(target)} {...motion}>
            <Faces card={card} width={slot.width} />
        </m.div>
    );
}
