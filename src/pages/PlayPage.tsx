import { PlayPage as RankedQueuePage } from '../components/game/PlayPage';
import { Page } from '../components/layout/Page';

/** /play, Ranked (spec §4.5). The content still renders its own h1 ("RANKED"); Phase 7 owns this module. */
export function PlayPage() {
    return (
        <Page title="Ranked" heading={null}>
            <RankedQueuePage />
        </Page>
    );
}
