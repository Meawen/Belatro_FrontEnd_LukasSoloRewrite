/**
 * Final scores from MatchDTO.result (R-36). The backend writes "Team A wins 1001–650" with an
 * en dash and always puts Team A's points first, whoever won. A hyphen, with or without spaces
 * around it, is read the same way. A forfeit (R-20) is "Team B wins by forfeit" and carries no
 * points. Any other text gives 0 and 0, as before.
 */
export type MatchResultScores = { teamAScore: number; teamBScore: number } | 'forfeit';

export function parseMatchResult(result: string): MatchResultScores {
    if (/\bwins by forfeit\b/i.test(result)) return 'forfeit';
    const scores = result.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (!scores) return { teamAScore: 0, teamBScore: 0 };
    return { teamAScore: Number(scores[1]), teamBScore: Number(scores[2]) };
}
