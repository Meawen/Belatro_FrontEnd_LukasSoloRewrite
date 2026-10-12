import type { PlayerMatchSummaryDTO } from '../../types/user';
import { matchOutcome, type MatchOutcome } from './matchOutcome';

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
