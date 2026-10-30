import { Panel } from '../ui';
import { cx } from '../ui/cx';
import type { PlayerMatchSummaryDTO } from '../../types/user';
import type { MatchOutcome } from './matchOutcome';
import { recentForm, formLine } from './recentFormModel';
import { useT } from '../../i18n/t';

// The result colours (spec §4.9: W green, L red, D yellow); each pair is ≥ 4.5:1 (spec §3.2)
const SQUARE: Record<MatchOutcome, string> = {
    win: 'bg-success text-ink',
    loss: 'bg-danger-fill text-text',
    draw: 'bg-accent text-ink',
};

/** The Recent form strip above the list (spec §4.9, D-30): this page's results at a glance. */
export function RecentForm({ summaries }: { summaries: readonly PlayerMatchSummaryDTO[] }) {
    const t = useT();
    const form = recentForm(summaries);
    if (form.outcomes.length === 0) return null;
    return (
        <Panel as="section" aria-label={t.matches.form.label} padding="none" className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <h2 className="t-caption text-text-2">{t.matches.form.label}</h2>
            <ol aria-label={t.matches.form.order} className="flex flex-wrap gap-1">
                {form.outcomes.map((outcome, index) => (
                    <li key={index} title={t.matches.outcome[outcome]} className={cx('notch grid size-[22px] place-items-center t-caption', SQUARE[outcome])}>
                        {t.matches.letter[outcome]}
                    </li>
                ))}
            </ol>
            <p className="t-callout text-text-2">{formLine(form)}</p>
        </Panel>
    );
}
