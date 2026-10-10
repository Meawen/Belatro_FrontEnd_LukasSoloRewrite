import { Page } from '../components/layout/Page';
import { TableEffectsSection } from '../components/settings/TableEffectsSection';
import { AccountSection } from '../components/settings/AccountSection';
import { Button, Panel, PixelIcon } from '../components/ui';
import { useAuth } from '../hooks/useAuth';

/** /settings (spec §4.13; D-32): Table effects, the account, and Log out. */
export function SettingsPage() {
    const { user, logout } = useAuth();
    return (
        <Page title="Settings" width="read">
            <div className="flex flex-col gap-4">
                <TableEffectsSection />
                <AccountSection />
                <Panel as="section" padding="lg" aria-label="Log out" className="flex flex-wrap items-center justify-between gap-3">
                    <p className="t-callout text-text-2">Signed in as {user?.username}</p>
                    {/* a full page load to / (useAuth), as from the navigation */}
                    <Button variant="secondary" leftIcon={<PixelIcon name="logout" />} onClick={() => void logout()}>
                        Log out
                    </Button>
                </Panel>
            </div>
        </Page>
    );
}
