import { getLang } from './lang';
import { cat } from './t';

// Dates, relative times and numbers in the site's language (spec §1.1), read at call time; the Intl locale is the
// Lang code itself. A component that formats re-renders on a switch only if it subscribes with useT() or useLang().

/** en 10/30/2026, hr 30. 10. 2026. ('' for an unparseable date) */
export function formatDate(d: Date | string | number): string {
    const date = new Date(d);
    // an unparseable date shows nothing: Intl throws a RangeError on an invalid time
    if (!Number.isFinite(date.getTime())) return '';
    return new Intl.DateTimeFormat(getLang()).format(date);
}

/** en 02:05 PM, hr 14:05; '' for an unparseable date. */
export function formatTime(d: Date | string | number): string {
    const date = new Date(d);
    if (!Number.isFinite(date.getTime())) return '';
    return new Intl.DateTimeFormat(getLang(), { hour: '2-digit', minute: '2-digit' }).format(date);
}

/** en Oct 2, hr 2. listopada (the long month: "2. lis" is cryptic); '' for an unparseable date. */
export function formatDayMonth(d: Date | string | number): string {
    const date = new Date(d);
    if (!Number.isFinite(date.getTime())) return '';
    const lang = getLang();
    return new Intl.DateTimeFormat(lang, { day: 'numeric', month: lang === 'hr' ? 'long' : 'short' }).format(date);
}

/**
 * A day the server keyed as yyyy-MM-dd (the beta counts' Europe/Zagreb days): en "Wed, Oct 21", hr "sri, 21. listopada".
 * Formatted in UTC, so the browser's own time zone never moves it to another day; anything else shows as it came.
 */
export function formatDay(day: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
    if (!match) return day;
    const lang = getLang();
    return new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: lang === 'hr' ? 'long' : 'short', timeZone: 'UTC' })
        .format(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/**
 * en November 6, 2026, hr 6. studenoga 2026. (the dot is the Croatian ordinal's); the day in Zagreb, the day the
 * server's emails name (MailService DAY_EN/DAY_HR). '' for an unparseable date.
 */
export function formatLongDate(d: Date | string | number): string {
    const date = new Date(d);
    if (!Number.isFinite(date.getTime())) return '';
    return new Intl.DateTimeFormat(getLang(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Zagreb' }).format(date);
}

/** en 1,234,567, hr 1.234.567 */
export function formatNumber(n: number): string {
    return new Intl.NumberFormat(getLang()).format(n);
}

/**
 * How long ago: en "5 minutes ago", hr "prije 5 minuta"; under a minute, and a future date, read as just now. The
 * thresholds are lobbyModel's createdAgo, so its English stays the same. '' for an unparseable date.
 */
export function formatRelative(d: Date | string | number, now: Date | number = Date.now()): string {
    const then = +new Date(d);
    // an unparseable date shows nothing: Intl throws a RangeError on an invalid time
    if (!Number.isFinite(then) || !Number.isFinite(+now)) return '';
    const seconds = Math.max(0, Math.round((+now - then) / 1000));
    if (seconds < 60) return cat().time.justNow;
    const rtf = new Intl.RelativeTimeFormat(getLang(), { numeric: 'always' });
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return rtf.format(-minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (hours < 24) return rtf.format(-hours, 'hour');
    return rtf.format(-Math.round(hours / 24), 'day');
}
