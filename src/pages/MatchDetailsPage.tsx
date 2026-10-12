import { useParams } from 'react-router-dom';
import { MatchDetails } from '../components/match/MatchDetails';

/** /matches/:id (spec §4.9): one match on its own page; keyed by id, so another match starts afresh. Phase 8 owns this module. */
export function MatchDetailsPage() {
    const { id = '' } = useParams();
    return <MatchDetails key={id} id={id} />;
}
