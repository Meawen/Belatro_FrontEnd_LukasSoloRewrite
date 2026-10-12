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
