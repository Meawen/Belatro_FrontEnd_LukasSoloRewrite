import { useEffect, useState } from 'react';

/** Date.now(), refreshed every `every` ms while mounted (the countdown's seconds). */
export function useNow(every = 1000): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), every);
        return () => window.clearInterval(timer);
    }, [every]);
    return now;
}
