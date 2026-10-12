import { useEffect, useState } from 'react';
import type { Viewport } from './model/cardTargets';

export interface Insets {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export interface BoardBox {
    /** The whole board: the window (or the dev board's preset). The felt fills it. */
    width: number;
    height: number;
    /** The safe-area insets (--safe-*): the cards, chips and HUD stay inside them (spec §3.4). */
    insets: Insets;
    /** What layoutFor gets: the box inside the insets, and the screen's density. */
    viewport: Viewport;
}

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/** The --safe-* insets in px, read from a probe padded by them (0 where the browser has none). */
function readInsets(): Insets {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left)';
    document.body.appendChild(probe);
    const style = getComputedStyle(probe);
    const px = (value: string) => Number.parseFloat(value) || 0;
    const insets = { top: px(style.paddingTop), right: px(style.paddingRight), bottom: px(style.paddingBottom), left: px(style.paddingLeft) };
    probe.remove();
    return insets;
}

function measure(fixed: { width: number; height: number } | undefined): BoardBox {
    const width = fixed?.width ?? window.innerWidth;
    const height = fixed?.height ?? window.innerHeight;
    const insets = fixed ? NO_INSETS : readInsets();
    const dpr = window.devicePixelRatio || 1;
    return {
        width,
        height,
        insets,
        viewport: { width: Math.max(0, width - insets.left - insets.right), height: Math.max(0, height - insets.top - insets.bottom), dpr },
    };
}

/**
 * The board's size (spec §5.6): the window, followed on resize and rotation, or a fixed size (the
 * dev board's layout presets, which ignore the safe areas).
 */
export function useBoardViewport(fixed?: { width: number; height: number }): BoardBox {
    const width = fixed?.width;
    const height = fixed?.height;
    const [box, setBox] = useState(() => measure(fixed));
    useEffect(() => {
        const size = width !== undefined && height !== undefined ? { width, height } : undefined;
        const update = () => {
            const next = measure(size);
            setBox((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
        };
        update();
        if (size) return;
        window.addEventListener('resize', update);
        window.addEventListener('orientationchange', update);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('orientationchange', update);
        };
    }, [width, height]);
    return box;
}
