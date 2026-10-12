/** "h:mm:ss" from an hour on, else "m:ss"; "Unknown" without both times (today's Match Details rule). */
export function formatDuration(startTime: string | null, endTime: string | null): string {
    if (!startTime || !endTime) return 'Unknown';
    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    const hours = Math.floor(durationMs / 3_600_000);
    const minutes = Math.floor((durationMs % 3_600_000) / 60_000);
    const seconds = Math.floor((durationMs % 60_000) / 1000);
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
}
