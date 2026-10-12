import { PlayPage as RankedQueuePage } from '../components/game/PlayPage';
import { Page } from '../components/layout/Page';

/** /play, Ranked (spec §4.5). The panel renders the page's h1 ("Find a match") under the "RANKED" eyebrow. */
export function PlayPage() {
    return (
        <Page title="Ranked" heading={null}>
            <RankedQueuePage />
        </Page>
    );
}
