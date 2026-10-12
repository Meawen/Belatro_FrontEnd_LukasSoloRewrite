import { useEffect, useRef } from 'react';

/**
 * Polls while the tab is visible (spec §4.6, §4.7; D-16). `poll` runs every `ms`, never at mount (the
 * caller loads first) and not at all in a hidden tab; when the tab shows again it polls once at once and
 * resumes the interval. A poll that returns a promise is never doubled: ticks while it runs are skipped,
 * so each poll is one request. Off while `enabled` is false, and after unmount.
 */
export function usePolling(poll: () => unknown, ms: number, enabled = true): void {
    const pollRef = useRef(poll);
    useEffect(() => {
        pollRef.current = poll;
    });

    useEffect(() => {
        if (!enabled) return;
        let timer: ReturnType<typeof setInterval> | undefined;
        let inFlight = false;
        const settle = () => {
            inFlight = false;
        };
        const tick = () => {
            if (inFlight) return;
            const result = pollRef.current();
            if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
                inFlight = true;
                (result as PromiseLike<unknown>).then(settle, settle);
            }
        };
        const start = () => {
            timer = setInterval(tick, ms);
        };
        const stop = () => {
            clearInterval(timer);
            timer = undefined;
        };
        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                stop();
            } else if (timer === undefined) {
                tick();
                start();
            }
        };
        if (document.visibilityState !== 'hidden') start();
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            stop();
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [ms, enabled]);
}
