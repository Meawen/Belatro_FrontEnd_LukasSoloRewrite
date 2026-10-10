import React, { useEffect, useState } from 'react';
import { useEnhancedRanked } from '../../hooks/useEnhancedRanked';
import { cx } from '../ui/cx';
import './QueueStatus.css';

/** The server's estimate; "Calculating..." while it has none (≤ 0; −1 past the 400-point gap, R-47). */
export const formatWaitTime = (seconds?: number) => {
    if (!seconds || seconds < 0) return 'Calculating...';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
};

/** "m:ss" */
export const formatTimeInQueue = (ms: number) => {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** Date.now(), refreshed every second while `running`. */
function useClock(running: boolean): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!running) return;
        setNow(Date.now());
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [running]);
    return now;
}

/** While queued (spec §4.5): "Searching for a match", the squares lit in turn, and the queue's three numbers. */
export const QueueStatus: React.FC = () => {
    const { isInQueue, queueStatus, queuedSince } = useEnhancedRanked();
    const now = useClock(isInQueue);
    if (!isInQueue) return null;

    const tiles = [
        { label: 'Players in queue', value: String(queueStatus?.queueSize ?? '—') },
        { label: 'Estimated wait', value: formatWaitTime(queueStatus?.estWaitSeconds) },
        { label: 'Time in queue', value: queuedSince === null ? '—' : formatTimeInQueue(now - queuedSince) },
    ];

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
                <span className="queue-turn" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                </span>
                <p className="t-headline">Searching for a match</p>
            </div>
            <dl className="grid gap-2 sm:grid-cols-3">
                {tiles.map(({ label, value }) => (
                    <div key={label} className="notch flex items-baseline justify-between gap-3 bg-surface-2 px-3 py-2 sm:block">
                        <dt className="t-caption text-text-2">{label}</dt>
                        <dd className={cx('tabular-nums sm:mt-1', value === 'Calculating...' ? 't-callout' : 't-score')}>{value}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
};
