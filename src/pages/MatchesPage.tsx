import { MatchHistory } from '../components/match/MatchHistory';
import { Page } from '../components/layout/Page';

/** /matches (spec §4.9). The content still renders its own h1; Phase 8 owns this module. */
export function MatchesPage() {
    return (
        <Page title="Match History" heading={null}>
            <MatchHistory />
        </Page>
    );
}
