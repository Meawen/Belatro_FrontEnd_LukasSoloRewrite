import type { ReactNode } from 'react';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';

export interface MotionProviderProps {
    children: ReactNode;
    /** 'user' follows the OS (spec §3.8); 'always'/'never' force it (the dev board's toggle, tests). */
    reducedMotion?: 'user' | 'always' | 'never';
}

/**
 * Mounted once around the app (main.tsx). LazyMotion loads only the DOM animation features; `strict`
 * makes `motion.div` throw, so components use `m.div`. A screen with layout animations or layoutId
 * wraps itself in `<LazyMotion features={domMax}>`. Under reduced motion Motion drops transform
 * animations; components cross-fade instead (useReducedMotion, `fade`).
 */
export function MotionProvider({ children, reducedMotion = 'user' }: MotionProviderProps) {
    return (
        <LazyMotion features={domAnimation} strict>
            <MotionConfig reducedMotion={reducedMotion}>{children}</MotionConfig>
        </LazyMotion>
    );
}
