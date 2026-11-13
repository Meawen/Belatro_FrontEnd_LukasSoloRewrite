import { AdminDashboard } from '../components/admin/AdminDashboard';
import { Page } from '../components/layout/Page';
import { useT } from '../i18n/t';

/** /admin (spec §4.14); AdminDashboard checks the role itself. Phase 9 owns this module. */
export function AdminPage() {
    const t = useT();
    return (
        <Page title={t.titles.admin}>
            <AdminDashboard />
        </Page>
    );
}
