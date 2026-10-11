import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * The element's width in CSS px, kept current as it resizes (a phone turned to landscape, a sidebar appearing), so
 * a chart draws in real pixels and its text keeps the type scale (ranks spec §7.3). Without ResizeObserver, or before
 * the element has a width (jsdom), the fallback.
 */
export function useElementWidth(ref: RefObject<HTMLElement | null>, fallback: number = 640): number {
    const [width, setWidth] = useState(fallback);
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element || typeof ResizeObserver === 'undefined') return;
        const measure = () => setWidth(element.clientWidth || fallback);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref, fallback]);
    return width;
}
