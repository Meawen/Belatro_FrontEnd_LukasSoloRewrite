import type { ReactNode } from 'react';
import { ListRow, PixelIcon, Tag } from '../ui';
import type { IconName } from '../ui';
import { cx } from '../ui/cx';
import type { PlayerMatchSummaryDTO } from '../../types/user';
import { parseMatchResult } from './matchResult';

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

const WORD: Record<MatchOutcome, string> = { win: 'Victory', loss: 'Defeat', draw: 'Draw' };

/** "Victory", "Defeat" or "Draw"; any other outcome as the server wrote it; "Unknown" without one. */
export function outcomeWord(yourOutcome: string | null | undefined): string {
    const outcome = matchOutcome(yourOutcome);
    return outcome ? WORD[outcome] : yourOutcome || 'Unknown';
}

/** MatchSummaryCard's dates: "Today hh:mm" within 24 h, "Yesterday", "{d}d ago" within a week, then "Oct 2". */
export function relativeMatchDate(endTime: unknown, now: Date = new Date()): string {
    if (!endTime) return 'Unknown';
    const date = new Date(endTime as string);
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// The result colour on the stripe, the icon tile and the word (spec §4.9); text pairs on --surface
const TONE: Record<MatchOutcome, { stripe: 'success' | 'danger' | 'accent'; tile: string; word: string; icon: IconName }> = {
    win: { stripe: 'success', tile: 'bg-success/20 text-success', word: 'text-success', icon: 'check' },
    loss: { stripe: 'danger', tile: 'bg-danger/20 text-danger-text', word: 'text-danger-text', icon: 'x' },
    draw: { stripe: 'accent', tile: 'bg-accent/20 text-accent', word: 'text-accent', icon: 'more' },
};

export interface MatchRowProps {
    /** One entry of GET /user/{id}/history/summary. */
    summary: PlayerMatchSummaryDTO;
    /** Router state for the details page, e.g. the list page to go back to (`{ page: 2 }`). */
    state?: unknown;
}

/**
 * One match in a list (spec §4.9): the result stripe and icon tile, the result word, the mode chip (RANKED
 * in the accent), the relative date and #last6, the final score "A : B" (Team A first, R-36) or "Forfeit",
 * and a chevron. The whole row is a link to /matches/:id. Used by Match History, Home and Profile.
 */
export function MatchRow({ summary, state }: MatchRowProps) {
    const { matchId, endTime, result, yourOutcome, gameMode } = summary;
    const outcome = matchOutcome(yourOutcome);
    const tone = outcome ? TONE[outcome] : null;
    const score = result ? parseMatchResult(result) : null;

    const leading = (
        <span data-testid="match-result-tile" className={cx('notch grid size-9 place-items-center', tone?.tile ?? 'bg-surface-2 text-text-2')}>
            <PixelIcon name={tone?.icon ?? 'more'} />
        </span>
    );
    const title = (
        // wraps instead of cutting the chip off in a narrow row (ListRow truncates by default)
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 whitespace-normal">
            <span className={tone?.word ?? 'text-text'}>{outcomeWord(yourOutcome)}</span>
            <Tag tone={gameMode === 'RANKED' ? 'mode' : 'neutral'}>{gameMode || 'Unknown'}</Tag>
        </span>
    );
    const meta = (
        <span className="whitespace-normal">
            <span>{relativeMatchDate(endTime)}</span> · <span className="font-mono text-text-3">#{matchId?.slice(-6) || 'N/A'}</span>
        </span>
    );
    let trailing: ReactNode;
    if (score === 'forfeit') {
        trailing = <span className="t-callout font-semibold">Forfeit</span>;
    } else if (score) {
        trailing = (
            <span className="flex flex-col items-end">
                <span data-testid="match-score" className="t-score tabular-nums">
                    {score.teamAScore}
                    <span className="text-text-3"> : </span>
                    {score.teamBScore}
                </span>
                <span className="t-caption text-text-3">TEAM A · TEAM B</span>
            </span>
        );
    }

    const row = { leading, title, meta, trailing, stripe: tone?.stripe };
    if (!matchId) return <ListRow {...row} />;
    return <ListRow as="link" to={`/matches/${encodeURIComponent(matchId)}`} state={state} {...row} />;
}
