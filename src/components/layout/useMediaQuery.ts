import { useCallback, useSyncExternalStore } from 'react';

function matches(query: string): boolean {
    // no matchMedia (jsdom, very old browsers): nothing matches, which lays the shell out for a desktop
    return typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

/** Whether a CSS media query holds, re-rendering when that changes (a rotation, a resize). */
export function useMediaQuery(query: string): boolean {
    const subscribe = useCallback(
        (onChange: () => void) => {
            if (typeof window.matchMedia !== 'function') return () => {};
            const list = window.matchMedia(query);
            list.addEventListener('change', onChange);
            return () => list.removeEventListener('change', onChange);
        },
        [query],
    );
    return useSyncExternalStore(subscribe, () => matches(query), () => false);
}
