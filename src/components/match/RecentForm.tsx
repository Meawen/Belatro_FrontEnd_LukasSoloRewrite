import { Panel } from '../ui';
import { cx } from '../ui/cx';
import type { PlayerMatchSummaryDTO } from '../../types/user';
import { matchOutcome, type MatchOutcome } from './MatchRow';

/** What the Recent form strip shows for one page of the list (spec §4.9). */
export interface RecentFormSummary {
    /** The page's known outcomes in list order: the most recent first. */
    outcomes: MatchOutcome[];
    wins: number;
    losses: number;
    /** The run the most recent match starts; null when it is a draw (or the page is empty). */
    streak: { outcome: 'win' | 'loss'; count: number } | null;
}

export function recentForm(summaries: readonly PlayerMatchSummaryDTO[]): RecentFormSummary {
    const outcomes = summaries.map((summary) => matchOutcome(summary.yourOutcome)).filter((outcome): outcome is MatchOutcome => outcome !== null);
    const latest = outcomes[0];
    let count = 0;
    while (count < outcomes.length && outcomes[count] === latest) count++;
    return {
        outcomes,
        wins: outcomes.filter((outcome) => outcome === 'win').length,
        losses: outcomes.filter((outcome) => outcome === 'loss').length,
        streak: latest === 'win' || latest === 'loss' ? { outcome: latest, count } : null,
    };
}

const counted = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "2 wins · 1 loss on this page · won the last 2". */
export function formLine(form: RecentFormSummary): string {
    const line = `${counted(form.wins, 'win', 'wins')} · ${counted(form.losses, 'loss', 'losses')} on this page`;
    if (!form.streak) return line;
    return `${line} · ${form.streak.outcome === 'win' ? 'won' : 'lost'} the last ${form.streak.count}`;
}

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
