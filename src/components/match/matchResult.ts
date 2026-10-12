import type { MatchDTO } from '../../types/match';

/**
 * Final scores from MatchDTO.result (R-36). The backend writes "Team A wins 1001–650" with an
 * en dash and always puts Team A's points first, whoever won. A hyphen, with or without spaces
 * around it, is read the same way. A forfeit (R-20) is "Team B wins by forfeit" and carries no
 * points. Any other text gives null: no made-up 0 and 0 (spec §3.1 rule 6).
 */
export type MatchResultScores = { teamAScore: number; teamBScore: number } | 'forfeit';

export function parseMatchResult(result: string): MatchResultScores | null {
    if (/\bwins by forfeit\b/i.test(result)) return 'forfeit';
    const scores = result.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (!scores) return null;
    return { teamAScore: Number(scores[1]), teamBScore: Number(scores[2]) };
}

/** The team a result names as the winner: "Team B wins 870–1001", "Team A wins by forfeit". */
export function resultWinner(result: string | null | undefined): 'A' | 'B' | null {
    const winner = /^\s*Team ([AB]) wins\b/i.exec(result ?? '');
    return winner ? (winner[1].toUpperCase() as 'A' | 'B') : null;
}

/** The team a user plays for in a match, by id; null when in neither. */
export function teamOfUser(match: Pick<MatchDTO, 'teamA' | 'teamB'>, userId: string | null | undefined): 'A' | 'B' | null {
    if (!userId) return null;
    if (match.teamA?.some((player) => player.id === userId)) return 'A';
    if (match.teamB?.some((player) => player.id === userId)) return 'B';
    return null;
}

/**
 * The details page's result (spec §4.9 `yourResult`): "WIN" when the result names my team, "LOSS" when
 * it names the other; the raw result when it doesn't parse or I'm in neither team; null without one.
 */
export function yourResult(match: Pick<MatchDTO, 'teamA' | 'teamB' | 'result'>, userId: string | null | undefined): string | null {
    const raw = match.result;
    if (!raw) return null;
    const winner = resultWinner(raw);
    const mine = teamOfUser(match, userId);
    if (!winner || !mine || parseMatchResult(raw) === null) return raw;
    return winner === mine ? 'WIN' : 'LOSS';
}
