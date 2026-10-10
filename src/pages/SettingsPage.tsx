import { Page } from '../components/layout/Page';
import { EmptyState, Panel } from '../components/ui';

/** /settings (spec §4.13): today's placeholder until Phase 9 puts Table effects and Account here. */
export function SettingsPage() {
    return (
        <Page title="Settings" width="read">
            <Panel>
                <EmptyState icon="gear" title="Settings Coming Soon" body="Settings panel is currently under development." />
            </Panel>
        </Page>
    );
}
