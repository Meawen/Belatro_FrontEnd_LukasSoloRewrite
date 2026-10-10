import { arc } from 'motion/react';
import type { MotionPath } from 'motion/react';

/**
 * Motion tokens (spec §3.8). Springs are critically damped (bounce 0) and named by the time they take
 * to look settled; a spring re-targets from the on-screen value and velocity, so every move can be
 * interrupted. Bounce is never used in this release: there is no momentum gesture (T-4).
 */
export const spring = {
    /** card flights, seat moves, screen push, desktop sheets (Apple: damping 1.0, response 0.35) */
    ui: { type: 'spring', bounce: 0, visualDuration: 0.35 },
    /** hover lift, pending lift, chips, toasts, badges */
    quick: { type: 'spring', bounce: 0, visualDuration: 0.2 },
    /** phone sheets in and out */
    sheet: { type: 'spring', bounce: 0, visualDuration: 0.3 },
    /** the season felt cross-fade, the lobby table growing on start */
    felt: { type: 'spring', bounce: 0, visualDuration: 0.5 },
} as const;

/** Under reduced motion every position or scale animation becomes fade out (this) → jump → fade in (this). */
export const fade = { duration: 0.075, ease: 'linear' } as const;

/** Seconds between cards: the deal, and the trick sweeping to its pile. */
export const stagger = { deal: 0.03, sweep: 0.04 } as const;

/** Milliseconds a finished trick stays on the table. Visual only: input never waits for it (§5.3). */
export const hold = { trick: 900 } as const;

/** Press feedback is CSS `:active` (the `press` utility and the ui controls in index.css), this transition. */
export const press = 'transform 90ms ease-out';

/**
 * Card flights follow an arc: `transition={{ layout: { ...spring.ui, path: cardPath } }}`. Call
 * `path.card()` once per card element and keep the result (useRef or useMemo): the arc remembers its
 * element's curve, so a re-targeted flight continues smoothly.
 */
export const path = {
    card: (): MotionPath => arc({ strength: 0.35 }),
};
