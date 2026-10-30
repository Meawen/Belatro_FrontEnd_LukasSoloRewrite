import { cat } from '../../i18n/t';
import { formatDayMonth, formatTime } from '../../i18n/format';

/** The player's result in a match, read from the summary's `yourOutcome` ("WIN", "LOSS", …). */
export type MatchOutcome = 'win' | 'loss' | 'draw';

/** Today's reading (MatchSummaryCard): "win", then "draw", then "loss" anywhere in the text, any case. */
export function matchOutcome(yourOutcome: string | null | undefined): MatchOutcome | null {
    const outcome = yourOutcome?.toLowerCase() ?? '';
    if (outcome.includes('win')) return 'win';
    if (outcome.includes('draw')) return 'draw';
    if (outcome.includes('loss')) return 'loss';
    return null;
}

/** "Victory", "Defeat" or "Draw"; any other outcome as the server wrote it; "Unknown" without one. */
export function outcomeWord(yourOutcome: string | null | undefined): string {
    const c = cat();
    const outcome = matchOutcome(yourOutcome);
    return outcome ? c.matches.outcome[outcome] : yourOutcome || c.common.unknown;
}

/** A game mode in words: RANKED and CASUAL from the catalog, any other as the server wrote it; "Unknown" without one. */
export function modeWord(mode: string | null | undefined): string {
    const c = cat();
    return mode === 'RANKED' || mode === 'CASUAL' ? c.matches.mode[mode] : mode || c.common.unknown;
}

/**
 * MatchSummaryCard's dates, in the site's language: "Today hh:mm" (hr "Danas u 14:05") within 24 h, "Yesterday",
 * "{d}d ago" (hr "prije 3 dana") within a week, then the day and month ("Oct 2", hr "2. listopada"); "Unknown" without
 * a usable date.
 */
export function relativeMatchDate(endTime: unknown, now: Date = new Date()): string {
    const c = cat();
    if (!endTime) return c.common.unknown;
    const date = new Date(endTime as string);
    if (!Number.isFinite(date.getTime())) return c.common.unknown;
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return c.matches.today(formatTime(date));
    if (diffDays === 1) return c.matches.yesterday;
    if (diffDays < 7) return c.matches.daysAgo(diffDays);
    return formatDayMonth(date);
}
