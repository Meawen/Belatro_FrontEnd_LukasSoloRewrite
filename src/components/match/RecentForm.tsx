import { Panel } from '../ui';
import { cx } from '../ui/cx';
import type { PlayerMatchSummaryDTO } from '../../types/user';
import type { MatchOutcome } from './matchOutcome';
import { recentForm, formLine } from './recentFormModel';

// The result colours (spec §4.9: W green, L red, D yellow); each pair is ≥ 4.5:1 (spec §3.2)
const SQUARE: Record<MatchOutcome, { letter: string; word: string; tone: string }> = {
    win: { letter: 'W', word: 'Victory', tone: 'bg-success text-ink' },
    loss: { letter: 'L', word: 'Defeat', tone: 'bg-danger-fill text-text' },
    draw: { letter: 'D', word: 'Draw', tone: 'bg-accent text-ink' },
};

/** The Recent form strip above the list (spec §4.9, D-30): this page's results at a glance. */
export function RecentForm({ summaries }: { summaries: readonly PlayerMatchSummaryDTO[] }) {
    const form = recentForm(summaries);
    if (form.outcomes.length === 0) return null;
    return (
        <Panel as="section" aria-label="Recent form" padding="none" className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <h2 className="t-caption text-text-2">Recent form</h2>
            <ol aria-label="Most recent first" className="flex flex-wrap gap-1">
                {form.outcomes.map((outcome, index) => (
                    <li key={index} title={SQUARE[outcome].word} className={cx('notch grid size-[22px] place-items-center t-caption', SQUARE[outcome].tone)}>
                        {SQUARE[outcome].letter}
                    </li>
                ))}
            </ol>
            <p className="t-callout text-text-2">{formLine(form)}</p>
        </Panel>
    );
}
