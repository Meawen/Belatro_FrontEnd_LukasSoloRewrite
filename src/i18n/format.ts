import { getLang } from './lang';
import { cat } from './t';

// Dates, relative times and numbers in the site's language (spec §1.1), read at call time; the Intl locale is the
// Lang code itself. A component that formats re-renders on a switch only if it subscribes with useT() or useLang().

/** en 10/30/2026, hr 30. 10. 2026. */
export function formatDate(d: Date | string | number): string {
    return new Intl.DateTimeFormat(getLang()).format(new Date(d));
}

/** en 1,234,567, hr 1.234.567 */
export function formatNumber(n: number): string {
    return new Intl.NumberFormat(getLang()).format(n);
}

/**
 * How long ago: en "5 minutes ago", hr "prije 5 minuta"; under a minute, and a future date, read as just now. The
 * thresholds are lobbyModel's createdAgo, so its English stays the same.
 */
export function formatRelative(d: Date | string | number, now: Date | number = Date.now()): string {
    const seconds = Math.max(0, Math.round((+now - +new Date(d)) / 1000));
    if (seconds < 60) return cat().time.justNow;
    const rtf = new Intl.RelativeTimeFormat(getLang(), { numeric: 'always' });
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return rtf.format(-minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (hours < 24) return rtf.format(-hours, 'hour');
    return rtf.format(-Math.round(hours / 24), 'day');
}
