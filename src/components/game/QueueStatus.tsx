import React, { useEffect, useState } from 'react';
import { useEnhancedRanked } from '../../hooks/useEnhancedRanked';
import { cx } from '../ui/cx';
import { useT } from '../../i18n/t';
import type { Catalog } from '../../i18n/catalog/types';
import './QueueStatus.css';

/** The server's estimate; "Calculating..." while it has none (≤ 0; −1 past the 400-point gap, R-47). */
const formatWaitTime = (seconds: number | undefined, t: Catalog) => {
    if (!seconds || seconds < 0) return t.ranked.calculating;
    if (seconds < 60) return t.ranked.seconds(seconds);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? t.ranked.minutesSeconds(minutes, remainingSeconds) : t.ranked.minutes(minutes);
};

/** "m:ss" */
const formatTimeInQueue = (ms: number) => {
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
    const t = useT();
    if (!isInQueue) return null;

    const tiles = [
        { label: t.ranked.inQueue, value: String(queueStatus?.queueSize ?? '—') },
        { label: t.ranked.wait, value: formatWaitTime(queueStatus?.estWaitSeconds, t) },
        { label: t.ranked.timeInQueue, value: queuedSince === null ? '—' : formatTimeInQueue(now - queuedSince) },
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
                <p className="t-headline">{t.ranked.searching}</p>
            </div>
            <dl className="grid gap-2 sm:grid-cols-3">
                {tiles.map(({ label, value }) => (
                    <div key={label} className="notch flex items-baseline justify-between gap-3 bg-surface-2 px-3 py-2 sm:block">
                        <dt className="t-caption text-text-2">{label}</dt>
                        <dd className={cx('tabular-nums sm:mt-1', value === t.ranked.calculating ? 't-callout' : 't-score')}>{value}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
};
