import { PlayPage as RankedQueuePage } from '../components/game/PlayPage';
import { Page } from '../components/layout/Page';
import { useT } from '../i18n/t';

/** /play, Ranked (spec §4.5). The panel renders the page's h1 ("Find a match") under the "RANKED" eyebrow. */
export function PlayPage() {
    const t = useT();
    return (
        <Page title={t.titles.ranked} heading={null}>
            <RankedQueuePage />
        </Page>
    );
}
