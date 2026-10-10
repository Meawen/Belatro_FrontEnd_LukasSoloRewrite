import { MatchHistory } from '../components/match/MatchHistory';

/** /matches (spec §4.9): Match History renders its own Page frame (title, count, Refresh). Phase 8 owns this module. */
export function MatchesPage() {
    return <MatchHistory />;
}
