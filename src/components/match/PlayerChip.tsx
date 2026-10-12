import { Avatar } from '../ui';
import type { MatchDTO } from '../../types/match';
import { teamOfPlayer } from './trickReplay';

/** A player in a hand's details (spec §4.9 item 6): the initial on the team colour, the name, YOU on mine. */
export function PlayerChip({ player, match, me }: { player: string | null; match: Pick<MatchDTO, 'teamA' | 'teamB'>; me: string | null }) {
    const team = teamOfPlayer(match, player);
    return (
        <span className="inline-flex min-w-0 items-center gap-1.5">
            <Avatar initial={player || '?'} tone={team === 'A' ? 'team-a' : team === 'B' ? 'team-b' : 'neutral'} size="sm" />
            <span className="truncate">{player || 'Unknown'}</span>
            {player !== null && player === me && <span className="t-caption text-accent">YOU</span>}
        </span>
    );
}
