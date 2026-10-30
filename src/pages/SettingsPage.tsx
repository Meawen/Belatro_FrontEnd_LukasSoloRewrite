import { Page } from '../components/layout/Page';
import { LanguageSection } from '../components/settings/LanguageSection';
import { TableEffectsSection } from '../components/settings/TableEffectsSection';
import { AccountSection } from '../components/settings/AccountSection';
import { Button, Panel, PixelIcon } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useT } from '../i18n/t';

/** /settings (spec §4.13; D-32; open beta §1.1): Language, Table effects, the account, and Log out. */
export function SettingsPage() {
    const { user, logout } = useAuth();
    const t = useT();
    return (
        <Page title={t.titles.settings} width="read">
            <div className="flex flex-col gap-4">
                <LanguageSection />
                <TableEffectsSection />
                <AccountSection />
                <Panel as="section" padding="lg" aria-label={t.common.logOut} className="flex flex-wrap items-center justify-between gap-3">
                    <p className="t-callout text-text-2">{t.settings.signedInAs(user?.username ?? '')}</p>
                    {/* a full page load to / (useAuth), as from the navigation */}
                    <Button variant="secondary" leftIcon={<PixelIcon name="logout" />} onClick={() => void logout()}>
                        {t.common.logOut}
                    </Button>
                </Panel>
            </div>
        </Page>
    );
}
