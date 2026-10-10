import { useRef, type CSSProperties } from 'react';
import type { HTMLMotionProps, MotionPath } from 'motion/react';
import { fade, path, spring } from '../../motion/tokens';
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
