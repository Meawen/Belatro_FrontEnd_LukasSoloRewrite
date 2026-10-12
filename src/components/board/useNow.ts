import { useEffect, useState } from 'react';

/** Date.now(), refreshed every `every` ms while mounted (the countdown's seconds); `null` keeps the first value. */
export function useNow(every: number | null = 1000): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (every === null) return;
        const timer = window.setInterval(() => setNow(Date.now()), every);
        return () => window.clearInterval(timer);
    }, [every]);
    return now;
}
